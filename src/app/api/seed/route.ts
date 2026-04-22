import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NCRB_SEED } from '@/lib/ncrb-seed-data'

// POST /api/seed — one-time DB seed (protect with secret)
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-seed-secret')
  if (secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.crime.deleteMany({ where: { source: 'ncrb' } })

  const created = await prisma.crime.createMany({
    data: NCRB_SEED.map(r => ({
      latitude: r.lat,
      longitude: r.lng,
      city: r.city,
      state: r.state,
      crimeType: r.crimeType,
      crimeAgainstWomen: r.crimeAgainstWomen,
      year: r.year,
      count: r.count,
      source: 'ncrb',
    })),
    skipDuplicates: true,
  })

  return NextResponse.json({ seeded: created.count })
}
