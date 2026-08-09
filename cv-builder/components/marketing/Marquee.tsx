'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'

interface MarqueeProps {
  items: ReactNode[]
  ariaLabel: string
  /** Seconds for one full loop of the (single, non-duplicated) content width. */
  durationSeconds?: number
}

/**
 * A continuously auto-scrolling strip (ticker/marquee) — several items
 * visible at once, sliding smoothly and looping seamlessly, no buttons or
 * dots to interact with. Pauses on hover/focus (WCAG 2.2.2 — moving content
 * needs a way to pause it) and falls back to a plain, manually-scrollable
 * static row under prefers-reduced-motion (no animation, no duplicated
 * content — nothing to disable, so there's nothing extra to render).
 *
 * The animated case renders `items` twice back to back and animates the
 * track by exactly -50% of its own width via CSS (see the `marquee-scroll`
 * keyframes in app/globals.css) — since both halves are identical, the loop
 * is seamless. The second half is `inert` + `aria-hidden` so screen readers
 * and the tab order only ever see the one real set of items.
 */
export function Marquee({ items, ariaLabel, durationSeconds = 40 }: MarqueeProps) {
  const [paused, setPaused] = useState(false)
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return (
      <div
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        className="flex gap-6 overflow-x-auto pb-2 snap-x"
      >
        {items.map((item, i) => (
          <div key={i} data-marquee-item className="shrink-0 snap-start">
            {item}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      className="overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        data-marquee-track
        className={`marquee-track flex w-max gap-6${paused ? ' marquee-paused' : ''}`}
        style={{ '--marquee-duration': `${durationSeconds}s` } as CSSProperties}
      >
        {[...items, ...items].map((item, i) => {
          const isDuplicate = i >= items.length
          return (
            <div key={i} data-marquee-item className="shrink-0" aria-hidden={isDuplicate} inert={isDuplicate}>
              {item}
            </div>
          )
        })}
      </div>
    </div>
  )
}
