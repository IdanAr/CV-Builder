// @vitest-environment jsdom
// app/(auth)/signin/page.test.tsx
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
  signIn: vi.fn(),
}))

describe('SignIn page', () => {
  beforeEach(() => {
    mockPlasmaGlobals()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('redirects already-signed-in visitors to /dashboard', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    const { default: SignInPage } = await import('./page')
    await expect(SignInPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })

  it('renders a link back to the homepage for signed-out visitors', async () => {
    authMock.mockResolvedValue(null)
    const { default: SignInPage } = await import('./page')
    const element = await SignInPage({ searchParams: Promise.resolve({}) })
    render(element)
    expect(redirectMock).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })
})
