import { NextRequest, NextResponse } from 'next/server'
import { computeSafetyScore, scoreToLabel } from '@/lib/safety-score'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export interface RouteOption {
  id: number
  label: string                        // "Fastest" | "Safest Detour" | "Alternative N"
  routeGeometry: [number, number][]    // [lng, lat] GeoJSON order
  waypoints: Array<{
    lat: number; lng: number
    score: number; level: string; color: string; label: string
  }>
  distanceKm: number
  durationMin: number
  overallScore: number
  overallColor: string
  overallLevel: string
  riskySegments: number
  cautiousSegments: number
  isSafest: boolean
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Sample a GeoJSON LineString at uniform distance intervals
function samplePolyline(coords: [number, number][], intervalKm: number): [number, number][] {
  if (coords.length === 0) return []
  const samples: [number, number][] = [coords[0]]
  let accumulated = 0
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1]
    const [lng2, lat2] = coords[i]
    accumulated += haversineKm(lat1, lng1, lat2, lng2)
    if (accumulated >= intervalKm) { samples.push(coords[i]); accumulated = 0 }
  }
  const last = coords[coords.length - 1]
  if (samples[samples.length - 1] !== last) samples.push(last)
  return samples
}

// Generate candidate waypoints perpendicular to the A→B direct line.
// Returns candidates at multiple lateral offsets (left and right of the path)
// at multiple positions along the route (25%, 50%, 75% of the way).
function perpendicularCandidates(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  maxOffsetKm: number
): Array<{ lat: number; lng: number; position: string }> {
  const directKm = haversineKm(fromLat, fromLng, toLat, toLng)

  // Direction vector (lat/lng deltas)
  const dLat = toLat - fromLat
  const dLng = toLng - fromLng

  // Perpendicular unit vector (rotate 90°)
  const perpLen = Math.hypot(dLat, dLng)
  const perpLat = -dLng / perpLen
  const perpLng =  dLat / perpLen

  // 1° lat ≈ 111 km; 1° lng ≈ 111 * cos(lat) km
  const midLat = (fromLat + toLat) / 2
  const kmPerDegLat = 111
  const kmPerDegLng = 111 * Math.cos(midLat * Math.PI / 180)

  const candidates: Array<{ lat: number; lng: number; position: string }> = []

  // Offsets: 20%, 33%, 50% of direct distance, on both sides
  const offsets = [
    Math.min(maxOffsetKm, directKm * 0.20),
    Math.min(maxOffsetKm, directKm * 0.33),
    Math.min(maxOffsetKm, directKm * 0.50),
  ].filter(o => o >= 0.5) // at least 500m offset to be meaningful

  // Positions along the route: 25%, 50%, 75%
  const positions = [0.25, 0.50, 0.75]

  for (const t of positions) {
    const baseLat = fromLat + t * dLat
    const baseLng = fromLng + t * dLng
    const label = t === 0.25 ? 'early' : t === 0.5 ? 'mid' : 'late'

    for (const offsetKm of offsets) {
      // Right side (+perp)
      candidates.push({
        lat: baseLat + perpLat * offsetKm / kmPerDegLat,
        lng: baseLng + perpLng * offsetKm / kmPerDegLng,
        position: `${label}-right-${Math.round(offsetKm)}km`,
      })
      // Left side (-perp)
      candidates.push({
        lat: baseLat - perpLat * offsetKm / kmPerDegLat,
        lng: baseLng - perpLng * offsetKm / kmPerDegLng,
        position: `${label}-left-${Math.round(offsetKm)}km`,
      })
    }
  }

  return candidates
}

// Are two routes "too similar"?
// Samples every 500m and checks maximum point-to-point deviation.
// Routes are duplicates only if they never diverge by more than 500m.
function routesAreSimilar(a: [number, number][], b: [number, number][]): boolean {
  const sampleA = samplePolyline(a, 0.5)  // sample every 500m
  const sampleB = samplePolyline(b, 0.5)
  const minLen = Math.min(sampleA.length, sampleB.length)
  if (minLen < 2) return false
  let maxDist = 0
  for (let i = 0; i < minLen; i++) {
    const [lngA, latA] = sampleA[i]
    const [lngB, latB] = sampleB[i]
    maxDist = Math.max(maxDist, haversineKm(latA, lngA, latB, lngB))
  }
  // Only deduplicate near-identical routes (max divergence < 500m)
  return maxDist < 0.5
}

// ── Supabase helpers ─────────────────────────────────────────────────────────

