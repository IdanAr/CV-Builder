// @vitest-environment jsdom
// components/marketing/MarketingFooter.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketingFooter } from './MarketingFooter'

describe('MarketingFooter', () => {
  it('renders the brand name and current year copyright', () => {
    render(<MarketingFooter />)
    expect(screen.getByText('CV Builder')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument()
  })

  it('renders a sign-in link', () => {
    render(<MarketingFooter />)
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/signin')
  })

  it('renders Privacy Policy and Terms of Use links', () => {
    render(<MarketingFooter />)
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: /terms of use/i })).toHaveAttribute('href', '/terms')
  })
})
