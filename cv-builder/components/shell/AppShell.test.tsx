// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

let mockPathname = '/dashboard'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))

import { AppShell } from './AppShell'
import { notifyScrapedJobsChanged } from '@/lib/stores/scraped-jobs.store'

const user = { name: 'Idan Arbel', email: 'idan@example.com', image: null }

function setup(initialCollapsed = false) {
  return render(
    <AppShell user={user} waiting={3} initialCollapsed={initialCollapsed}>
      <p>page content</p>
    </AppShell>
  )
}

function desktopAside() {
  return screen.getByTestId('sidebar-desktop')
}

describe('AppShell', () => {
  beforeEach(() => {
    mockPathname = '/dashboard'
    document.cookie = 'cvb-sidebar=; Max-Age=0; Path=/'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0, waiting: 3 }) }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps the mobile hamburger at a 40px touch target', () => {
    setup()
    const btn = screen.getByRole('button', { name: 'Open navigation' })
    expect(btn.className).toContain('max-md:min-h-10')
    expect(btn.className).toContain('max-md:min-w-10')
  })

  it('renders children inside the skip-link target', () => {
    setup()
    const main = document.getElementById('main-content')
    expect(main).not.toBeNull()
    expect(within(main!).getByText('page content')).toBeInTheDocument()
  })

  it('renders expanded by default and as a rail when the saved preference says collapsed', () => {
    const { unmount } = setup(false)
    expect(desktopAside().className).toContain('w-[232px]')
    unmount()
    setup(true)
    expect(desktopAside().className).toContain('w-14')
  })

  it('collapsing writes the preference cookie and narrows the sidebar', async () => {
    setup(false)
    await userEvent.click(within(desktopAside()).getByRole('button', { name: 'Collapse sidebar' }))
    expect(desktopAside().className).toContain('w-14')
    expect(document.cookie).toContain('cvb-sidebar=collapsed')
    await userEvent.click(within(desktopAside()).getByRole('button', { name: 'Expand sidebar' }))
    expect(desktopAside().className).toContain('w-[232px]')
    expect(document.cookie).toContain('cvb-sidebar=expanded')
  })

  it('on the editor route the rail is forced and expanding opens a drawer without saving a preference', async () => {
    mockPathname = '/dashboard/resumes/abc123'
    setup(false)
    expect(desktopAside().className).toContain('w-14')
    await userEvent.click(within(desktopAside()).getByRole('button', { name: 'Expand sidebar' }))
    const drawer = await screen.findByRole('dialog', { name: /navigation/i })
    expect(within(drawer).getByRole('link', { name: /job search/i })).toBeInTheDocument()
    expect(document.cookie).not.toContain('cvb-sidebar')
  })

  it('marks the editor rail Expand button as opening a dialog, and only there', () => {
    mockPathname = '/dashboard/resumes/abc123'
    const { unmount } = setup(false)
    expect(within(desktopAside()).getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-haspopup',
      'dialog'
    )
    unmount()
    mockPathname = '/dashboard'
    setup(true)
    expect(within(desktopAside()).getByRole('button', { name: 'Expand sidebar' })).not.toHaveAttribute(
      'aria-haspopup'
    )
  })

  it('refreshes the waiting count once per change and shows the live number in a drawer opened later', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0, waiting: 12 }) }))
    setup()
    const desktopJobs = () => within(desktopAside()).getByRole('link', { name: /job search/i })
    expect(desktopJobs()).toHaveTextContent('3')
    act(() => notifyScrapedJobsChanged())
    await waitFor(() => expect(desktopJobs()).toHaveTextContent('12'))
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/jobsearch/notifications/unread-count')

    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const drawer = await screen.findByRole('dialog', { name: /navigation/i })
    expect(within(drawer).getByRole('link', { name: /job search/i })).toHaveTextContent('12')

    // With both sidebars mounted, one change is still one request.
    act(() => notifyScrapedJobsChanged())
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    await act(async () => {})
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('offers a menu button on small screens that opens the drawer', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(await screen.findByRole('dialog', { name: /navigation/i })).toBeInTheDocument()
  })

  it('closes the drawer when a link inside is followed', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const drawer = await screen.findByRole('dialog', { name: /navigation/i })
    // jsdom cannot navigate; keep the click from logging "Not implemented".
    const stopNavigation = (e: Event) => e.preventDefault()
    document.addEventListener('click', stopNavigation)
    try {
      await userEvent.click(within(drawer).getByRole('link', { name: /applications/i }))
    } finally {
      document.removeEventListener('click', stopNavigation)
    }
    expect(screen.queryByRole('dialog', { name: /navigation/i })).not.toBeInTheDocument()
  })

  it('does not render the mobile top bar on the editor route', () => {
    mockPathname = '/dashboard/resumes/abc123'
    setup()
    expect(screen.queryByRole('button', { name: 'Open navigation' })).not.toBeInTheDocument()
  })
})
