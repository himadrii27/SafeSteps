'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { SafetyPanel } from './SafetyPanel'
import { SearchBar } from './SearchBar'
import { AlertBanner } from './AlertBanner'
import { ReportButton } from './ReportButton'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

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
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const userMarker = useRef<mapboxgl.Marker | null>(null)
  const pinMarker = useRef<mapboxgl.Marker | null>(null)
  const watchId = useRef<number | null>(null)

  const [safetyData, setSafetyData] = useState<SafetyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)

  const fetchSafety = useCallback(async (lat: number, lng: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/safety-score?lat=${lat}&lng=${lng}&radius=3`)
      const data: SafetyData = await res.json()
      setSafetyData(data)
      setPanelOpen(true)

      // Alert if unsafe
      if (data.level === 'unsafe') {
        setAlert(`High risk area detected! Safety score: ${data.score}/10. Exercise extra caution.`)
      } else if (data.level === 'moderate') {
        setAlert(`Moderate risk area. Safety score: ${data.score}/10. Stay aware of surroundings.`)
      } else {
        setAlert(null)
      }

      // Update heatmap & markers
      loadCrimeMarkers(lat, lng)
    } catch (err) {
      console.error('Safety fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCrimeMarkers = async (lat: number, lng: number) => {
    if (!map.current) return
    const res = await fetch(`/api/crimes?lat=${lat}&lng=${lng}&radius=5`)
    const { crimes } = await res.json()

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: (crimes as CrimePoint[]).map(c => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
        properties: {
          crimeType: c.crimeType,
          crimeAgainstWomen: c.crimeAgainstWomen,
          year: c.year,
          count: c.count,
          weight: c.crimeAgainstWomen ? c.count * 2 : c.count,
        },
      })),
    }

    if (map.current.getSource('crimes')) {
      (map.current.getSource('crimes') as mapboxgl.GeoJSONSource).setData(geojson)
    } else {
      map.current.addSource('crimes', { type: 'geojson', data: geojson })

      // Heatmap layer
      map.current.addLayer({
        id: 'crime-heatmap',
        type: 'heatmap',
        source: 'crimes',
        maxzoom: 15,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 100, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(34,197,94,0)',
            0.2, 'rgba(34,197,94,0.5)',
            0.4, 'rgba(234,179,8,0.7)',
            0.6, 'rgba(249,115,22,0.8)',
            0.8, 'rgba(239,68,68,0.9)',
            1, 'rgba(185,28,28,1)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 30],
          'heatmap-opacity': 0.7,
        },
      })

      // Individual crime dots at high zoom
      map.current.addLayer({
        id: 'crime-dots',
        type: 'circle',
        source: 'crimes',
        minzoom: 13,
        paint: {
          'circle-radius': 5,
          'circle-color': [
            'case',
            ['==', ['get', 'crimeAgainstWomen'], true], '#ef4444',
            '#f97316',
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.85,
        },
      })

      // Popup on dot click
      map.current.on('click', 'crime-dots', (e) => {
        if (!e.features?.[0]) return
        const props = e.features[0].properties ?? {}
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        new mapboxgl.Popup()
          .setLngLat(coords)
          .setHTML(`
            <div class="p-2 text-sm">
              <strong>${props['crimeType'] ?? ''}</strong><br/>
              Year: ${props['year'] ?? ''}<br/>
              Cases: ${props['count'] ?? ''}<br/>
              ${props['crimeAgainstWomen'] ? '<span style="color:#ef4444">⚠ Crime against women</span>' : ''}
            </div>
          `)
          .addTo(map.current!)
      })
      map.current.on('mouseenter', 'crime-dots', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer'
      })
      map.current.on('mouseleave', 'crime-dots', () => {
        if (map.current) map.current.getCanvas().style.cursor = ''
      })
    }
  }

  // Init map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [78.9629, 20.5937], // India center
      zoom: 4.5,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    // Click to check any location
    map.current.on('click', (e) => {
      if (!map.current) return
      const { lng, lat } = e.lngLat

      if (pinMarker.current) pinMarker.current.remove()
      const el = document.createElement('div')
      el.className = 'pin-marker'
      el.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:#7c3aed;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`
      pinMarker.current = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map.current)

      fetchSafety(lat, lng)
    })

    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current)
      map.current?.remove()
    }
  }, [fetchSafety])

  // Locate me
  const handleLocate = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCurrentLocation({ lat, lng })
        map.current?.flyTo({ center: [lng, lat], zoom: 13, duration: 1500 })

        if (userMarker.current) userMarker.current.remove()
        const el = document.createElement('div')
        el.innerHTML = `
          <div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3)"></div>
        `
        userMarker.current = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map.current!)
        fetchSafety(lat, lng)

        // Watch location for geofence alerts
        if (watchId.current) navigator.geolocation.clearWatch(watchId.current)
        watchId.current = navigator.geolocation.watchPosition(
          (p) => {
            const { latitude: wLat, longitude: wLng } = p.coords
            userMarker.current?.setLngLat([wLng, wLat])
            setCurrentLocation({ lat: wLat, lng: wLng })
            fetchSafety(wLat, wLng)
          },
          undefined,
          { distanceFilter: 200 } as PositionOptions
        )
      },
      () => setAlert('Location access denied. Please allow location to use this feature.')
    )
  }

  const handleSearch = (lat: number, lng: number) => {
    map.current?.flyTo({ center: [lng, lat], zoom: 13, duration: 1500 })
    fetchSafety(lat, lng)
  }

  return (
    <div className="relative w-full h-screen bg-gray-950">
      {/* Map */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Top bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-10 flex gap-2">
        <SearchBar onSelect={handleSearch} />
        <button
          onClick={handleLocate}
          className="flex-shrink-0 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white rounded-xl px-3 py-2 text-sm font-medium transition"
          title="Use my location"
        >
          📍
        </button>
      </div>

      {/* Alert banner */}
      {alert && (
        <AlertBanner message={alert} onDismiss={() => setAlert(null)} />
      )}

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
      <div className="absolute bottom-24 left-4 bg-black/60 backdrop-blur text-white text-xs rounded-xl p-3 z-10">
        <div className="font-semibold mb-2 text-white/80">Safety Heatmap</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Safe</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Moderate</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Caution</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> High Risk</div>
        </div>
      </div>
    </div>
  )
}
