import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// POST /api/reports — submit a crowd report
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { latitude, longitude, address, incidentType, description, anonymous, reportedAt } = body

    if (!latitude || !longitude || !incidentType || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate coordinate ranges (India bounding box)
    const parsedLat = parseFloat(latitude)
    const parsedLng = parseFloat(longitude)
    if (isNaN(parsedLat) || isNaN(parsedLng) ||
        parsedLat < 6 || parsedLat > 38 ||
        parsedLng < 68 || parsedLng > 98) {
      return NextResponse.json({ error: 'Coordinates out of range' }, { status: 400 })
    }

    // Enforce length limits to prevent abuse
    if (typeof description !== 'string' || description.length > 2000) {
      return NextResponse.json({ error: 'Description must be under 2000 characters' }, { status: 400 })
    }
    if (typeof incidentType !== 'string' || incidentType.length > 100) {
      return NextResponse.json({ error: 'Invalid incident type' }, { status: 400 })
    }
    const safeAddress = typeof address === 'string' ? address.slice(0, 300) : null

    const supabase = createServerClient()
    const { data, error } = await supabase.from('reports').insert({
      latitude: parsedLat,
      longitude: parsedLng,
      address: safeAddress,
      incident_type: incidentType,
      description,
      anonymous: anonymous ?? false,
      reported_at: reportedAt ?? new Date().toISOString(),
      verified: false,
    }).select('id').single()

    if (error) throw error
    return NextResponse.json({ success: true, id: data.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
  }
}

// GET /api/reports?lat=&lng=&radius=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const radius = Math.min(50, Math.max(0.1, parseFloat(searchParams.get('radius') ?? '5')))

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  const delta = radius / 111
  const supabase = createServerClient()

  const { data: reports } = await supabase
    .from('reports')
    .select('*')
    .gte('latitude', lat - delta).lte('latitude', lat + delta)
    .gte('longitude', lng - delta).lte('longitude', lng + delta)
    .eq('verified', true)
    .order('reported_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ reports: reports ?? [] })
}
