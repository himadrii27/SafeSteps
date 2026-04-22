import { NextRequest, NextResponse } from 'next/server'

// GET /api/geocode?q=Connaught+Place+Delhi
// Nominatim (OpenStreetMap) — free, no key required
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  if (!q) {
    return NextResponse.json({ error: 'q is required' }, { status: 400 })
  }

  const params = new URLSearchParams({
    q: `${q}, India`,
    format: 'json',
    limit: '5',
    addressdetails: '1',
    countrycodes: 'in',
  })

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        'User-Agent': 'WomenSafetyMap/1.0 (safety-map-india)',
        'Accept-Language': 'en',
      },
      next: { revalidate: 3600 }, // cache 1h
    }
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 })
  }

  const data = await res.json()
  const results = data.map((item: {
    place_id: number
    display_name: string
    lat: string
    lon: string
    address: { city?: string; state?: string; county?: string }
  }) => ({
    placeId: item.place_id,
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    city: item.address?.city ?? item.address?.county ?? '',
    state: item.address?.state ?? '',
  }))

  return NextResponse.json({ results })
}
