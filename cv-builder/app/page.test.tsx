// @vitest-environment jsdom
// app/page.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}))

const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}))

// PlasmaBackground renders a real WebGL context via `ogl`, which jsdom
// doesn't support. Stub it the same way components/ui/Plasma.test.tsx does.
vi.mock('ogl', () => {
  class FakeRenderer {
    gl = {
      canvas: document.createElement('canvas'),
      drawingBufferWidth: 100,
      drawingBufferHeight: 100,
    }
    setSize() {}
    render() {}
  }
  class FakeProgram {
    uniforms: Record<string, { value: unknown }>
    constructor(_gl: unknown, opts: { uniforms: Record<string, { value: unknown }> }) {
      this.uniforms = opts.uniforms
    }
  }
  class FakeMesh {}
  class FakeTriangle {}
  return { Renderer: FakeRenderer, Program: FakeProgram, Mesh: FakeMesh, Triangle: FakeTriangle }
})

// PlasmaBackground also sets up ResizeObserver/IntersectionObserver and reads
// matchMedia (prefers-reduced-motion) on mount — none of which jsdom provides.
// Stub them the same way components/ui/Plasma.test.tsx does.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('Home page', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('redirects signed-in visitors to /dashboard', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    const { default: Home } = await import('./page')
    await Home()
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
