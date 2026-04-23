import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// GET /api/crimes?lat=28.6&lng=77.2&radius=5
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const radius = Math.min(50, Math.max(0.1, parseFloat(searchParams.get('radius') ?? '5')))

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const delta = radius / 111
  const supabase = createServerClient()

  const [{ data: crimes }, { data: reports }] = await Promise.all([
    supabase
      .from('crimes')
      .select('id, latitude, longitude, city, state, crime_type, crime_against_women, year, count, source')
      .gte('latitude', lat - delta).lte('latitude', lat + delta)
      .gte('longitude', lng - delta).lte('longitude', lng + delta)
      .order('year', { ascending: false })
      .limit(500),

    supabase
      .from('reports')
      .select('id, latitude, longitude, incident_type, upvotes, reported_at')
      .gte('latitude', lat - delta).lte('latitude', lat + delta)
      .gte('longitude', lng - delta).lte('longitude', lng + delta)
      .eq('verified', true)
      .order('reported_at', { ascending: false })
      .limit(200),
  ])

  // Normalise snake_case → camelCase for the frontend
  const normCrimes = (crimes ?? []).map(c => ({
    id: c.id,
    latitude: c.latitude,
    longitude: c.longitude,
    city: c.city,
    state: c.state,
    crimeType: c.crime_type,
    crimeAgainstWomen: c.crime_against_women,
    year: c.year,
    count: c.count,
    source: c.source,
  }))

  return NextResponse.json({ crimes: normCrimes, reports: reports ?? [] })
}
