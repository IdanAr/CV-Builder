'use client'

import type { ReactNode } from 'react'
import { Plasma } from './Plasma'

interface PlasmaBackgroundProps {
  children: ReactNode
  opacity?: number
  mouseInteractive?: boolean
}

export function PlasmaBackground({ children, opacity = 0.2, mouseInteractive = false }: PlasmaBackgroundProps) {
  return (
    <div className="relative bg-gradient-to-br from-indigo-50 via-purple-50 to-white">
      <div className="absolute inset-0 z-0">
        <Plasma
          color="#4f46e5"
          speed={0.5}
          direction="forward"
          scale={1.2}
          opacity={opacity}
          mouseInteractive={mouseInteractive}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-white/60" />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
