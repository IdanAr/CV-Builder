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

const countPipelineStagesMock = vi.fn()
vi.mock('@/lib/api/scraped-jobs', () => ({
  countPipelineStages: (userId: string) => countPipelineStagesMock(userId),
}))

const listProfilesMock = vi.fn()
vi.mock('@/lib/api/jobsearch-profiles', () => ({
  listJobSearchProfiles: (userId: string) => listProfilesMock(userId),
}))

const signedIn = { user: { id: 'user-1', name: 'Jordan Lee', email: 'jordan@example.com' } }
const zero = { found: 0, matched: 0, drafted: 0, ready: 0, applied: 0, matchedUnread: 0, waiting: 0 }

function cv(id: string, title: string, hoursAgo: number) {
  const updatedAt = new Date(Date.now() - hoursAgo * 3600_000)
  return { _id: id, title, updatedAt, createdAt: updatedAt, formatScore: 20 }
}

async function renderPage() {
  const { default: DashboardPage } = await import('./page')
  render(await DashboardPage())
}

describe('Overview page', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('redirects signed-out visitors to /signin', async () => {
    authMock.mockResolvedValue(null)
    const { default: DashboardPage } = await import('./page')
    await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/signin')
  })

  it('renders greeting, stage links with counts and the three most recent CVs', async () => {
    authMock.mockResolvedValue(signedIn)
    listResumesMock.mockResolvedValue([
      cv('r4', 'Oldest CV', 100),
      cv('r1', 'Newest CV', 1),
      cv('r3', 'Third CV', 30),
      cv('r2', 'Second CV', 10),
    ])
    countPipelineStagesMock.mockResolvedValue({ found: 9, matched: 4, drafted: 1, ready: 2, applied: 3, matchedUnread: 4, waiting: 7 })
    listProfilesMock.mockResolvedValue([{ _id: 'p1' }])
    await renderPage()

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Welcome back, Jordan')
    expect(screen.getByText('7 items waiting on you')).toBeInTheDocument()
    for (const name of ['Found 9', 'Matched 4', 'Drafted 1', 'Ready 2', 'Applied 3']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: /Newest CV/ })).toHaveAttribute('href', '/dashboard/resumes/r1')
    expect(screen.getByRole('link', { name: /Second CV/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Third CV/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Oldest CV/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^homepage$/i })).not.toBeInTheDocument()
  })

  it('greets without a name when the account has none', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1', name: null, email: 'jordan@example.com' } })
    listResumesMock.mockResolvedValue([cv('r1', 'My CV', 2)])
    countPipelineStagesMock.mockResolvedValue(zero)
    listProfilesMock.mockResolvedValue([])
    await renderPage()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Welcome back')
  })

  it('shows the first-run cards when there are no CVs and no profiles', async () => {
    authMock.mockResolvedValue(signedIn)
    listResumesMock.mockResolvedValue([])
    countPipelineStagesMock.mockResolvedValue(zero)
    listProfilesMock.mockResolvedValue([])
    await renderPage()
    expect(screen.getByText('Create your first CV')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Set up a job search' })).toBeInTheDocument()
    expect(screen.queryByText('Job search pipeline')).not.toBeInTheDocument()
  })

  it("shows You're caught up when nothing waits", async () => {
    authMock.mockResolvedValue(signedIn)
    listResumesMock.mockResolvedValue([cv('r1', 'My CV', 2)])
    countPipelineStagesMock.mockResolvedValue({ ...zero, found: 3 })
    listProfilesMock.mockResolvedValue([])
    await renderPage()
    expect(screen.getByText("You're caught up.")).toBeInTheDocument()
    expect(screen.queryByText(/waiting on you/)).not.toBeInTheDocument()
  })
})
