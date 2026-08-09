// @vitest-environment jsdom
// components/marketing/Carousel.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Carousel } from './Carousel'

function stubMatchMedia(reduceMotion: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduceMotion && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('Carousel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stubMatchMedia(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const slides = [<div key="a">Slide A</div>, <div key="b">Slide B</div>, <div key="c">Slide C</div>]

  it('renders all slides in the DOM, with only the first one visible to assistive tech', () => {
    render(<Carousel slides={slides} ariaLabel="Test carousel" />)
    expect(screen.getByText('Slide A')).toBeInTheDocument()
    expect(screen.getByText('Slide B')).toBeInTheDocument()
    expect(screen.getByText('Slide C')).toBeInTheDocument()
    expect(screen.getByText('Slide A').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByText('Slide B').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('auto-advances to the next slide after intervalMs', () => {
    render(<Carousel slides={slides} ariaLabel="Test carousel" intervalMs={5000} />)
    expect(screen.getByText('Slide A').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('Slide B').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')
  })

  it('loops back to the first slide after the last', () => {
    render(<Carousel slides={slides} ariaLabel="Test carousel" intervalMs={1000} />)
    act(() => {
      vi.advanceTimersByTime(1000) // -> B
      vi.advanceTimersByTime(1000) // -> C
      vi.advanceTimersByTime(1000) // -> back to A
    })
    expect(screen.getByText('Slide A').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')
  })

  it('pauses auto-advance while hovered and resumes after the mouse leaves', () => {
    render(<Carousel slides={slides} ariaLabel="Test carousel" intervalMs={1000} />)
    const region = screen.getByRole('region', { name: 'Test carousel' })

    fireEvent.mouseEnter(region)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('Slide A').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')

    fireEvent.mouseLeave(region)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('Slide B').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')
  })

  // The prefers-reduced-motion case is covered in Carousel.reduced-motion.test.tsx,
  // in its own file: framer-motion's useReducedMotion() reads matchMedia only once
  // and caches the result at the module level for the process's lifetime (it never
  // re-subscribes), so testing it here — after other tests in this file have already
  // rendered a Carousel with reduceMotion: false — would silently observe framer-motion's
  // stale cached value instead of the fresh stub.

  it('jumps to a slide when its dot is clicked', () => {
    render(<Carousel slides={slides} ariaLabel="Test carousel" />)
    const dots = screen.getAllByRole('button', { name: /go to slide/i })
    expect(dots).toHaveLength(3)

    fireEvent.click(dots[2])
    expect(screen.getByText('Slide C').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')
    expect(dots[2]).toHaveAttribute('aria-current', 'true')
  })

  it('advances via the next/previous arrow buttons', () => {
    render(<Carousel slides={slides} ariaLabel="Test carousel" />)
    fireEvent.click(screen.getByRole('button', { name: /next slide/i }))
    expect(screen.getByText('Slide B').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')

    fireEvent.click(screen.getByRole('button', { name: /previous slide/i }))
    expect(screen.getByText('Slide A').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')
  })

  it('renders no controls for a single slide', () => {
    render(<Carousel slides={[<div key="only">Only slide</div>]} ariaLabel="Test carousel" />)
    expect(screen.queryByRole('button', { name: /next slide/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /go to slide/i })).not.toBeInTheDocument()
  })
})
