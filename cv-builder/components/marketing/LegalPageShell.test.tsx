// @vitest-environment jsdom
// components/marketing/LegalPageShell.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { mockPlasmaGlobals } from '@/test/mock-plasma'
import { LegalPageShell } from './LegalPageShell'

describe('LegalPageShell', () => {
  beforeEach(() => {
    mockPlasmaGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the title, last-updated date, and children content', () => {
    render(
      <LegalPageShell title="Privacy Policy" lastUpdated="August 9, 2026">
        <p>Body content goes here.</p>
      </LegalPageShell>
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getByText(/last updated: august 9, 2026/i)).toBeInTheDocument()
    expect(screen.getByText('Body content goes here.')).toBeInTheDocument()
  })

  it('renders the navbar logo linking to the homepage and the footer', () => {
    render(
      <LegalPageShell title="Terms of Use" lastUpdated="August 9, 2026">
        <p>Body</p>
      </LegalPageShell>
    )
    expect(screen.getByRole('link', { name: /cv builder home/i })).toHaveAttribute('href', '/')
    expect(screen.getAllByRole('link', { name: /sign in/i }).length).toBeGreaterThan(0)
  })
})
