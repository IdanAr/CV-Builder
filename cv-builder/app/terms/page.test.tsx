// @vitest-environment jsdom
// app/terms/page.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { mockPlasmaGlobals } from '@/test/mock-plasma'
import TermsOfUsePage from './page'

describe('Terms of Use page', () => {
  beforeEach(() => {
    mockPlasmaGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the title and last-updated date', () => {
    render(<TermsOfUsePage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeInTheDocument()
    expect(screen.getByText(/last updated:/i)).toBeInTheDocument()
  })

  it('includes an AI-generated content disclaimer', () => {
    render(<TermsOfUsePage />)
    const bodyText = document.body.textContent ?? ''
    expect(bodyText).toMatch(/solely responsible for reviewing all ai-generated content/i)
    expect(bodyText).toMatch(/not a guarantee of any interview, offer, or other employment outcome/i)
  })

  it('states the minimum age requirement', () => {
    render(<TermsOfUsePage />)
    expect(document.body.textContent).toMatch(/at least 16 years old/i)
  })

  it('links the contact email as a mailto link', () => {
    render(<TermsOfUsePage />)
    const contactLinks = screen.getAllByRole('link', { name: /idan\.rbel@gmail\.com/i })
    expect(contactLinks.length).toBeGreaterThan(0)
    for (const link of contactLinks) {
      expect(link).toHaveAttribute('href', 'mailto:idan.rbel@gmail.com')
    }
  })

  // Carried over from the in-app Terms modal when that duplicate was deleted.
  // Everything else the modal said was already covered here or stated more
  // fully in the privacy policy; this clause was not, and for a résumé tool it
  // is not a throwaway line.
  it('prohibits generating false employment credentials', () => {
    render(<TermsOfUsePage />)
    expect(screen.getByText(/false or misleading employment credentials/i)).toBeInTheDocument()
  })
})
