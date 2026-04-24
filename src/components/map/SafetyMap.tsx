'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { SafetyPanel } from './SafetyPanel'
import { SearchBar } from './SearchBar'
import { AlertBanner } from './AlertBanner'
import { ReportButton } from './ReportButton'
import { TimeSlider } from './TimeSlider'
import { RouteChecker } from './RouteChecker'
import type { TrendData } from '@/lib/safety-score'

interface SafetyData {
  lat: number
  lng: number
  score: number
  level: 'safe' | 'moderate' | 'unsafe'
  color: string
  label: string
  totalCrimes: number
  womenCrimes: number
  crowdReports: number
  topCrimeTypes: string[]
  aiSummary: string | null
  trend?: TrendData
}

interface RouteOption {
  id: number
  routeGeometry: [number, number][]
  waypoints: Array<{ lat: number; lng: number; score: number; level: string; color: string }>
  distanceKm: number
  durationMin: number
  overallScore: number
  overallColor: string
  overallLevel: string
  riskySegments: number
  cautiousSegments: number
  isSafest: boolean
}

interface MultiRouteResult {
  routes: RouteOption[]
  recommendedId: number
}

interface CrimePoint {
  id: string
  latitude: number
  longitude: number
  crimeType: string
  crimeAgainstWomen: boolean
  year: number
  count: number
}

