// @vitest-environment jsdom
// components/marketing/Marquee.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Marquee } from './Marquee'

function stubMatchMedia(reduceMotion: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduceMotion && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('Marquee', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const items = [<div key="a">Card A</div>, <div key="b">Card B</div>, <div key="c">Card C</div>]

  it('renders the real items visibly, plus an aria-hidden/inert duplicate set for the seamless loop', () => {
    stubMatchMedia(false)
    const { container } = render(<Marquee items={items} ariaLabel="Test strip" />)
    const region = screen.getByRole('region', { name: 'Test strip' })

    // Real set (rendered first): visible to assistive tech.
    const [realCopy] = screen.getAllByText('Card A')
    expect(realCopy.closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false')

    // Exactly 2 copies of each card (real + duplicate) in the DOM.
    expect(container.querySelectorAll('[data-marquee-item]')).toHaveLength(6)

    // The duplicate half is inert and hidden from assistive tech.
    const hiddenCopies = region.querySelectorAll('[aria-hidden="true"]')
    expect(hiddenCopies).toHaveLength(3)
    hiddenCopies.forEach((el) => expect(el.hasAttribute('inert')).toBe(true))
  })

  it('pauses the animation on hover and resumes when the mouse leaves', () => {
    // Pause is expressed as a static CSS class (`.marquee-paused`, defined in
    // app/globals.css), not an inline animationPlayState — reassigning the
    // `animation` shorthand via inline style restarts a CSS animation from 0%
    // on every write, even when the value is unchanged, which silently starved
    // this of any visible progress. See the comment above `.marquee-track` in
    // app/globals.css for the full story.
    stubMatchMedia(false)
    render(<Marquee items={items} ariaLabel="Test strip" />)
    const region = screen.getByRole('region', { name: 'Test strip' })
    const track = region.querySelector('[data-marquee-track]') as HTMLElement

    expect(track).not.toHaveClass('marquee-paused')
    fireEvent.mouseEnter(region)
    expect(track).toHaveClass('marquee-paused')
    fireEvent.mouseLeave(region)
    expect(track).not.toHaveClass('marquee-paused')
  })

  it('pauses on focus and resumes on blur, for keyboard users', () => {
    stubMatchMedia(false)
    render(<Marquee items={items} ariaLabel="Test strip" />)
    const region = screen.getByRole('region', { name: 'Test strip' })
    const track = region.querySelector('[data-marquee-track]') as HTMLElement

    fireEvent.focus(region)
    expect(track).toHaveClass('marquee-paused')
    fireEvent.blur(region)
    expect(track).not.toHaveClass('marquee-paused')
  })

  // The prefers-reduced-motion case is covered in Marquee.reduced-motion.test.tsx,
  // in its own file: framer-motion's useReducedMotion() reads matchMedia once and
  // caches the result at the module level for the process's lifetime, so testing
  // it here (after the tests above already rendered a Marquee with
  // reduceMotion: false) would observe the stale cached value instead of a fresh
  // stub — a fresh file gets a fresh module registry.

  it('is keyboard-reachable (focusable container)', () => {
    stubMatchMedia(false)
    render(<Marquee items={items} ariaLabel="Test strip" />)
    expect(screen.getByRole('region', { name: 'Test strip' })).toHaveAttribute('tabIndex', '0')
  })
})
