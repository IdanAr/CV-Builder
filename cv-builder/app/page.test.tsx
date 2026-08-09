// @vitest-environment jsdom
// app/page.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { mockPlasmaGlobals } from '@/test/mock-plasma'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    throw new Error('NEXT_REDIRECT')
  },
}))

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

  it('redirects signed-in visitors to /dashboard', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    const { default: Home } = await import('./page')
    await expect(Home()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })

  it('renders the marketing homepage for signed-out visitors', async () => {
    authMock.mockResolvedValue(null)
    const { default: Home } = await import('./page')
    const element = await Home()
    render(element)
    expect(redirectMock).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1, name: /create a job-winning cv in minutes/i })).toBeInTheDocument()
    expect(screen.getByText(/helping thousands land jobs at top companies/i)).toBeInTheDocument() // SocialProofSection
    expect(screen.getByRole('heading', { name: /write with ai/i })).toBeInTheDocument() // FeaturesSection
    expect(screen.getByRole('heading', { name: /templates designed by recruiters/i })).toBeInTheDocument() // TemplatesShowcaseSection
    expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument() // HowItWorksSection
    expect(screen.getByRole('heading', { name: /success stories/i })).toBeInTheDocument() // TestimonialsSection
    expect(screen.getByRole('heading', { name: /frequently asked questions/i })).toBeInTheDocument() // FaqSection
    expect(screen.getByRole('heading', { name: /ready to land your dream job/i })).toBeInTheDocument() // FinalCtaSection
  })
})