export function SafetyMap() {
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const mapContainer = useRef<HTMLDivElement>(null)
  const userMarkerRef = useRef<import('leaflet').CircleMarker | null>(null)
  const pinMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const heatLayerRef = useRef<unknown>(null)
  const crimeLayersRef = useRef<import('leaflet').CircleMarker[]>([])
  const watchIdRef = useRef<number | null>(null)

  const [safetyData, setSafetyData] = useState<SafetyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [hour, setHour] = useState<number>(new Date().getHours())
  const routeLayersRef = useRef<import('leaflet').Polyline[]>([])

  const fetchSafety = useCallback(async (lat: number, lng: number, overrideHour?: number) => {
    setLoading(true)
    const h = overrideHour ?? hour
    try {
      const [safetyRes, crimesRes] = await Promise.all([
        fetch(`/api/safety-score?lat=${lat}&lng=${lng}&radius=3&hour=${h}`),
        fetch(`/api/crimes?lat=${lat}&lng=${lng}&radius=5`),
      ])
      const data: SafetyData = await safetyRes.json()
      const { crimes }: { crimes: CrimePoint[] } = await crimesRes.json()

      setSafetyData(data)
      setPanelOpen(true)

      if (data.level === 'unsafe') {
        setAlert(`High risk area! Safety score: ${data.score}/10. Exercise extra caution.`)
      } else if (data.level === 'moderate') {
        setAlert(`Moderate risk area. Safety score: ${data.score}/10. Stay aware of surroundings.`)
      } else {
        setAlert(null)
      }

      updateHeatmap(crimes)
    } catch (err) {
      console.error('Safety fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateHeatmap = (crimes: CrimePoint[]) => {
    if (!mapRef.current) return
    const L = (window as typeof window & { L: typeof import('leaflet') }).L

    // Remove old crime markers
    crimeLayersRef.current.forEach(m => m.remove())
    crimeLayersRef.current = []

    // Remove old heat layer
    if (heatLayerRef.current) {
      (heatLayerRef.current as import('leaflet').Layer).remove()
      heatLayerRef.current = null
    }

    if (crimes.length === 0) return

    // Build heatmap points [lat, lng, intensity]
    const heatPoints = crimes.map(c => [
      c.latitude,
      c.longitude,
      Math.min(1, (c.count * (c.crimeAgainstWomen ? 2 : 1)) / 200),
    ])

    const zoom = mapRef.current.getZoom()
    // Scale radius with zoom so it looks smooth at all levels
    const radius = zoom <= 8 ? 80 : zoom <= 11 ? 60 : zoom <= 13 ? 45 : 30

    // @ts-expect-error leaflet.heat not typed
    if (L.heatLayer) {
      // @ts-expect-error leaflet.heat not typed
      heatLayerRef.current = L.heatLayer(heatPoints, {
        radius,
        blur: radius * 0.8,
        maxZoom: 17,
        max: 1.0,
        gradient: { 0.0: '#22c55e', 0.3: '#eab308', 0.55: '#f97316', 0.75: '#ef4444', 1.0: '#991b1b' },
      }).addTo(mapRef.current)
    }

    // Crime dot markers at high zoom (added but only visible at zoom 13+)
    crimes.forEach(c => {
      const marker = L.circleMarker([c.latitude, c.longitude], {
        radius: 6,
        fillColor: c.crimeAgainstWomen ? '#ef4444' : '#f97316',
        color: '#fff',
        weight: 1,
        fillOpacity: 0.85,
      })
        .bindPopup(`
          <div style="font-size:13px;padding:4px">
            <strong>${c.crimeType}</strong><br/>
            Year: ${c.year} &nbsp;|&nbsp; Cases: ${c.count}<br/>
            ${c.crimeAgainstWomen ? '<span style="color:#ef4444">⚠ Crime against women</span>' : ''}
          </div>
        `)

      // Only show at zoom ≥ 13
      mapRef.current!.on('zoomend', () => {
        if (mapRef.current!.getZoom() >= 13) {
          marker.addTo(mapRef.current!)
        } else {
          marker.remove()
        }
      })

      crimeLayersRef.current.push(marker)
    })
  }

  // Init Leaflet map
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return

    const initMap = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      await import('leaflet.heat')

      // Guard against React strict mode double-init
      if (mapRef.current || (mapContainer.current as HTMLElement & { _leaflet_id?: number })._leaflet_id) return

      // Fix default marker icons broken by webpack
      // @ts-expect-error _getIconUrl
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // Expose L globally for heatLayer access in callbacks
      ;(window as typeof window & { L: typeof L }).L = L

      const map = L.map(mapContainer.current!, {
        center: [20.5937, 78.9629], // India center
        zoom: 5,
        zoomControl: false,
      })

      // OSM dark-ish tile layer (free, no API key)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map)

      // Custom zoom control (bottom right)
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Click to check any location
      map.on('click', (e) => {
        const { lat, lng } = e.latlng

        if (pinMarkerRef.current) pinMarkerRef.current.remove()
        pinMarkerRef.current = L.marker([lat, lng]).addTo(map)

        fetchSafety(lat, lng)
      })

      // Redraw heatmap on zoom so radius scales correctly
      map.on('zoomend', () => {
        if (heatLayerRef.current) {
          const zoom = map.getZoom()
          const radius = zoom <= 8 ? 80 : zoom <= 11 ? 60 : zoom <= 13 ? 45 : 30
          ;(heatLayerRef.current as { setOptions: (o: object) => void }).setOptions?.({ radius, blur: radius * 0.8 })
        }
      })

      mapRef.current = map

      // Auto-detect location on load
      autoLocate(map, L)
    }

    initMap()

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current)
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [fetchSafety])

  const autoLocate = (map: import('leaflet').Map, L: typeof import('leaflet')) => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCurrentLocation({ lat, lng })
        map.flyTo([lat, lng], 13, { duration: 1.5 })
        placeUserMarker(map, L, lat, lng)
        fetchSafety(lat, lng)
        setLocating(false)
        startWatching(map, L)
      },
      () => setLocating(false), // silently fail — user can click locate button
      { timeout: 8000 }
    )
  }

  const placeUserMarker = (
    map: import('leaflet').Map,
    L: typeof import('leaflet'),
    lat: number,
    lng: number
  ) => {
    if (userMarkerRef.current) userMarkerRef.current.remove()
    userMarkerRef.current = L.circleMarker([lat, lng], {
      radius: 9,
      fillColor: '#3b82f6',
      color: '#fff',
      weight: 3,
      fillOpacity: 1,
    })
      .bindTooltip('You are here', { permanent: false })
      .addTo(map)
  }

  const startWatching = (map: import('leaflet').Map, L: typeof import('leaflet')) => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCurrentLocation({ lat, lng })
        placeUserMarker(map, L, lat, lng)
      },
      undefined,
      { enableHighAccuracy: true }
    )
  }

  const handleLocate = async () => {
    if (!mapRef.current) return
    const L = (await import('leaflet')).default
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCurrentLocation({ lat, lng })
        mapRef.current!.flyTo([lat, lng], 14, { duration: 1.5 })
        placeUserMarker(mapRef.current!, L, lat, lng)
        fetchSafety(lat, lng)
        setLocating(false)
        startWatching(mapRef.current!, L)
      },
      () => {
        setAlert('Location access denied. Please allow location in browser settings.')
        setLocating(false)
      }
    )
  }

  const handleSearch = (lat: number, lng: number) => {
    mapRef.current?.flyTo([lat, lng], 13, { duration: 1.5 })
    fetchSafety(lat, lng)
  }

  const handleHourChange = (newHour: number) => {
    setHour(newHour)
    // Re-fetch safety for current pin if panel is open
    if (safetyData && panelOpen) {
      fetchSafety(safetyData.lat, safetyData.lng, newHour)
    }
  }

  const handleRouteResult = (result: MultiRouteResult | null) => {
    if (!mapRef.current) return
    const L = (window as typeof window & { L: typeof import('leaflet') }).L
    if (!L) return

    // Clear old route layers
    routeLayersRef.current.forEach(l => l.remove())
    routeLayersRef.current = []

    if (!result || !result.routes || result.routes.length === 0) return

    const selectedId = result.recommendedId
    const selectedRoute = result.routes.find(r => r.id === selectedId) ?? result.routes[0]

    // Draw non-selected routes as dimmed grey dashed lines first (under selected)
    for (const route of result.routes) {
      if (route.id === selectedId) continue
      const altLine = L.polyline(
        route.routeGeometry.map(([lng, lat]) => [lat, lng] as [number, number]),
        { color: '#ffffff', weight: 3, opacity: 0.15, dashArray: '6 8', interactive: false }
      ).addTo(mapRef.current)
      routeLayersRef.current.push(altLine)
    }

    // Draw selected route: grey base line, then colored waypoint segments on top
    const baseLine = L.polyline(
      selectedRoute.routeGeometry.map(([lng, lat]) => [lat, lng] as [number, number]),
      { color: '#ffffff20', weight: 5, interactive: false }
    ).addTo(mapRef.current)
    routeLayersRef.current.push(baseLine)

    const wps = selectedRoute.waypoints
    for (let i = 0; i < wps.length - 1; i++) {
      const seg = L.polyline(
        [[wps[i].lat, wps[i].lng], [wps[i + 1].lat, wps[i + 1].lng]],
        { color: wps[i].color, weight: 6, opacity: 0.9 }
      ).addTo(mapRef.current)
      routeLayersRef.current.push(seg)
    }

    // Fit map to selected route
    if (wps.length > 0) {
      mapRef.current.fitBounds(
        wps.map(w => [w.lat, w.lng] as [number, number]),
        { padding: [40, 40] }
      )
    }
  }

  return (
    <div className="relative w-full h-screen bg-gray-950">
      {/* Map */}
      <div ref={mapContainer} className="w-full h-full z-0" />

      {/* Search bar — top-center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-10 flex gap-2">
        <SearchBar onSelect={handleSearch} />
        <button
          onClick={handleLocate}
          disabled={locating}
          className="flex-shrink-0 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-60"
          title="Use my location"
        >
          {locating ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin block" />
          ) : '📍'}
        </button>
      </div>

      {/* Route checker — top-right, independent so it never overlaps the safety panel */}
      <div className="absolute top-4 right-4 z-20">
        <RouteChecker hour={hour} onRouteResult={handleRouteResult} />
      </div>

      {/* Time slider — bottom-center, sits above the legend strip */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 w-72">
        <TimeSlider hour={hour} onChange={handleHourChange} />
      </div>

      {/* Alert banner */}
      {alert && <AlertBanner message={alert} onDismiss={() => setAlert(null)} />}

      {/* Safety panel */}
      <SafetyPanel
        data={safetyData}
        loading={loading}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
      />

      {/* Report button */}
      <ReportButton currentLocation={currentLocation} />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur text-white text-xs rounded-xl p-3 z-10">
        <div className="font-semibold mb-2 text-white/80">Safety Heatmap</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Safe</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Moderate</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Caution</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> High Risk</div>
        </div>
      </div>

      {/* Locating indicator */}
      {locating && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-black/70 backdrop-blur text-white text-sm px-4 py-3 rounded-xl flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          Detecting your location...
        </div>
      )}
    </div>
  )
}
