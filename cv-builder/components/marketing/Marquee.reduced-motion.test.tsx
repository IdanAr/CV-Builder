// @vitest-environment jsdom
// components/marketing/Marquee.reduced-motion.test.tsx
//
// Kept in its own file, separate from Marquee.test.tsx: framer-motion's
// useReducedMotion() reads matchMedia only once and caches the result at the
// module level for the process's lifetime (it never re-subscribes), so any
// test touching it must be the first thing in a fresh module registry to do
// so, or it'll observe a stale cached value from an earlier test instead of
// this file's stub. Vitest gives each test file its own fresh module
// registry, which is the simplest way to guarantee that.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Marquee } from './Marquee'

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: true,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
}))

describe('Marquee — prefers-reduced-motion', () => {
  it('falls back to a static, manually-scrollable row with no duplication', () => {
    const items = [<div key="a">Card A</div>, <div key="b">Card B</div>, <div key="c">Card C</div>]
    const { container } = render(<Marquee items={items} ariaLabel="Test strip" />)

    // No animated track, no duplicated content.
    expect(container.querySelector('[data-marquee-track]')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-marquee-item]')).toHaveLength(3)
    expect(screen.getByText('Card A').closest('[aria-hidden]')).toBeNull()
  })
})
