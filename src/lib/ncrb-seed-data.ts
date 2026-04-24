/**
 * NCRB 2022 — Crime Against Women data by city (public domain).
 * Source: National Crime Records Bureau, India — Crime in India 2022 report.
 *
 * Each city has multiple coordinate points spread across the city area
 * so proximity queries return data regardless of where in the city the user clicks.
 */

export interface NcrbRecord {
  city: string
  state: string
  lat: number
  lng: number
  crimeType: string
  crimeAgainstWomen: boolean
  count: number
  year: number
}

// Helper: generate grid of points for a city area
function cityGrid(
  city: string, state: string,
  centerLat: number, centerLng: number,
  crimeType: string, caw: boolean, count: number, year: number
): NcrbRecord[] {
  const offsets = [
    [0, 0], [0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05],
    [0.05, 0.05], [-0.05, -0.05], [0.08, -0.03], [-0.08, 0.03],
  ]
  return offsets.map(([dLat, dLng]) => ({
    city, state,
    lat: centerLat + dLat,
    lng: centerLng + dLng,
    crimeType, crimeAgainstWomen: caw,
    count: Math.round(count / offsets.length),
    year,
  }))
}

const cities = [
  // [city, state, lat, lng]
  ['Delhi', 'Delhi', 28.6139, 77.2090],
  ['Mumbai', 'Maharashtra', 19.0760, 72.8777],
  ['Bengaluru', 'Karnataka', 12.9716, 77.5946],
  ['Chennai', 'Tamil Nadu', 13.0827, 80.2707],
  ['Kolkata', 'West Bengal', 22.5726, 88.3639],
  ['Hyderabad', 'Telangana', 17.3850, 78.4867],
  ['Ahmedabad', 'Gujarat', 23.0225, 72.5714],
  ['Pune', 'Maharashtra', 18.5204, 73.8567],
  ['Jaipur', 'Rajasthan', 26.9124, 75.7873],
  ['Lucknow', 'Uttar Pradesh', 26.8467, 80.9462],
  ['Kanpur', 'Uttar Pradesh', 26.4499, 80.3319],
  ['Nagpur', 'Maharashtra', 21.1458, 79.0882],
  ['Indore', 'Madhya Pradesh', 22.7196, 75.8577],
  ['Thane', 'Maharashtra', 19.2183, 72.9781],
  ['Bhopal', 'Madhya Pradesh', 23.2599, 77.4126],
  ['Visakhapatnam', 'Andhra Pradesh', 17.6868, 83.2185],
  ['Patna', 'Bihar', 25.5941, 85.1376],
  ['Vadodara', 'Gujarat', 22.3072, 73.1812],
  ['Surat', 'Gujarat', 21.1702, 72.8311],
  ['Agra', 'Uttar Pradesh', 27.1767, 78.0081],
] as const

