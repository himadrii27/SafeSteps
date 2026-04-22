'use client'

import dynamic from 'next/dynamic'

const SafetyMap = dynamic(
  () => import('@/components/map/SafetyMap').then(m => m.SafetyMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Loading safety map...</p>
        </div>
      </div>
    ),
  }
)

export default function Home() {
  return <SafetyMap />
}
