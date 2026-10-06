// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

let mockPathname = '/dashboard'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))

import { SidebarNav } from './SidebarNav'
import { notifyScrapedJobsChanged } from '@/lib/stores/scraped-jobs.store'

const user = { name: 'Idan Arbel', email: 'idan@example.com', image: null }

function setup(props: Partial<React.ComponentProps<typeof SidebarNav>> = {}) {
  const onToggle = vi.fn()
  render(<SidebarNav user={user} waiting={0} collapsed={false} onToggle={onToggle} {...props} />)
  return { onToggle }
}

describe('SidebarNav', () => {
  beforeEach(() => {
    mockPathname = '/dashboard'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0, waiting: 0 }) }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('links the four sections and settings', () => {
    setup()
    expect(screen.getByRole('link', { name: /overview/i })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: /^cvs/i })).toHaveAttribute('href', '/dashboard/cvs')
    expect(screen.getByRole('link', { name: /job search/i })).toHaveAttribute('href', '/dashboard/jobsearch')
    expect(screen.getByRole('link', { name: /applications/i })).toHaveAttribute('href', '/dashboard/applications')
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/dashboard/settings')
  })

  it('is a labelled primary navigation', () => {
    setup()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })

  it.each([
    ['/dashboard', /overview/i],
    ['/dashboard/cvs', /^cvs/i],
    ['/dashboard/resumes/abc123', /^cvs/i],
    ['/dashboard/jobsearch/notifications', /job search/i],
    ['/dashboard/applications', /applications/i],
    ['/dashboard/settings', /settings/i],
  ])('marks %s as the current page', (path, name) => {
    mockPathname = path
    setup()
    expect(screen.getByRole('link', { name })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page')).toHaveLength(1)
  })

  it('shows the waiting count as an amber chip with text for screen readers', () => {
    setup({ waiting: 7 })
    const link = screen.getByRole('link', { name: /job search/i })
    expect(link).toHaveTextContent('7')
    expect(link).toHaveTextContent(/items waiting/i)
  })

  it('shows no chip at zero and caps at 99+', () => {
    const { unmount } = render(
      <SidebarNav user={user} waiting={0} collapsed={false} onToggle={() => {}} />
    )
    expect(screen.getByRole('link', { name: /job search/i })).not.toHaveTextContent(/waiting/i)
    unmount()
    render(<SidebarNav user={user} waiting={140} collapsed={false} onToggle={() => {}} />)
    expect(screen.getByRole('link', { name: /job search/i })).toHaveTextContent('99+')
  })

  it('expanded: the toggle says Collapse and reports expanded', async () => {
    const { onToggle } = setup()
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('collapsed: items keep accessible names without visible labels and the toggle says Expand', () => {
    setup({ collapsed: true })
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument()
    expect(screen.queryByText('Overview')).not.toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Expand sidebar' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('refreshes the waiting count when job data changes elsewhere', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0, waiting: 4 }) }))
    setup({ waiting: 1 })
    expect(screen.getByRole('link', { name: /job search/i })).toHaveTextContent('1')
    act(() => notifyScrapedJobsChanged())
    await waitFor(() => expect(screen.getByRole('link', { name: /job search/i })).toHaveTextContent('4'))
    expect(fetch).toHaveBeenCalledWith('/api/jobsearch/notifications/unread-count')
  })

  it('calls onNavigate when a link is followed (closes a drawer)', async () => {
    const onNavigate = vi.fn()
    setup({ onNavigate })
    await userEvent.click(screen.getByRole('link', { name: /applications/i }))
    expect(onNavigate).toHaveBeenCalled()
  })

  it('offers settings, terms, homepage and sign out in the user menu', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /account menu/i }))
    expect(await screen.findByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /homepage/i })).toBeInTheDocument()
  })
})
