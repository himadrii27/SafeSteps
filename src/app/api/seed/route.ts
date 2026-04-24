import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { NCRB_SEED } from '@/lib/ncrb-seed-data'

// POST /api/seed — one-time DB seed (protect with secret)
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-seed-secret')
  if (secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  await supabase.from('crimes').delete().eq('source', 'ncrb')

  const { error } = await supabase.from('crimes').insert(
    NCRB_SEED.map(r => ({
      latitude: r.lat,
      longitude: r.lng,
      city: r.city,
      state: r.state,
      crime_type: r.crimeType,
      crime_against_women: r.crimeAgainstWomen,
      year: r.year,
      count: r.count,
      source: 'ncrb',
    }))
  )
  const count = NCRB_SEED.length

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ seeded: count })
}
