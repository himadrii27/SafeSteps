import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/reports — submit a crowd report
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { latitude, longitude, address, incidentType, description, anonymous, reportedAt } = body

    if (!latitude || !longitude || !incidentType || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const report = await prisma.report.create({
      data: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address ?? null,
        incidentType,
        description,
        anonymous: anonymous ?? false,
        reportedAt: reportedAt ? new Date(reportedAt) : new Date(),
        verified: false, // goes into moderation queue
      },
    })

    return NextResponse.json({ success: true, id: report.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
  }
}

// GET /api/reports?lat=&lng=&radius= — list verified reports
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const radius = parseFloat(searchParams.get('radius') ?? '5')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  const delta = radius / 111
  const reports = await prisma.report.findMany({
    where: {
      latitude: { gte: lat - delta, lte: lat + delta },
      longitude: { gte: lng - delta, lte: lng + delta },
      verified: true,
    },
    orderBy: { reportedAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ reports })
}
