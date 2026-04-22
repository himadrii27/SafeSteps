/**
 * Computes a women's safety score (1–10, higher = safer) for a lat/lng.
 * Aggregates from NCRB seeded data + crowd reports within radius km.
 */

export interface CrimePoint {
  latitude: number
  longitude: number
  crimeType: string
  crimeAgainstWomen: boolean
  year: number
  count: number
  source: string
}

export interface ReportPoint {
  latitude: number
  longitude: number
  incidentType: string
  upvotes: number
  reportedAt: Date
}

export interface SafetyBreakdown {
  score: number               // 1–10
  level: 'safe' | 'moderate' | 'unsafe'
  color: string               // hex
  totalCrimes: number
  womenCrimes: number
  crowdReports: number
  topCrimeTypes: string[]
  radiusKm: number
}

const CURRENT_YEAR = new Date().getFullYear()

function recencyWeight(year: number): number {
  const age = CURRENT_YEAR - year
  if (age <= 1) return 1.0
  if (age <= 3) return 0.7
  if (age <= 5) return 0.5
  return 0.3
}

export function computeSafetyScore(
  crimes: CrimePoint[],
  reports: ReportPoint[],
  radiusKm: number
): SafetyBreakdown {
  const areaKm2 = Math.PI * radiusKm * radiusKm

  // Weighted crime density
  let weightedCrimes = 0
  let weightedWomenCrimes = 0
  const crimeTypeMap: Record<string, number> = {}

  for (const c of crimes) {
    const w = recencyWeight(c.year) * (c.crimeAgainstWomen ? 2 : 1)
    weightedCrimes += c.count * w
    if (c.crimeAgainstWomen) weightedWomenCrimes += c.count * w
    crimeTypeMap[c.crimeType] = (crimeTypeMap[c.crimeType] ?? 0) + c.count
  }

  // Crowd report contribution
  let reportWeight = 0
  for (const r of reports) {
    const ageMs = Date.now() - new Date(r.reportedAt).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    const recency = ageDays < 30 ? 1.5 : ageDays < 180 ? 1.0 : 0.5
    reportWeight += recency * (1 + r.upvotes * 0.1)
  }

  const densityScore = (weightedCrimes + reportWeight * 5) / areaKm2

  // Map density → score (lower density = higher safety score)
  // Calibrated for Indian cities: ~5–50 incidents/km² is typical range
  let score: number
  if (densityScore === 0) {
    score = 9.5
  } else if (densityScore < 1) {
    score = 8.5
  } else if (densityScore < 3) {
    score = 7.0
  } else if (densityScore < 8) {
    score = 5.5
  } else if (densityScore < 20) {
    score = 4.0
  } else if (densityScore < 50) {
    score = 2.5
  } else {
    score = 1.5
  }

  // Women crime ratio penalty
  const womenRatio = weightedCrimes > 0 ? weightedWomenCrimes / weightedCrimes : 0
  score = Math.max(1, score - womenRatio * 2)
  score = Math.round(score * 10) / 10

  const level: SafetyBreakdown['level'] =
    score >= 7 ? 'safe' : score >= 4 ? 'moderate' : 'unsafe'

  const color = level === 'safe' ? '#22c55e' : level === 'moderate' ? '#f59e0b' : '#ef4444'

  const topCrimeTypes = Object.entries(crimeTypeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t)

  return {
    score,
    level,
    color,
    totalCrimes: crimes.reduce((s, c) => s + c.count, 0),
    womenCrimes: crimes.filter(c => c.crimeAgainstWomen).reduce((s, c) => s + c.count, 0),
    crowdReports: reports.length,
    topCrimeTypes,
    radiusKm,
  }
}

export function scoreToLabel(score: number): string {
  if (score >= 8) return 'Very Safe'
  if (score >= 6.5) return 'Safe'
  if (score >= 5) return 'Moderate'
  if (score >= 3) return 'Caution'
  return 'High Risk'
}