async function fetchCrimesNear(
  supabase: ReturnType<typeof createServerClient>,
  lat: number, lng: number, radiusKm = 3
) {
  const delta = radiusKm / 111
  const { data } = await supabase
    .from('crimes')
    .select('latitude,longitude,crime_type,crime_against_women,year,count,source')
    .gte('latitude', lat - delta).lte('latitude', lat + delta)
    .gte('longitude', lng - delta).lte('longitude', lng + delta)
  return (data ?? []).map(c => ({
    latitude: c.latitude as number, longitude: c.longitude as number,
    crimeType: c.crime_type as string, crimeAgainstWomen: c.crime_against_women as boolean,
    year: c.year as number, count: c.count as number, source: c.source as string,
  }))
}

async function scoreRoute(
  supabase: ReturnType<typeof createServerClient>,
  coords: [number, number][],
  distanceKm: number,
  durationMin: number,
  hour: number,
  id: number,
  label: string
): Promise<RouteOption> {
  const interval = Math.max(1, distanceKm / 10)
  const samples  = samplePolyline(coords, interval)

  const waypoints = await Promise.all(
    samples.map(async ([lng, lat]) => {
      const crimes = await fetchCrimesNear(supabase, lat, lng)
      const bd = computeSafetyScore(crimes, [], 3, hour)
      return { lat, lng, score: bd.score, level: bd.level, color: bd.color, label: scoreToLabel(bd.score) }
    })
  )

  const overallScore = waypoints.length > 0
    ? Math.round((waypoints.reduce((s, w) => s + w.score, 0) / waypoints.length) * 10) / 10
    : 5.0
  const overallColor = overallScore >= 6.5 ? '#22c55e' : overallScore >= 3.5 ? '#f59e0b' : '#ef4444'

  return {
    id,
    label,
    routeGeometry: coords,
    waypoints,
    distanceKm,
    durationMin,
    overallScore,
    overallColor,
    overallLevel: scoreToLabel(overallScore),
    riskySegments:    waypoints.filter(w => w.level === 'unsafe').length,
    cautiousSegments: waypoints.filter(w => w.level === 'moderate').length,
    isSafest: false,
  }
}

// ── OSRM fetch helper ─────────────────────────────────────────────────────────

type OsrmRoute = { geometry: { coordinates: [number,number][] }; distance: number; duration: number }

async function fetchOsrmRoutes(
  fromLng: number, fromLat: number,
  toLng: number, toLat: number,
  viaLng?: number, viaLat?: number
): Promise<OsrmRoute[]> {
  const coords = viaLng !== undefined
    ? `${fromLng},${fromLat};${viaLng},${viaLat};${toLng},${toLat}`
    : `${fromLng},${fromLat};${toLng},${toLat}`

  // Only request alternatives on the direct route (not waypointed ones)
  const altParam = viaLng === undefined ? '&alternatives=3' : ''

  const url =
    `https://router.project-osrm.org/route/v1/driving/${coords}` +
    `?overview=full&geometries=geojson${altParam}`

  const res  = await fetch(url, {
    headers: { 'User-Agent': 'SafeSteps-WomenSafety/1.0' },
    signal: AbortSignal.timeout(10000),
  })
  const json = await res.json()
  return (json.routes ?? []) as OsrmRoute[]
}

// ── Main handler ──────────────────────────────────────────────────────────────

