/**
 * Computes a women's safety score (1–10, higher = safer) for a lat/lng.
 * Aggregates from NCRB seeded data + crowd reports within radius km.
 *
 * Scoring approach:
 *  1. Weighted crime density — women crimes count 2× for severity
 *  2. Coverage area derived from the actual geographic spread of returned points
 *  3. Continuous log₁₀ scale → score (two-anchor formula, calibrated to 20-city dataset)
 *  4. Optional time-of-day multiplier per crime type
 *  5. Mild women-ratio penalty
 *
 * Calibration (city-grid spread ≈ 172 km²):
 *   Delhi    density ≈ 190 → score ≈ 2.0  (very high risk)
 *   Vadodara density ≈  17 → score ≈ 7.5  (safe)
 *   Rural / no data          → score  9.5  (default)
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

export interface TrendData {
  direction: 'improving' | 'worsening' | 'stable'
  percentChange: number       // positive = score going up (safer), negative = going down
  yearlyScores: Record<number, number>
  sparkline: number[]         // scores ordered oldest → newest, normalised 0–1
}

const CURRENT_YEAR = new Date().getFullYear()

function recencyWeight(year: number): number {
  const age = CURRENT_YEAR - year
  if (age <= 1) return 1.0
  if (age <= 2) return 0.9
  if (age <= 3) return 0.8
  if (age <= 5) return 0.65
  if (age <= 8) return 0.45
  return 0.25
}

// ─── Time-of-day multipliers ───────────────────────────────────────────────
// Based on established criminology patterns (NCRB day/night shift data).
// A multiplier > 1 means that crime type is more prevalent at the given hour.
// Multiplied into the weighted density so the score drops at higher-risk hours.

const TIME_MULTIPLIERS: Record<string, (h: number) => number> = {
  'Rape':                (h) => isLateNight(h) ? 2.0 : isEvening(h) ? 1.5 : 1.0,
  'Assault on Women':    (h) => isLateNight(h) ? 2.5 : isEvening(h) ? 1.8 : 1.0,
  'Stalking':            (h) => isLateNight(h) ? 2.0 : isEvening(h) ? 1.6 : 1.0,
  'Eve Teasing':         (h) => isEvening(h) ? 2.0 : isLateNight(h) ? 1.3 : 1.0,
  'Kidnapping & Abduction': (h) => isLateNight(h) ? 1.8 : isEvening(h) ? 1.3 : 1.0,
  'Robbery':             (h) => isLateNight(h) ? 2.0 : isEvening(h) ? 1.5 : 1.0,
  'Theft':               (h) => isLateNight(h) ? 1.4 : isEvening(h) ? 1.2 : 1.0,
  'Murder':              (h) => isLateNight(h) ? 1.6 : isEvening(h) ? 1.2 : 1.0,
}

function isLateNight(h: number) { return h >= 22 || h < 5 }
function isEvening(h: number)   { return h >= 18 && h < 22 }

function getTimeMultiplier(crimeType: string, hour: number): number {
  const fn = TIME_MULTIPLIERS[crimeType]
  return fn ? fn(hour) : 1.0
}

// ─── Coverage area ──────────────────────────────────────────────────────────

function computeCoverageArea(crimes: CrimePoint[], queryRadiusKm: number): number {
  const queryArea = Math.PI * queryRadiusKm * queryRadiusKm
  if (crimes.length < 3) return queryArea

  const lats = crimes.map(c => c.latitude)
  const lngs = crimes.map(c => c.longitude)
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length
  const latRangeKm = (Math.max(...lats) - Math.min(...lats)) * 111
  const lngRangeKm =
    (Math.max(...lngs) - Math.min(...lngs)) * 111 * Math.cos((centerLat * Math.PI) / 180)

  return Math.max(latRangeKm * lngRangeKm, queryArea, 1)
}

// ─── Score formula ───────────────────────────────────────────────────────────
// Two-anchor log formula: a − k·log₁₀(density+1)
// Anchors: Vadodara (density≈17) → 7.5, Delhi (density≈190) → 2.0
const LOG_K = 5.42
const LOG_A = 14.36

function densityToScore(density: number): number {
  if (density <= 0) return 9.5
  return Math.max(1, Math.min(9.5, LOG_A - LOG_K * Math.log10(density + 1)))
}

// ─── Main scoring function ───────────────────────────────────────────────────

export function computeSafetyScore(
  crimes: CrimePoint[],
  reports: ReportPoint[],
  radiusKm: number,
  hour?: number   // 0–23; if omitted, no time adjustment
): SafetyBreakdown {
  const areaKm2 = computeCoverageArea(crimes, radiusKm)

  let weightedTotal = 0
  let weightedWomen = 0
  const crimeTypeMap: Record<string, number> = {}

  for (const c of crimes) {
    const rw = recencyWeight(c.year)
    const severityW = c.crimeAgainstWomen ? 2 : 1
    const timeW = hour !== undefined ? getTimeMultiplier(c.crimeType, hour) : 1
    const w = rw * severityW * timeW
    weightedTotal += c.count * w
    if (c.crimeAgainstWomen) weightedWomen += c.count * w
    crimeTypeMap[c.crimeType] = (crimeTypeMap[c.crimeType] ?? 0) + c.count
  }

  let reportWeight = 0
  for (const r of reports) {
    const ageDays = (Date.now() - new Date(r.reportedAt).getTime()) / 86_400_000
    const recency = ageDays < 30 ? 1.5 : ageDays < 180 ? 1.0 : 0.5
    reportWeight += recency * (1 + r.upvotes * 0.1)
  }

  const density = (weightedTotal + reportWeight * 10) / areaKm2
  let score = densityToScore(density)

  if (weightedTotal > 0) {
    const womenRatio = weightedWomen / weightedTotal
    score = Math.max(1, score - womenRatio * 0.5)
  }

  score = Math.round(score * 10) / 10

  const level: SafetyBreakdown['level'] =
    score >= 6.5 ? 'safe' : score >= 3.5 ? 'moderate' : 'unsafe'

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

// ─── Trend analysis ───────────────────────────────────────────────────────────

export function computeTrend(crimes: CrimePoint[], radiusKm: number): TrendData {
  // Group crimes by year
  const byYear: Record<number, CrimePoint[]> = {}
  for (const c of crimes) {
    ;(byYear[c.year] ??= []).push(c)
  }

  const years = Object.keys(byYear).map(Number).sort()
  const yearlyScores: Record<number, number> = {}

  for (const y of years) {
    const breakdown = computeSafetyScore(byYear[y], [], radiusKm)
    yearlyScores[y] = breakdown.score
  }

  // Direction: compare latest two available years
  let direction: TrendData['direction'] = 'stable'
  let percentChange = 0

  if (years.length >= 2) {
    const latest = yearlyScores[years[years.length - 1]]
    const prev   = yearlyScores[years[years.length - 2]]
    percentChange = Math.round(((latest - prev) / prev) * 100)
    if (percentChange > 3)  direction = 'improving'
    if (percentChange < -3) direction = 'worsening'
  }

  // Normalise scores to 0–1 for sparkline
  const scores = years.map(y => yearlyScores[y])
  const minS = Math.min(...scores)
  const maxS = Math.max(...scores)
  const sparkline = scores.map(s => maxS > minS ? (s - minS) / (maxS - minS) : 0.5)

  return { direction, percentChange, yearlyScores, sparkline }
}

export function scoreToLabel(score: number): string {
  if (score >= 8)   return 'Very Safe'
  if (score >= 6.5) return 'Safe'
  if (score >= 5)   return 'Moderate'
  if (score >= 3.5) return 'Caution'
  if (score >= 2)   return 'High Risk'
  return 'Very High Risk'
}
