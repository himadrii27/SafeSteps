'use client'

import { useState } from 'react'
import { Flag, X, MapPin, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const INCIDENT_TYPES = [
  'Harassment', 'Stalking', 'Eve Teasing', 'Theft / Snatching',
  'Unsafe Lighting', 'Assault', 'Suspicious Activity', 'Other',
]

interface Props {
  currentLocation: { lat: number; lng: number } | null
}

export function ReportButton({ currentLocation }: Props) {
  const [open, setOpen] = useState(false)
  const [incidentType, setIncidentType] = useState('')
  const [description, setDescription] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!incidentType || !description || !currentLocation) return
    setSubmitting(true)
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          incidentType,
          description,
          anonymous,
          reportedAt: new Date().toISOString(),
        }),
      })
      setSuccess(true)
      setTimeout(() => { setOpen(false); setSuccess(false); setIncidentType(''); setDescription('') }, 2000)
    } catch {
      alert('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-8 right-16 md:right-20 z-20 bg-red-500 hover:bg-red-600 text-white rounded-full px-4 py-3 flex items-center gap-2 shadow-lg transition font-medium text-sm"
      >
        <Flag size={16} />
        Report Incident
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-gray-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Report an Incident</DialogTitle>
          </DialogHeader>

          {success ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-green-400 font-medium">Report submitted!</p>
              <p className="text-white/50 text-sm mt-1">It will appear on the map after review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Location */}
              <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                <MapPin size={14} className="text-purple-400" />
                <span className="text-white/60 text-sm">
                  {currentLocation
                    ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`
                    : 'No location — enable GPS first'}
                </span>
              </div>

              {/* Incident type */}
              <div>
                <label className="text-white/60 text-xs font-medium block mb-2">Incident Type</label>
                <div className="flex flex-wrap gap-2">
                  {INCIDENT_TYPES.map(t => (
                    <Badge
                      key={t}
                      variant="outline"
                      className={`cursor-pointer text-xs transition ${
                        incidentType === t
                          ? 'bg-red-500/20 border-red-500 text-red-300'
                          : 'border-white/20 text-white/60 hover:border-white/40'
                      }`}
                      onClick={() => setIncidentType(t)}
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-white/60 text-xs font-medium block mb-2">Description</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 outline-none resize-none focus:border-purple-500/50 transition"
                  rows={3}
                  placeholder="Briefly describe what happened..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              {/* Anonymous toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`w-10 h-5 rounded-full transition ${anonymous ? 'bg-purple-600' : 'bg-white/20'} relative`}
                  onClick={() => setAnonymous(!anonymous)}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${anonymous ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-white/60 text-sm">Submit anonymously</span>
              </label>

              <Button
                onClick={handleSubmit}
                disabled={!incidentType || !description || !currentLocation || submitting}
                className="w-full bg-red-500 hover:bg-red-600 text-white disabled:opacity-40"
              >
                {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Submit Report
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
