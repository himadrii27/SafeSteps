'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, MapPin } from 'lucide-react'

interface GeoResult {
  placeId: number
  displayName: string
  lat: number
  lng: number
  city: string
  state: string
}

interface Props {
  onSelect: (lat: number, lng: number) => void
}

export function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = (q: string) => {
    if (debounce.current) clearTimeout(debounce.current)
    if (q.length < 3) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.results ?? [])
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  const handleSelect = (r: GeoResult) => {
    setQuery(r.displayName.split(',').slice(0, 2).join(', '))
    setResults([])
    setOpen(false)
    onSelect(r.lat, r.lng)
  }

  return (
    <div ref={ref} className="relative flex-1">
      <div className="flex items-center bg-white/10 backdrop-blur border border-white/20 rounded-xl px-3 py-2 gap-2">
        {loading
          ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin flex-shrink-0" />
          : <Search size={16} className="text-white/50 flex-shrink-0" />
        }
        <input
          type="text"
          className="flex-1 bg-transparent text-white placeholder-white/40 text-sm outline-none"
          placeholder="Search any location in India..."
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value) }}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false) }}>
            <X size={14} className="text-white/40 hover:text-white/80" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
          {results.map(r => (
            <button
              key={r.placeId}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition text-left"
              onClick={() => handleSelect(r)}
            >
              <MapPin size={14} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-white text-sm line-clamp-1">{r.displayName.split(',').slice(0, 2).join(', ')}</div>
                <div className="text-white/40 text-xs">{r.state}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
