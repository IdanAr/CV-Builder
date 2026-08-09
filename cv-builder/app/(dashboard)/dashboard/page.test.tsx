// @vitest-environment jsdom
// app/(dashboard)/dashboard/page.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    throw new Error('NEXT_REDIRECT')
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}))

const listResumesMock = vi.fn()
vi.mock('@/lib/api/resumes', () => ({
  listResumes: (userId: string) => listResumesMock(userId),
}))

describe('Dashboard page', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('redirects signed-out visitors to /signin', async () => {
    authMock.mockResolvedValue(null)
    const { default: DashboardPage } = await import('./page')
    await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/signin')
  })

  // This link is only a real fix if `/` itself doesn't bounce a signed-in
  // visitor straight back here — that's covered separately in app/page.test.tsx
  // ("renders the marketing homepage for signed-in visitors too").
  it('renders a Homepage link to / for signed-in visitors', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1', name: 'Jordan', email: 'jordan@example.com' } })
    listResumesMock.mockResolvedValue([])
    const { default: DashboardPage } = await import('./page')
    const element = await DashboardPage()
    render(element)
    expect(redirectMock).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /^homepage$/i })).toHaveAttribute('href', '/')
  })
})
