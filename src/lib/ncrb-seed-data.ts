/**
 * NCRB 2022 — Crime Against Women data by city (public domain).
 * Source: National Crime Records Bureau, India — Crime in India 2022.
 * Used to seed the database with baseline data.
 *
 * Fields: city, state, lat, lng, crimeType, count (year 2022)
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

export const NCRB_SEED: NcrbRecord[] = [
  // Delhi
  { city: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, crimeType: 'Rape', crimeAgainstWomen: true, count: 2253, year: 2022 },
  { city: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, crimeType: 'Kidnapping & Abduction', crimeAgainstWomen: true, count: 3494, year: 2022 },
  { city: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, crimeType: 'Assault on Women', crimeAgainstWomen: true, count: 5133, year: 2022 },
  { city: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, crimeType: 'Stalking', crimeAgainstWomen: true, count: 1052, year: 2022 },
  { city: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, crimeType: 'Eve Teasing', crimeAgainstWomen: true, count: 389, year: 2022 },
  { city: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, crimeType: 'Theft', crimeAgainstWomen: false, count: 22310, year: 2022 },
  { city: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, crimeType: 'Robbery', crimeAgainstWomen: false, count: 3204, year: 2022 },

  // Mumbai
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777, crimeType: 'Rape', crimeAgainstWomen: true, count: 685, year: 2022 },
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777, crimeType: 'Kidnapping & Abduction', crimeAgainstWomen: true, count: 1124, year: 2022 },
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777, crimeType: 'Assault on Women', crimeAgainstWomen: true, count: 1543, year: 2022 },
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777, crimeType: 'Stalking', crimeAgainstWomen: true, count: 287, year: 2022 },
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777, crimeType: 'Theft', crimeAgainstWomen: false, count: 18420, year: 2022 },

  // Bengaluru
  { city: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, crimeType: 'Rape', crimeAgainstWomen: true, count: 492, year: 2022 },
  { city: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, crimeType: 'Kidnapping & Abduction', crimeAgainstWomen: true, count: 821, year: 2022 },
  { city: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, crimeType: 'Assault on Women', crimeAgainstWomen: true, count: 1102, year: 2022 },
  { city: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, crimeType: 'Stalking', crimeAgainstWomen: true, count: 213, year: 2022 },
  { city: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, crimeType: 'Theft', crimeAgainstWomen: false, count: 14200, year: 2022 },

  // Chennai
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, crimeType: 'Rape', crimeAgainstWomen: true, count: 310, year: 2022 },
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, crimeType: 'Kidnapping & Abduction', crimeAgainstWomen: true, count: 512, year: 2022 },
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, crimeType: 'Assault on Women', crimeAgainstWomen: true, count: 734, year: 2022 },
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, crimeType: 'Theft', crimeAgainstWomen: false, count: 11500, year: 2022 },

  // Kolkata
  { city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639, crimeType: 'Rape', crimeAgainstWomen: true, count: 230, year: 2022 },
  { city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639, crimeType: 'Kidnapping & Abduction', crimeAgainstWomen: true, count: 432, year: 2022 },
  { city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639, crimeType: 'Assault on Women', crimeAgainstWomen: true, count: 621, year: 2022 },
  { city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639, crimeType: 'Theft', crimeAgainstWomen: false, count: 9870, year: 2022 },

  // Hyderabad
  { city: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867, crimeType: 'Rape', crimeAgainstWomen: true, count: 365, year: 2022 },
  { city: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867, crimeType: 'Kidnapping & Abduction', crimeAgainstWomen: true, count: 621, year: 2022 },
  { city: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867, crimeType: 'Assault on Women', crimeAgainstWomen: true, count: 892, year: 2022 },
  { city: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867, crimeType: 'Theft', crimeAgainstWomen: false, count: 12300, year: 2022 },

  // Ahmedabad
  { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714, crimeType: 'Rape', crimeAgainstWomen: true, count: 289, year: 2022 },
  { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714, crimeType: 'Kidnapping & Abduction', crimeAgainstWomen: true, count: 478, year: 2022 },
  { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714, crimeType: 'Assault on Women', crimeAgainstWomen: true, count: 634, year: 2022 },

  // Pune
  { city: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, crimeType: 'Rape', crimeAgainstWomen: true, count: 412, year: 2022 },
  { city: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, crimeType: 'Assault on Women', crimeAgainstWomen: true, count: 892, year: 2022 },
  { city: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, crimeType: 'Stalking', crimeAgainstWomen: true, count: 167, year: 2022 },

  // Jaipur
  { city: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873, crimeType: 'Rape', crimeAgainstWomen: true, count: 521, year: 2022 },
  { city: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873, crimeType: 'Assault on Women', crimeAgainstWomen: true, count: 1123, year: 2022 },
  { city: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873, crimeType: 'Kidnapping & Abduction', crimeAgainstWomen: true, count: 892, year: 2022 },

  // Lucknow
  { city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462, crimeType: 'Rape', crimeAgainstWomen: true, count: 634, year: 2022 },
  { city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462, crimeType: 'Assault on Women', crimeAgainstWomen: true, count: 1345, year: 2022 },
  { city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462, crimeType: 'Kidnapping & Abduction', crimeAgainstWomen: true, count: 1067, year: 2022 },
]
