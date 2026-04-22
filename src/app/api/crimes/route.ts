import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/crimes?lat=28.6&lng=77.2&radius=5
// Returns crime points within radius km of lat/lng
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const radius = parseFloat(searchParams.get('radius') ?? '5') // km

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  // Approximate bounding box (1 degree ≈ 111 km)
  const delta = radius / 111
  const crimes = await prisma.crime.findMany({
    where: {
      latitude: { gte: lat - delta, lte: lat + delta },
      longitude: { gte: lng - delta, lte: lng + delta },
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      city: true,
      state: true,
      crimeType: true,
      crimeAgainstWomen: true,
      year: true,
      count: true,
      source: true,
    },
    orderBy: { year: 'desc' },
    take: 500,
  })

  const reports = await prisma.report.findMany({
    where: {
      latitude: { gte: lat - delta, lte: lat + delta },
      longitude: { gte: lng - delta, lte: lng + delta },
      verified: true,
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      incidentType: true,
      upvotes: true,
      reportedAt: true,
    },
    orderBy: { reportedAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ crimes, reports })
}
