'use client'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Shield, AlertTriangle, X, Users, FileText, TrendingUp } from 'lucide-react'

interface SafetyData {
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

interface Props {
  data: SafetyData | null
  loading: boolean
  open: boolean
  onClose: () => void
}

const levelConfig = {
  safe: { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-400', icon: Shield },
  moderate: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400', icon: AlertTriangle },
  unsafe: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', icon: AlertTriangle },
}

export function SafetyPanel({ data, loading, open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="absolute bottom-0 left-0 right-0 md:bottom-8 md:left-4 md:right-auto md:w-96 z-20 animate-in slide-in-from-bottom duration-300">
      <div className="bg-gray-900/95 backdrop-blur border border-white/10 rounded-t-2xl md:rounded-2xl p-5 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white/90">Safety Analysis</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition">
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-6">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-white/60 text-sm">Analyzing area safety...</span>
          </div>
        )}

        {!loading && data && (() => {
          const cfg = levelConfig[data.level]
          const Icon = cfg.icon
          const circumference = 2 * Math.PI * 22
          const offset = circumference - (data.score / 10) * circumference

          return (
            <>
              {/* Score ring */}
              <div className={`${cfg.bg} ${cfg.border} border rounded-xl p-4 flex items-center gap-4 mb-4`}>
                <div className="relative w-16 h-16 flex-shrink-0">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 52 52">
                    <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                    <circle
                      cx="26" cy="26" r="22" fill="none"
                      stroke={data.color} strokeWidth="4"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-bold" style={{ color: data.color }}>
                    {data.score}
                  </span>
                </div>
                <div>
                  <div className={`text-xl font-bold ${cfg.text}`}>{data.label}</div>
                  <div className="text-white/50 text-xs mt-0.5">Score out of 10 • 3km radius</div>
                  <div className="flex items-center gap-1 mt-1">
                    <Icon size={13} className={cfg.text} />
                    <span className={`text-xs font-medium ${cfg.text}`}>{data.level.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <StatCard icon={FileText} label="Total Crimes" value={data.totalCrimes.toLocaleString()} />
                <StatCard icon={Users} label="vs Women" value={data.womenCrimes.toLocaleString()} highlight />
                <StatCard icon={TrendingUp} label="Reports" value={data.crowdReports.toString()} />
              </div>

              {/* Top crime types */}
              {data.topCrimeTypes.length > 0 && (
                <div className="mb-4">
                  <div className="text-white/50 text-xs font-medium mb-2">Top Crime Types</div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.topCrimeTypes.map(t => (
                      <Badge key={t} variant="outline" className="text-xs border-white/20 text-white/70 bg-white/5">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Summary */}
              {data.aiSummary && (
                <>
                  <Separator className="bg-white/10 mb-4" />
                  <div>
                    <div className="text-white/50 text-xs font-medium mb-2">AI Safety Insight</div>
                    <p className="text-white/80 text-sm leading-relaxed">{data.aiSummary}</p>
                  </div>
                </>
              )}

              {/* Data source note */}
              <div className="mt-4 text-white/30 text-xs">
                Sources: NCRB 2022 + data.gov.in + crowd reports
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, highlight }: {
  icon: React.ElementType
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? 'bg-red-500/15 border border-red-500/20' : 'bg-white/5'}`}>
      <Icon size={14} className={`mx-auto mb-1 ${highlight ? 'text-red-400' : 'text-white/40'}`} />
      <div className={`text-base font-bold ${highlight ? 'text-red-400' : 'text-white'}`}>{value}</div>
      <div className="text-white/40 text-xs mt-0.5">{label}</div>
    </div>
  )
}