// GET /api/route-safety?fromLat=&fromLng=&toLat=&toLng=&hour=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fromLat = parseFloat(searchParams.get('fromLat') ?? '')
  const fromLng = parseFloat(searchParams.get('fromLng') ?? '')
  const toLat   = parseFloat(searchParams.get('toLat')   ?? '')
  const toLng   = parseFloat(searchParams.get('toLng')   ?? '')
  const hour    = parseInt(searchParams.get('hour') ?? String(new Date().getHours()))

  if ([fromLat, fromLng, toLat, toLng].some(isNaN)) {
    return NextResponse.json({ error: 'fromLat, fromLng, toLat, toLng required' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    return await computeRoutes(supabase, fromLat, fromLng, toLat, toLng, hour)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[route-safety]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function computeRoutes(
  supabase: ReturnType<typeof createServerClient>,
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  hour: number
) {
  const directKm = haversineKm(fromLat, fromLng, toLat, toLng)

  // ── Step 1: Fetch OSRM alternatives (primary + up to 3) ──────────────────
  let osrmRoutes: OsrmRoute[] = []
  try {
    osrmRoutes = await fetchOsrmRoutes(fromLng, fromLat, toLng, toLat)
  } catch {
    // straight-line fallback
    osrmRoutes = [{
      geometry: { coordinates: [[fromLng, fromLat], [toLng, toLat]] },
      distance: directKm * 1000,
      duration: (directKm / 30) * 3600,
    }]
  }

  if (osrmRoutes.length === 0) {
    return NextResponse.json({ error: 'No route found between these points' }, { status: 404 })
  }

  // ── Step 2: Generate safety-optimised detour routes ──────────────────────
  // Only generate detours for trips > 2 km (short trips have no room for detours)
  const detourRoutes: OsrmRoute[] = []

  if (directKm >= 2) {
    // Cap offset at 2.5 km to stay on land in coastal/peninsula cities (Mumbai, Chennai…)
    const maxOffsetKm = Math.min(2.5, directKm * 0.25)
    const candidates = perpendicularCandidates(fromLat, fromLng, toLat, toLng, maxOffsetKm)

    // Score each candidate waypoint for safety
    const candidateScores = await Promise.all(
      candidates.map(async (c) => {
        const crimes = await fetchCrimesNear(supabase, c.lat, c.lng, 2)
        const bd = computeSafetyScore(crimes, [], 2, hour)
        return { ...c, safetyScore: bd.score }
      })
    )

    // Pick the safest candidate from each side (left / right of route)
    const leftCandidates  = candidateScores.filter(c => c.position.includes('left'))
    const rightCandidates = candidateScores.filter(c => c.position.includes('right'))

    const bestLeft  = leftCandidates.sort((a, b) => b.safetyScore - a.safetyScore)[0]
    const bestRight = rightCandidates.sort((a, b) => b.safetyScore - a.safetyScore)[0]

    // Always attempt detours — even a same-score path gives the user a different route option.
    // In uniformly high-crime areas, comparing scores would always block detour generation.
    for (const best of [bestLeft, bestRight]) {
      if (!best) continue
      try {
        const detourResult = await fetchOsrmRoutes(fromLng, fromLat, toLng, toLat, best.lng, best.lat)
        if (detourResult[0]) {
          const detour = detourResult[0]
          // Reject only if detour is more than 70% longer than the direct route
          const detourKm = detour.distance / 1000
          if (detourKm <= directKm * 1.7) {
            detourRoutes.push(detour)
          }
        }
      } catch {
        // ignore individual detour failures (e.g. waypoint landed in water)
      }
    }
  }

  // ── Step 3: Score all routes in parallel ─────────────────────────────────
  const allOsrmRoutes = [...osrmRoutes, ...detourRoutes]

  // Assign labels: first OSRM route = "Fastest", last OSRM alternatives = "Alternative N", detours = "Safer Detour"
  const getLabel = (index: number, isDetour: boolean): string => {
    if (isDetour) return 'Safer Detour'
    if (index === 0) return 'Fastest'
    return `Alternative ${index}`
  }

  const scored = await Promise.all(
    allOsrmRoutes.map((r, i) => {
      const isDetour = i >= osrmRoutes.length
      return scoreRoute(
        supabase,
        r.geometry.coordinates,
        Math.round((r.distance / 1000) * 10) / 10,
        Math.round(r.duration / 60),
        hour,
        i,
        getLabel(i, isDetour)
      )
    })
  )

  // ── Step 4: Deduplicate similar routes ───────────────────────────────────
  const unique: RouteOption[] = []
  for (const route of scored) {
    const isDuplicate = unique.some(u => routesAreSimilar(u.routeGeometry, route.routeGeometry))
    if (!isDuplicate) unique.push(route)
  }

  // ── Step 5: Sort by safety score descending, re-assign sequential IDs ────
  unique.sort((a, b) => b.overallScore - a.overallScore)
  unique.forEach((r, i) => { r.id = i })
  unique[0].isSafest = true

  // ── Step 6: Determine recommended route ──────────────────────────────────
  // Recommend safest unless it's > 40% longer than the fastest (id=0 before sort was fastest)
  const fastest = unique.reduce((f, r) => r.durationMin < f.durationMin ? r : f, unique[0])
  const safest  = unique[0]
  const timePenalty = fastest.durationMin > 0
    ? (safest.durationMin - fastest.durationMin) / fastest.durationMin
    : 0

  const recommendedId = timePenalty <= 0.4 ? safest.id : fastest.id

  return NextResponse.json({ routes: unique, recommendedId })
}
