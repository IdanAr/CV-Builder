'use client'

import { Plasma } from './light-saas-hero-section'

interface PlasmaBackgroundProps {
  children: React.ReactNode
  opacity?: number
}

export function PlasmaBackground({ children, opacity = 0.15 }: PlasmaBackgroundProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-white">
      <div className="absolute inset-0 z-0">
        <Plasma
          color="#4f46e5"
          speed={0.5}
          direction="forward"
          scale={1.2}
          opacity={opacity}
          mouseInteractive={true}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-white/60" />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
