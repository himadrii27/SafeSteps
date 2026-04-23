'use client'

import { useState } from 'react'
import { Navigation, AlertTriangle, CheckCircle, X, Route, Clock, Star, ChevronRight, Map } from 'lucide-react'
import type { RouteOption } from '@/app/api/route-safety/route'

interface LatLng { lat: number; lng: number; label: string }

interface MultiRouteResult {
  routes: RouteOption[]
  recommendedId: number
}

interface Props {
  hour: number
  onRouteResult: (result: MultiRouteResult | null) => void
}

function LocationInput({
  label,
  placeholder,
  value,
  onSet,
}: {
  label: string
  placeholder: string
  value: LatLng | null
  onSet: (v: LatLng | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ displayName: string; lat: number; lng: number }>>([])
  const [open, setOpen] = useState(false)

  const search = async (q: string) => {
    setQuery(q)
    if (q.length < 3) { setResults([]); setOpen(false); return }
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setResults(data.results ?? [])
    setOpen(true)
  }

  const pick = (r: { displayName: string; lat: number; lng: number }) => {
    const label = r.displayName.split(',').slice(0, 2).join(', ')
    setQuery(label)
    setOpen(false)
    onSet({ lat: r.lat, lng: r.lng, label })
  }

  return (
    <div className="relative">
      <div className="text-white/40 text-xs mb-1">{label}</div>
      <div className="flex items-center bg-white/8 border border-white/15 rounded-lg px-3 py-2 gap-2">
        <input
          className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none"
          placeholder={placeholder}
          value={value ? value.label : query}
          onChange={e => { onSet(null); search(e.target.value) }}
        />
        {value && (
          <button onClick={() => { onSet(null); setQuery('') }}>
            <X size={12} className="text-white/30 hover:text-white/70" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-gray-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {results.slice(0, 4).map((r, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition line-clamp-1"
              onClick={() => pick(r)}
            >
              {r.displayName.split(',').slice(0, 2).join(', ')}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RouteTab({
  route,
  isSelected,
  isRecommended,
  onClick,
}: {
  route: RouteOption
  isSelected: boolean
  isRecommended: boolean
  onClick: () => void
}) {
  const isDetour = route.label === 'Safer Detour'
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-2 py-1.5 text-left transition border ${
        isSelected
          ? isDetour
            ? 'bg-green-500/15 border-green-500/30'
            : 'bg-white/10 border-white/25'
          : 'bg-white/3 border-white/8 hover:bg-white/7'
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-[10px] font-medium truncate max-w-[72px] ${isDetour ? 'text-green-400' : 'text-white/50'}`}>
          {route.label}
        </span>
        {isRecommended && (
          <span className="flex items-center gap-0.5 text-[10px] text-purple-400 font-semibold flex-shrink-0">
            <Star size={9} fill="currentColor" /> Best
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold" style={{ color: route.overallColor }}>{route.overallScore}</span>
        <span className="text-[10px] text-white/30">/10</span>
      </div>
      <div className="text-[10px] text-white/40 mt-0.5">{route.distanceKm} km · {route.durationMin} min</div>
    </button>
  )
}

// Detect iOS / macOS to prefer Apple Maps, otherwise Google Maps
function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)
}

function openNavigation(
  from: LatLng,
  to: LatLng,
  app: 'google' | 'apple' | 'waze'
) {
  const urls: Record<string, string> = {
    google: `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=walking`,
    apple:  `http://maps.apple.com/?saddr=${from.lat},${from.lng}&daddr=${to.lat},${to.lng}&dirflg=w`,
    waze:   `https://waze.com/ul?ll=${to.lat},${to.lng}&navigate=yes`,
  }
  window.open(urls[app], '_blank', 'noopener,noreferrer')
}

export function RouteChecker({ hour, onRouteResult }: Props) {
  const [from, setFrom] = useState<LatLng | null>(null)
  const [to, setTo]     = useState<LatLng | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<MultiRouteResult | null>(null)
  const [selectedId, setSelectedId] = useState<number>(0)
  const [open, setOpen] = useState(false)
  const [navMenuOpen, setNavMenuOpen] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const check = async () => {
    if (!from || !to) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/route-safety?fromLat=${from.lat}&fromLng=${from.lng}&toLat=${to.lat}&toLng=${to.lng}&hour=${hour}`
      )
      const data = await res.json()
      if (!res.ok || !data.routes) {
        setError(data.error ?? 'Could not compute route safety. Try again.')
        return
      }
      const typed = data as MultiRouteResult
      setResult(typed)
      setSelectedId(typed.recommendedId)
      onRouteResult(typed)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setResult(null)
    setFrom(null)
    setTo(null)
    setSelectedId(0)
    onRouteResult(null)
  }

  const handleSelectRoute = (id: number) => {
    setSelectedId(id)
    if (result) onRouteResult({ ...result, recommendedId: id })
  }

  const selectedRoute = result?.routes.find(r => r.id === selectedId) ?? result?.routes[0]

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white rounded-xl px-3 py-2 text-sm font-medium transition"
        title="Check route safety"
      >
        <Route size={15} />
        <span className="hidden sm:inline">Route</span>
      </button>
    )
  }

  return (
    <div className="bg-gray-900/95 backdrop-blur border border-white/10 rounded-xl p-4 text-white w-72 shadow-2xl max-h-[85vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Route size={15} className="text-purple-400" />
          Route Safety
        </div>
        <button onClick={() => { setOpen(false); clear() }} className="text-white/30 hover:text-white/70">
          <X size={16} />
        </button>
      </div>

      {/* Inputs */}
      <div className="space-y-2 mb-3">
        <LocationInput label="From" placeholder="Starting point..." value={from} onSet={setFrom} />
        <div className="flex justify-center">
          <Navigation size={12} className="text-white/20" />
        </div>
        <LocationInput label="To" placeholder="Destination..." value={to} onSet={setTo} />
      </div>

      <button
        onClick={check}
        disabled={!from || !to || loading}
        className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg py-2 text-sm font-semibold transition flex items-center justify-center gap-2"
      >
        {loading
          ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Checking...</>
          : <><Route size={14} /> Check Safety</>
        }
      </button>

      {/* Error state */}
      {error && (
        <div className="mt-2 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Multi-route result */}
      {result && selectedRoute && (
        <div className="mt-3 space-y-2">

          {/* Route tabs — only show if more than 1 route */}
          {result.routes.length > 1 && (
            <div>
              <div className="text-xs text-white/30 mb-1.5 px-0.5">
                {result.routes.length} routes found — select to compare
              </div>
              <div className="flex gap-1.5">
                {result.routes.map(r => (
                  <RouteTab
                    key={r.id}
                    route={r}
                    isSelected={r.id === selectedId}
                    isRecommended={r.id === result.recommendedId}
                    onClick={() => handleSelectRoute(r.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Safer-route banner when recommended != primary */}
          {result.recommendedId !== 0 && result.routes.length > 1 && selectedId === 0 && (() => {
            const safer = result.routes.find(r => r.id === result.recommendedId)
            return safer ? (
              <button
                onClick={() => handleSelectRoute(result.recommendedId)}
                className="w-full flex items-center justify-between bg-green-500/10 border border-green-500/25 rounded-lg px-3 py-2 text-left hover:bg-green-500/15 transition"
              >
                <div className="flex items-center gap-2">
                  <Star size={12} className="text-green-400" fill="currentColor" />
                  <div>
                    <div className="text-xs text-green-400 font-semibold">Safer Route Available</div>
                    <div className="text-[10px] text-white/40">Score {safer.overallScore}/10 · +{safer.durationMin - (result.routes[0]?.durationMin ?? 0)} min</div>
                  </div>
                </div>
                <ChevronRight size={13} className="text-green-400" />
              </button>
            ) : null
          })()}

          {/* Summary bar for selected route */}
          <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
            <div>
              <div className="text-xs text-white/40">Safety Score</div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-lg" style={{ color: selectedRoute.overallColor }}>{selectedRoute.overallScore}</span>
                <span className="text-xs text-white/50">/ 10</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/40">Distance</div>
              <div className="text-sm font-medium">{selectedRoute.distanceKm} km</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/40">Time</div>
              <div className="text-sm font-medium flex items-center gap-1">
                <Clock size={11} className="text-white/40" />{selectedRoute.durationMin} min
              </div>
            </div>
          </div>

          {/* Segment warnings */}
          {selectedRoute.riskySegments > 0 && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">
                {selectedRoute.riskySegments} unsafe segment{selectedRoute.riskySegments > 1 ? 's' : ''} detected.
                {result.routes.length > 1
                  ? ' Try a safer route using the tabs above.'
                  : selectedRoute.riskySegments > 1 ? ' Consider an alternate route.' : ' Exercise extra caution.'}
              </p>
            </div>
          )}
          {selectedRoute.riskySegments === 0 && selectedRoute.cautiousSegments > 0 && (
            <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-300">
                {selectedRoute.cautiousSegments} moderate-risk segment{selectedRoute.cautiousSegments > 1 ? 's' : ''} on this route. Stay alert.
              </p>
            </div>
          )}
          {selectedRoute.riskySegments === 0 && selectedRoute.cautiousSegments === 0 && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <CheckCircle size={13} className="text-green-400" />
              <p className="text-xs text-green-300">Route appears safe at this time of day.</p>
            </div>
          )}

          {/* Waypoint scores */}
          <div className="space-y-1">
            <div className="text-xs text-white/30 px-1">Segments</div>
            <div className="flex gap-1 flex-wrap">
              {selectedRoute.waypoints.map((wp, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: `${wp.color}25`, border: `1px solid ${wp.color}60`, color: wp.color }}
                  title={`${wp.label} (${wp.score})`}
                >
                  {wp.score}
                </div>
              ))}
            </div>
          </div>

          {/* Navigate CTA */}
          <div className="relative pt-1">
            <button
              onClick={() => setNavMenuOpen(v => !v)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl py-2.5 text-sm font-semibold transition"
            >
              <Navigation size={15} fill="currentColor" />
              Start Navigation
              <ChevronRight size={13} className={`transition-transform ${navMenuOpen ? 'rotate-90' : ''}`} />
            </button>

            {navMenuOpen && (
              <div className="mt-1.5 rounded-xl border border-white/10 overflow-hidden">
                <button
                  onClick={() => { openNavigation(from!, to!, 'google'); setNavMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 bg-white/5 hover:bg-white/10 transition text-sm text-white/80 border-b border-white/8"
                >
                  <Map size={14} className="text-blue-400 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">Google Maps</div>
                    <div className="text-[10px] text-white/35">Opens in browser or app</div>
                  </div>
                </button>
                {isApplePlatform() && (
                  <button
                    onClick={() => { openNavigation(from!, to!, 'apple'); setNavMenuOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 bg-white/5 hover:bg-white/10 transition text-sm text-white/80 border-b border-white/8"
                  >
                    <Map size={14} className="text-gray-300 flex-shrink-0" />
                    <div className="text-left">
                      <div className="font-medium">Apple Maps</div>
                      <div className="text-[10px] text-white/35">Opens on iPhone / Mac</div>
                    </div>
                  </button>
                )}
                <button
                  onClick={() => { openNavigation(from!, to!, 'waze'); setNavMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 bg-white/5 hover:bg-white/10 transition text-sm text-white/80"
                >
                  <Navigation size={14} className="text-cyan-400 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">Waze</div>
                    <div className="text-[10px] text-white/35">Real-time traffic & alerts</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
