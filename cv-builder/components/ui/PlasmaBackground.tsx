'use client'

import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'

// Code-split out of the initial bundle: `ogl` (the WebGL library Plasma
// depends on) has no business being in the first JS chunk for every
// /dashboard/* route — including the editor, the app's most
// latency-sensitive page. This purely defers *when* the module loads;
// Plasma's own runtime throttling (30fps cap, DPR 1 cap, intersection/
// visibility pause, prefers-reduced-motion handling — see Plasma.tsx) is
// unchanged by this.
const Plasma = dynamic(() => import('./Plasma').then((mod) => mod.Plasma), { ssr: false })

interface PlasmaBackgroundProps {
  children: ReactNode
  opacity?: number
  mouseInteractive?: boolean
}

export function PlasmaBackground({ children, opacity = 0.2, mouseInteractive = false }: PlasmaBackgroundProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-white">
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
