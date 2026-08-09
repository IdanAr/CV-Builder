// @vitest-environment jsdom
// components/marketing/MarketingNavActions.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketingNavActions } from './MarketingNavActions'

describe('MarketingNavActions', () => {
  it('renders Sign In and Get Started links, both to /signin, by default', () => {
    render(<MarketingNavActions />)
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/signin')
    expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/signin')
  })

  it('renders a single Dashboard link to /dashboard when isSignedIn is true', () => {
    render(<MarketingNavActions isSignedIn />)
    expect(screen.getByRole('link', { name: /^dashboard$/i })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /get started/i })).not.toBeInTheDocument()
  })
})
