// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    throw new Error('NEXT_REDIRECT')
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const cookieValues = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieValues.has(name) ? { name, value: cookieValues.get(name) } : undefined),
  }),
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

// The cards view renders real CV templates; that is CvThumbnail's own test.
vi.mock('@/components/cvs/CvThumbnail', () => ({
  CvThumbnail: () => <div data-testid="thumb" />,
}))

function listedResume(id: string, title: string) {
  return {
    _id: id,
    title,
    data: { basics: { label: 'Engineer' } },
    meta: { templateId: 'classic', layout: 'single-column' },
    sectionsFilledCount: 3,
    formatScore: 21,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    pendingApprovals: [],
  }
}

describe('CVs page', () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: 'user-1', name: 'Jordan' } })
    listResumesMock.mockResolvedValue([listedResume('r1', 'Backend CV'), listedResume('r2', 'Frontend CV')])
    listApplicationsMock.mockResolvedValue([{ resumeId: 'r2', status: 'applied' }])
    getOrCreateBoardConfigMock.mockResolvedValue({
      columns: [{ type: 'status', options: [{ id: 'applied', label: 'Applied', color: '#2457f5' }] }],
      sort: [],
    })
  })

  afterEach(() => {
    cookieValues.clear()
    vi.clearAllMocks()
  })

  it('redirects signed-out visitors to /signin', async () => {
    authMock.mockResolvedValue(null)
    const { default: CvsPage } = await import('./page')
    await expect(CvsPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/signin')
  })

  it('renders every CV in the table view by default, with its application status', async () => {
    const { default: CvsPage } = await import('./page')
    render(await CvsPage())
    expect(listResumesMock).toHaveBeenCalledWith('user-1')
    expect(screen.getByRole('heading', { level: 1, name: 'CVs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true')
    const table = screen.getByRole('table')
    expect(within(table).getByRole('link', { name: 'Backend CV' })).toHaveAttribute('href', '/dashboard/resumes/r1')
    expect(within(table).getByRole('link', { name: 'Frontend CV' })).toBeInTheDocument()
    const frontendRow = within(table).getByRole('link', { name: 'Frontend CV' }).closest('[role="row"]') as HTMLElement
    expect(within(frontendRow).getByText('Applied')).toBeInTheDocument()
  })

  it('renders the cards view when the cookie remembers it', async () => {
    cookieValues.set('cvb-cvs-view', 'cards')
    const { default: CvsPage } = await import('./page')
    render(await CvsPage())
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByTestId('thumb')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Backend CV' })).toBeInTheDocument()
  })

  it('invites a first CV when the library is empty', async () => {
    listResumesMock.mockResolvedValue([])
    const { default: CvsPage } = await import('./page')
    render(await CvsPage())
    expect(screen.getByText("Let's build your first CV")).toBeInTheDocument()
  })
})

describe('CVs page title', () => {
  it('uses the shared page-title scale', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    listResumesMock.mockResolvedValue([])
    listApplicationsMock.mockResolvedValue([])
    getOrCreateBoardConfigMock.mockResolvedValue({ columns: [], sort: [] })
    const { default: CvsPage } = await import('./page')
    render(await CvsPage())
    expect(screen.getByRole('heading', { level: 1, name: 'CVs' })).toHaveAttribute(
      'class',
      'text-xl font-medium text-fg-heading',
    )
  })
})
