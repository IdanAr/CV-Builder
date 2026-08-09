'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CarouselProps {
  slides: ReactNode[]
  ariaLabel: string
  /** Time between auto-advances, in ms. Ignored entirely when the visitor prefers reduced motion. */
  intervalMs?: number
}

/**
 * A single-slide-at-a-time auto-advancing carousel. Pauses while hovered or
 * focused, never auto-advances under prefers-reduced-motion, and always
 * renders every slide in the DOM (good for SEO/crawlers) — inactive slides
 * are `inert` and `aria-hidden` so they're invisible to assistive tech and
 * out of the tab order, matching the same pattern TemplateThumbnail uses for
 * its own non-interactive content.
 */
export function Carousel({ slides, ariaLabel, intervalMs = 6000 }: CarouselProps) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion || paused || slides.length <= 1) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, intervalMs)
    return () => clearInterval(id)
  }, [reduceMotion, paused, slides.length, intervalMs])

  if (slides.length === 0) return null

  const goTo = (i: number) => setIndex((i + slides.length) % slides.length)

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div key={i} className="w-full shrink-0" aria-hidden={i !== index} inert={i !== index}>
              {slide}
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Previous slide"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 rounded-full bg-white/80 p-2 text-indigo-700 shadow-md backdrop-blur-xl transition hover:bg-white sm:-translate-x-5"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Next slide"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 rounded-full bg-white/80 p-2 text-indigo-700 shadow-md backdrop-blur-xl transition hover:bg-white sm:translate-x-5"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="mt-6 flex justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-2.5 w-2.5 rounded-full transition ${
                  i === index ? 'bg-indigo-600' : 'bg-indigo-200 hover:bg-indigo-300'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