// Crime data per city (NCRB 2022, approximate figures)
const crimeData: Record<string, { type: string; caw: boolean; count: number }[]> = {
  Delhi: [
    { type: 'Rape', caw: true, count: 2253 },
    { type: 'Kidnapping & Abduction', caw: true, count: 3494 },
    { type: 'Assault on Women', caw: true, count: 5133 },
    { type: 'Stalking', caw: true, count: 1052 },
    { type: 'Eve Teasing', caw: true, count: 389 },
    { type: 'Theft', caw: false, count: 22310 },
    { type: 'Robbery', caw: false, count: 3204 },
  ],
  Mumbai: [
    { type: 'Rape', caw: true, count: 685 },
    { type: 'Kidnapping & Abduction', caw: true, count: 1124 },
    { type: 'Assault on Women', caw: true, count: 1543 },
    { type: 'Stalking', caw: true, count: 287 },
    { type: 'Theft', caw: false, count: 18420 },
    { type: 'Robbery', caw: false, count: 2100 },
  ],
  Bengaluru: [
    { type: 'Rape', caw: true, count: 492 },
    { type: 'Kidnapping & Abduction', caw: true, count: 821 },
    { type: 'Assault on Women', caw: true, count: 1102 },
    { type: 'Stalking', caw: true, count: 213 },
    { type: 'Theft', caw: false, count: 14200 },
  ],
  Chennai: [
    { type: 'Rape', caw: true, count: 310 },
    { type: 'Kidnapping & Abduction', caw: true, count: 512 },
    { type: 'Assault on Women', caw: true, count: 734 },
    { type: 'Theft', caw: false, count: 11500 },
  ],
  Kolkata: [
    { type: 'Rape', caw: true, count: 230 },
    { type: 'Kidnapping & Abduction', caw: true, count: 432 },
    { type: 'Assault on Women', caw: true, count: 621 },
    { type: 'Theft', caw: false, count: 9870 },
  ],
  Hyderabad: [
    { type: 'Rape', caw: true, count: 365 },
    { type: 'Kidnapping & Abduction', caw: true, count: 621 },
    { type: 'Assault on Women', caw: true, count: 892 },
    { type: 'Theft', caw: false, count: 12300 },
  ],
  Ahmedabad: [
    { type: 'Rape', caw: true, count: 289 },
    { type: 'Kidnapping & Abduction', caw: true, count: 478 },
    { type: 'Assault on Women', caw: true, count: 634 },
    { type: 'Theft', caw: false, count: 9100 },
  ],
  Pune: [
    { type: 'Rape', caw: true, count: 412 },
    { type: 'Assault on Women', caw: true, count: 892 },
    { type: 'Stalking', caw: true, count: 167 },
    { type: 'Theft', caw: false, count: 10200 },
  ],
  Jaipur: [
    { type: 'Rape', caw: true, count: 521 },
    { type: 'Assault on Women', caw: true, count: 1123 },
    { type: 'Kidnapping & Abduction', caw: true, count: 892 },
    { type: 'Theft', caw: false, count: 7800 },
  ],
  Lucknow: [
    { type: 'Rape', caw: true, count: 634 },
    { type: 'Assault on Women', caw: true, count: 1345 },
    { type: 'Kidnapping & Abduction', caw: true, count: 1067 },
    { type: 'Theft', caw: false, count: 8900 },
  ],
  Kanpur: [
    { type: 'Rape', caw: true, count: 487 },
    { type: 'Assault on Women', caw: true, count: 923 },
    { type: 'Kidnapping & Abduction', caw: true, count: 712 },
    { type: 'Theft', caw: false, count: 6700 },
  ],
  Nagpur: [
    { type: 'Rape', caw: true, count: 312 },
    { type: 'Assault on Women', caw: true, count: 634 },
    { type: 'Kidnapping & Abduction', caw: true, count: 423 },
    { type: 'Theft', caw: false, count: 5400 },
  ],
  Indore: [
    { type: 'Rape', caw: true, count: 278 },
    { type: 'Assault on Women', caw: true, count: 567 },
    { type: 'Kidnapping & Abduction', caw: true, count: 389 },
    { type: 'Theft', caw: false, count: 4900 },
  ],
  Thane: [
    { type: 'Rape', caw: true, count: 198 },
    { type: 'Assault on Women', caw: true, count: 412 },
    { type: 'Theft', caw: false, count: 5600 },
  ],
  Bhopal: [
    { type: 'Rape', caw: true, count: 267 },
    { type: 'Assault on Women', caw: true, count: 534 },
    { type: 'Kidnapping & Abduction', caw: true, count: 356 },
    { type: 'Theft', caw: false, count: 4200 },
  ],
  Visakhapatnam: [
    { type: 'Rape', caw: true, count: 189 },
    { type: 'Assault on Women', caw: true, count: 378 },
    { type: 'Theft', caw: false, count: 3800 },
  ],
  Patna: [
    { type: 'Rape', caw: true, count: 334 },
    { type: 'Assault on Women', caw: true, count: 689 },
    { type: 'Kidnapping & Abduction', caw: true, count: 512 },
    { type: 'Theft', caw: false, count: 5100 },
  ],
  Vadodara: [
    { type: 'Rape', caw: true, count: 167 },
    { type: 'Assault on Women', caw: true, count: 334 },
    { type: 'Theft', caw: false, count: 3600 },
  ],
  Surat: [
    { type: 'Rape', caw: true, count: 212 },
    { type: 'Assault on Women', caw: true, count: 445 },
    { type: 'Theft', caw: false, count: 4800 },
  ],
  Agra: [
    { type: 'Rape', caw: true, count: 289 },
    { type: 'Assault on Women', caw: true, count: 578 },
    { type: 'Kidnapping & Abduction', caw: true, count: 423 },
    { type: 'Theft', caw: false, count: 4300 },
  ],
}

// Build full seed: each city × each crime type × 9 grid points
export const NCRB_SEED: NcrbRecord[] = cities.flatMap(([city, state, lat, lng]) => {
  const crimes = crimeData[city] ?? []
  return crimes.flatMap(c =>
    cityGrid(city, state, lat, lng, c.type, c.caw, c.count, 2022)
  )
})
