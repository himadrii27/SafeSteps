'use client'

import { Sun, Moon, Sunset } from 'lucide-react'

interface Props {
  hour: number
  onChange: (hour: number) => void
}

function formatHour(h: number) {
  if (h === 0)  return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function periodIcon(h: number) {
  if (h >= 5 && h < 17)  return <Sun  size={14} className="text-yellow-400" />
  if (h >= 17 && h < 21) return <Sunset size={14} className="text-orange-400" />
  return <Moon size={14} className="text-blue-300" />
}

function periodLabel(h: number) {
  if (h >= 5  && h < 12) return 'Morning'
  if (h >= 12 && h < 17) return 'Afternoon'
  if (h >= 17 && h < 21) return 'Evening'
  if (h >= 21 || h < 2)  return 'Late Night'
  return 'Night'
}

// Track colour shifts: green (day) → orange (evening) → red (late night)
function trackGradient(h: number) {
  if (h >= 22 || h < 5)  return 'from-red-600 to-red-500'
  if (h >= 17)           return 'from-orange-500 to-yellow-400'
  return 'from-green-500 to-emerald-400'
}

export function TimeSlider({ hour, onChange }: Props) {
  return (
    <div className="bg-white/10 backdrop-blur border border-white/20 text-white rounded-xl px-3 py-2 flex items-center gap-2 min-w-[180px]">
      {periodIcon(hour)}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/60">{periodLabel(hour)}</span>
          <span className="text-xs font-semibold">{formatHour(hour)}</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-white/10">
          <div
            className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${trackGradient(hour)} transition-all`}
            style={{ width: `${(hour / 23) * 100}%` }}
          />
          <input
            type="range"
            min={0}
            max={23}
            value={hour}
            onChange={e => onChange(parseInt(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          />
        </div>
      </div>
    </div>
  )
}
