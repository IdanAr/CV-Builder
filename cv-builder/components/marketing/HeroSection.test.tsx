// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroSection } from './HeroSection'

describe('HeroSection', () => {
  it('renders the H1 headline', () => {
    render(<HeroSection />)
    expect(screen.getByRole('heading', { level: 1, name: /create a job-winning cv in minutes/i })).toBeInTheDocument()
  })

  it('renders a primary CTA linking to /signin', () => {
    render(<HeroSection />)
    const primary = screen.getByRole('link', { name: /build my cv now/i })
    expect(primary).toHaveAttribute('href', '/signin')
  })

  it('labels the secondary CTA to make the sign-in requirement explicit, linking to /signin', () => {
    render(<HeroSection />)
    const secondary = screen.getByRole('link', { name: /sign up to upload your cv/i })
    expect(secondary).toHaveAttribute('href', '/signin')
  })

  it('shows an ATS score badge on the mockup', () => {
    render(<HeroSection />)
    expect(screen.getByText(/ats score/i)).toBeInTheDocument()
    expect(screen.getByText('95%')).toBeInTheDocument()
  })

  it('constrains the hero thumbnail to its column width so it cannot overflow on narrow viewports', () => {
    // TemplateThumbnail derives a fixed pixel `width` from the `height` prop (see
    // TemplateThumbnail.tsx) and sets it via inline style, so on viewports narrower
    // than ~371px that fixed width exceeds the available column width. jsdom doesn't
    // perform real layout, so we can't measure actual overflow here — this asserts
    // the static contract instead: the thumbnail's root element (the same element
    // that carries the inline pixel width) also carries `max-w-full` (max-width:
    // 100%), which caps its rendered width to its container's width at any
    // viewport, converting a page-level horizontal overflow into, at worst,
    // self-contained clipping inside the thumbnail's own `overflow-hidden` box.
    // Full confirmation that this eliminates horizontal scroll at ~375px width
    // requires a manual/browser check (not exercised by this jsdom test).
    render(<HeroSection />)
    const thumbnail = screen.getByTestId('hero-thumbnail')
    expect(thumbnail.className).toMatch(/\bmax-w-full\b/)
  })

  it('marks the decorative ATS badge as aria-hidden since it is illustrative and not tied to the user\'s own resume', () => {
    render(<HeroSection />)
    const badge = screen.getByText(/ats score/i).closest('div')
    expect(badge).toHaveAttribute('aria-hidden', 'true')
  })

  // The audit's F9: "Free" appeared exactly once in the visible funnel — inside
  // a button label in the final section — so nobody could tell above the fold
  // whether the product costs money.
  it('states the price above the fold, beside the CTAs', () => {
    render(<HeroSection />)
    expect(screen.getByText(/free to start/i)).toBeInTheDocument()
  })

  // "Free to start", not "free forever": the pricing model is undecided, and
  // marketing copy should not commit the product to one.
  it('does not promise the product will always be free', () => {
    render(<HeroSection />)
    expect(screen.queryByText(/free forever|always free|100% free/i)).not.toBeInTheDocument()
  })
})
