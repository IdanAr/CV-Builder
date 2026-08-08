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

  it('renders a secondary CTA linking to /signin', () => {
    render(<HeroSection />)
    const secondary = screen.getByRole('link', { name: /upload existing cv/i })
    expect(secondary).toHaveAttribute('href', '/signin')
  })

  it('shows an ATS score badge on the mockup', () => {
    render(<HeroSection />)
    expect(screen.getByText(/ats score/i)).toBeInTheDocument()
    expect(screen.getByText('95%')).toBeInTheDocument()
  })
})
