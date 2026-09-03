// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SkipLink } from './SkipLink'

afterEach(cleanup)

describe('SkipLink', () => {
  it('points at the landmark every route provides', () => {
    render(<SkipLink />)
    const link = screen.getByRole('link', { name: 'Skip to main content' })
    expect(link.getAttribute('href')).toBe('#main-content')
  })

  // The first attempt used `sr-only focus:not-sr-only`. `not-sr-only` resets
  // padding and white-space, which fought this element's own px-4 py-2 and
  // collapsed it to 83x76 with the label wrapped over three lines. That was
  // measured in a real browser; jsdom computes no layout, so the contract is
  // pinned as classes instead: park with a transform, never with sr-only.
  it('parks off-screen by transform, not by sr-only', () => {
    render(<SkipLink />)
    const classes = screen.getByRole('link').className.split(/\s+/)
    expect(classes).toContain('-translate-y-20')
    expect(classes).toContain('focus:translate-y-0')
    expect(classes).not.toContain('sr-only')
    expect(classes).not.toContain('focus:not-sr-only')
  })

  it('keeps the label on one line so the revealed box stays readable', () => {
    render(<SkipLink />)
    expect(screen.getByRole('link').className.split(/\s+/)).toContain('whitespace-nowrap')
  })

  it('stays out of the document flow so it shifts nothing while hidden', () => {
    render(<SkipLink />)
    expect(screen.getByRole('link').className.split(/\s+/)).toContain('absolute')
  })

  it('respects a reduced-motion preference', () => {
    render(<SkipLink />)
    expect(screen.getByRole('link').className.split(/\s+/)).toContain(
      'motion-reduce:transition-none'
    )
  })
})
