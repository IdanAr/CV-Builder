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
      {/* Fixed to the viewport, not `absolute` to the page: an `absolute
          inset-0` layer here would have to grow to match the full scrollable
          height of `children`, which the Plasma canvas below measures once on
          mount and doesn't reliably re-measure as async content (e.g. the
          jobsearch profile page's stacked panels) grows the page taller after
          that — producing a hard seam where the canvas's last-measured height
          ends and the flat gradient underneath shows through on its own. A
          `fixed` layer only ever needs to cover the viewport, which never
          exceeds one screen's worth of pixels regardless of how long the
          page's content grows. */}
      <div className="fixed inset-0 z-0">
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
