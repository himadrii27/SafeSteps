'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  message: string
  onDismiss: () => void
}

export function AlertBanner({ message, onDismiss }: Props) {
  // Trigger browser notification if permitted
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Safety Alert', { body: message, icon: '/icon.png' })
    } else if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          new Notification('Safety Alert', { body: message, icon: '/icon.png' })
        }
      })
    }
  }, [message])

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-30 animate-in slide-in-from-top duration-300">
      <div className="bg-red-900/90 backdrop-blur border border-red-500/50 rounded-xl px-4 py-3 flex items-start gap-3 shadow-2xl">
        <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
        <p className="text-red-100 text-sm flex-1">{message}</p>
        <button onClick={onDismiss} className="text-red-400/60 hover:text-red-400 transition flex-shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
