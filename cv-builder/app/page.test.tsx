// @vitest-environment jsdom
// app/page.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { mockPlasmaGlobals } from '@/test/mock-plasma'

const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}))

describe('Home page', () => {
  beforeEach(() => {
    mockPlasmaGlobals()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders the marketing homepage for signed-out visitors, with Sign In / Get Started in the navbar', async () => {
    authMock.mockResolvedValue(null)
    const { default: Home } = await import('./page')
    const element = await Home()
    render(element)
    expect(screen.getByRole('heading', { level: 1, name: /create a job-winning cv in minutes/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /write with ai/i })).toBeInTheDocument() // FeaturesSection
    expect(screen.getByRole('heading', { name: /templates designed by recruiters/i })).toBeInTheDocument() // TemplatesShowcaseSection
    expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument() // HowItWorksSection
    expect(screen.getByRole('heading', { name: /success stories/i })).toBeInTheDocument() // TestimonialsSection
    expect(screen.getByRole('heading', { name: /frequently asked questions/i })).toBeInTheDocument() // FaqSection
    expect(screen.getByRole('heading', { name: /ready to land your dream job/i })).toBeInTheDocument() // FinalCtaSection
    expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/signin')
    expect(screen.queryByRole('link', { name: /^dashboard$/i })).not.toBeInTheDocument()
  })

  it('renders the marketing homepage for signed-in visitors too, with a Dashboard link in the navbar instead', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    const { default: Home } = await import('./page')
    const element = await Home()
    render(element)
    expect(screen.getByRole('heading', { level: 1, name: /create a job-winning cv in minutes/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^dashboard$/i })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('link', { name: /get started/i })).not.toBeInTheDocument()
  })
})
