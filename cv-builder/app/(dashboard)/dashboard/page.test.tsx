// @vitest-environment jsdom
// app/(dashboard)/dashboard/page.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

const listApplicationsMock = vi.fn()
vi.mock('@/lib/api/applications', () => ({
  listApplications: (userId: string) => listApplicationsMock(userId),
}))

const getOrCreateBoardConfigMock = vi.fn()
vi.mock('@/lib/api/board-config', () => ({
  getOrCreateBoardConfig: (userId: string) => getOrCreateBoardConfigMock(userId),
}))

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) }))
  })

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
    listApplicationsMock.mockResolvedValue([])
    getOrCreateBoardConfigMock.mockResolvedValue({ columns: [], sort: [] })
    const { default: DashboardPage } = await import('./page')
    const element = await DashboardPage()
    render(element)
    expect(redirectMock).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /^homepage$/i })).toHaveAttribute('href', '/')

    await userEvent.click(await screen.findByLabelText('Job search menu'))
    expect(screen.getByRole('menuitem', { name: /Job Matches/ })).toHaveAttribute(
      'href',
      '/dashboard/jobsearch/notifications'
    )
    expect(screen.getByRole('menuitem', { name: 'Profiles' })).toHaveAttribute('href', '/dashboard/jobsearch')
  })
})
