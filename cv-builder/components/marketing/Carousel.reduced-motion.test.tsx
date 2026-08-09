// @vitest-environment jsdom
// components/marketing/Carousel.reduced-motion.test.tsx
//
// Kept in its own file, separate from Carousel.test.tsx: framer-motion's
// useReducedMotion() reads matchMedia only once and caches the result at the
// module level for the process's lifetime — it never re-subscribes. Any test
// in this file must be the first thing in the whole test run to touch
// useReducedMotion(), or it'll observe a stale cached value from an earlier
// test instead of this file's stub. A dedicated file (Vitest gives each test
// file its own fresh module registry) is the simplest way to guarantee that.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Carousel } from './Carousel'

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: true,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
}))

describe('Carousel — prefers-reduced-motion', () => {
  it('does not auto-advance when the visitor prefers reduced motion', () => {
    vi.useFakeTimers()
    const slides = [<div key="a">Slide A</div>, <div key="b">Slide B</div>]
    render(<Carousel slides={slides} ariaLabel="Test carousel" intervalMs={1000} />)

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('Slide A').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')
    vi.useRealTimers()
  })
})
