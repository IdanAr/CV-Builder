// @vitest-environment jsdom
// app/privacy/page.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { mockPlasmaGlobals } from '@/test/mock-plasma'
import PrivacyPolicyPage from './page'

describe('Privacy Policy page', () => {
  beforeEach(() => {
    mockPlasmaGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the title and last-updated date', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getByText(/last updated:/i)).toBeInTheDocument()
  })

  it('discloses the AI processor, database, and OAuth providers by name', () => {
    render(<PrivacyPolicyPage />)
    const bodyText = document.body.textContent ?? ''
    expect(bodyText).toMatch(/anthropic/i)
    expect(bodyText).toMatch(/mongodb/i)
    expect(bodyText).toMatch(/google/i)
    expect(bodyText).toMatch(/github/i)
  })

  it('states that no third-party analytics or tracking is used', () => {
    render(<PrivacyPolicyPage />)
    expect(document.body.textContent).toMatch(/do not use any advertising, analytics, or tracking services/i)
  })

  it('links the contact email as a mailto link', () => {
    render(<PrivacyPolicyPage />)
    const contactLinks = screen.getAllByRole('link', { name: /idan\.rbel@gmail\.com/i })
    expect(contactLinks.length).toBeGreaterThan(0)
    for (const link of contactLinks) {
      expect(link).toHaveAttribute('href', 'mailto:idan.rbel@gmail.com')
    }
  })

  // The gap this phase closed. The policy committed to access, correction and
  // deletion rights while the product had no settings page, so the only route
  // to any of them was an email and a wait. Both rights are now self-serve, and
  // the policy has to say where.
  it('points at the settings page where those rights can be exercised', () => {
    render(<PrivacyPolicyPage />)
    const links = screen.getAllByRole('link', { name: /your account settings/i })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/dashboard/settings')
    }
  })
})
