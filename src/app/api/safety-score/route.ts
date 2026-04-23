import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { computeSafetyScore, computeTrend, scoreToLabel } from '@/lib/safety-score'
import Anthropic from '@anthropic-ai/sdk'

// Reverse geocode lat/lng → city + state using Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<{ city: string; state: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: { 'User-Agent': 'SafeSteps-WomenSafety/1.0' },
        next: { revalidate: 86400 },
      }
    )
    const data = await res.json()
    const addr = data.address ?? {}
    const city =
      addr.city ?? addr.town ?? addr.village ?? addr.county ?? addr.suburb ?? addr.district ?? null
    const state = addr.state ?? null
    return city ? { city, state } : null
  } catch {
    return null
  }
}

// GET /api/safety-score?lat=28.6&lng=77.2&radius=3
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat    = parseFloat(searchParams.get('lat') ?? '')
  const lng    = parseFloat(searchParams.get('lng') ?? '')
  const radius = Math.min(50, Math.max(0.1, parseFloat(searchParams.get('radius') ?? '3')))
  const hourParam = searchParams.get('hour')
  const hour = hourParam !== null ? parseInt(hourParam) : new Date().getHours()

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const delta = radius / 111

  // dataSource tracks exactly how crime data was resolved — visible in API response for verification
  let dataSource: { method: string; city: string | null; note: string } = {
    method: 'none', city: null, note: 'No crime data found',
  }

  // Step 1: Try exact proximity search first
  let [{ data: crimes }, { data: reports }] = await Promise.all([
    supabase
      .from('crimes')
      .select('*')
      .gte('latitude', lat - delta).lte('latitude', lat + delta)
      .gte('longitude', lng - delta).lte('longitude', lng + delta),
    supabase
      .from('reports')
      .select('*')
      .gte('latitude', lat - delta).lte('latitude', lat + delta)
      .gte('longitude', lng - delta).lte('longitude', lng + delta)
      .eq('verified', true),
  ])

  if (crimes && crimes.length > 0) {
    const city = (crimes[0] as Record<string, unknown>).city as string
    dataSource = { method: 'proximity', city, note: `${crimes.length} records within ${radius}km radius` }
  }

  // Step 2: If no crimes found nearby, reverse geocode and search by city name
  if (!crimes || crimes.length === 0) {
    const geo = await reverseGeocode(lat, lng)

    // Sanitize strings from Nominatim: keep only alphanumeric + spaces, cap at 50 chars
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9\s]/g, '').trim().slice(0, 50)

    if (geo?.city) {
      const safeCity = sanitize(geo.city.split(' ')[0])  // match first word of city name
      const { data: citycrimes } = safeCity.length > 0
        ? await supabase.from('crimes').select('*').ilike('city', `%${safeCity}%`)
        : { data: null }

      if (citycrimes && citycrimes.length > 0) {
        crimes = citycrimes
        dataSource = { method: 'city_name', city: geo.city, note: `Matched "${geo.city}" from reverse geocode` }
      } else if (geo.state) {
        const safeState = sanitize(geo.state)
        // Fall back to state-level data
        const { data: statecrimes } = safeState.length > 0
          ? await supabase.from('crimes').select('*').ilike('state', `%${safeState}%`)
          : { data: null }
        crimes = statecrimes
        if (crimes && crimes.length > 0) {
          dataSource = { method: 'state_fallback', city: geo.state, note: `No city match; using state-level data for ${geo.state}` }
        }
      }
    }

    // Step 3: Still nothing — use nearest city by coordinates.
    // Fetch enough rows to cover all cities (20 cities × ~9 grid pts × 7 crime types ≈ 1260 rows),
    // then deduplicate to one representative row per city before finding the nearest.
    if (!crimes || crimes.length === 0) {
      const { data: allRows } = await supabase
        .from('crimes')
        .select('city, state, latitude, longitude')
        .limit(2000)

      if (allRows && allRows.length > 0) {
        // One representative row per city (first occurrence = grid center point)
        const cityMap = new Map<string, typeof allRows[0]>()
        for (const row of allRows) {
          if (!cityMap.has(row.city)) cityMap.set(row.city, row)
        }
        const cityCenters = Array.from(cityMap.values())

        const nearest = cityCenters.reduce((best, c) => {
          const dBest = Math.hypot(best.latitude - lat, best.longitude - lng)
          const dC = Math.hypot(c.latitude - lat, c.longitude - lng)
          return dC < dBest ? c : best
        })

        const distKm = Math.hypot(nearest.latitude - lat, nearest.longitude - lng) * 111

        const { data: nearestCrimes } = await supabase
          .from('crimes')
          .select('*')
          .eq('city', nearest.city)
        crimes = nearestCrimes
        dataSource = {
          method: 'nearest_city',
          city: nearest.city,
          note: `No local data; using nearest city "${nearest.city}" (${Math.round(distKm)}km away). Score reflects that city's average risk.`,
        }
      }
    }
  }

  // Map Supabase snake_case → camelCase for scoring function
  const mappedCrimes = (crimes ?? []).map((c: Record<string, unknown>) => ({
    latitude: c.latitude as number,
    longitude: c.longitude as number,
    crimeType: (c.crime_type ?? c.crimeType) as string,
    crimeAgainstWomen: (c.crime_against_women ?? c.crimeAgainstWomen) as boolean,
    year: c.year as number,
    count: c.count as number,
    source: c.source as string,
  }))

  const mappedReports = (reports ?? []).map((r: Record<string, unknown>) => ({
    latitude: r.latitude as number,
    longitude: r.longitude as number,
    incidentType: (r.incident_type ?? r.incidentType) as string,
    upvotes: r.upvotes as number,
    reportedAt: new Date((r.reported_at ?? r.reportedAt) as string),
  }))

  const breakdown = computeSafetyScore(mappedCrimes, mappedReports, radius, hour)
  const label = scoreToLabel(breakdown.score)
  const trend = computeTrend(mappedCrimes, radius)

  // Reverse geocode for location name display
  const geo = await reverseGeocode(lat, lng)
  const locationName = geo?.city ?? 'this area'

  // AI summary (optional)
  let aiSummary: string | null = null
  if (
    process.env.ANTHROPIC_API_KEY &&
    process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key' &&
    (crimes?.length ?? 0) > 0
  ) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `You are a women's safety advisor for India. Based on NCRB 2022 crime data for ${locationName}, write a 2-sentence safety summary for women. Be factual, helpful, and not alarmist.

Crime data:
- Total reported incidents: ${breakdown.totalCrimes}
- Crimes specifically against women: ${breakdown.womenCrimes}
- Top crime types: ${breakdown.topCrimeTypes.join(', ')}
- Crowd reports: ${breakdown.crowdReports}
- Safety score: ${breakdown.score}/10 (${label})

Write a brief, practical safety note.`,
        }],
      })
      aiSummary = (msg.content[0] as { text: string }).text
    } catch {
      // Non-critical
    }
  }

  return NextResponse.json({
    lat, lng, radius, hour,
    locationName,
    ...breakdown,
    label,
    aiSummary,
    dataSource,
    trend,
  })
}
