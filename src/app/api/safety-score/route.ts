import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeSafetyScore, scoreToLabel } from '@/lib/safety-score'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// GET /api/safety-score?lat=28.6&lng=77.2&radius=3
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const radius = parseFloat(searchParams.get('radius') ?? '3')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const delta = radius / 111

  const [crimes, reports] = await Promise.all([
    prisma.crime.findMany({
      where: {
        latitude: { gte: lat - delta, lte: lat + delta },
        longitude: { gte: lng - delta, lte: lng + delta },
      },
    }),
    prisma.report.findMany({
      where: {
        latitude: { gte: lat - delta, lte: lat + delta },
        longitude: { gte: lng - delta, lte: lng + delta },
        verified: true,
      },
    }),
  ])

  const breakdown = computeSafetyScore(crimes, reports, radius)
  const label = scoreToLabel(breakdown.score)

  // AI summary (only if API key set and data available)
  let aiSummary: string | null = null
  if (process.env.ANTHROPIC_API_KEY && crimes.length > 0) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `You are a women's safety advisor for India. Based on this crime data within ${radius}km radius, write a 2-sentence safety summary for women. Be factual, helpful, and not alarmist.

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
      // Non-critical — skip AI summary if API fails
    }
  }

  return NextResponse.json({
    lat,
    lng,
    radius,
    ...breakdown,
    label,
    aiSummary,
  })
}
