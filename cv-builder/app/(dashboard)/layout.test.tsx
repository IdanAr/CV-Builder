// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Loading the WebGL background in an authenticated route is the regression
// this guards: the mock throws if anything imports it.
vi.mock('@/components/ui/PlasmaBackground', () => {
  throw new Error('PlasmaBackground must not be used on authenticated routes')
})

const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => authMock() }))
const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    throw new Error('NEXT_REDIRECT')
  },
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
const cookieStore = { get: vi.fn() }
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }))
const countStages = vi.fn()
vi.mock('@/lib/api/scraped-jobs', () => ({ countPipelineStages: (id: string) => countStages(id) }))
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))

import DashboardLayout from './layout'

const session = { user: { id: 'u1', name: 'Idan', email: 'idan@example.com' } }

describe('(dashboard) layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue(session)
    cookieStore.get.mockReturnValue(undefined)
    countStages.mockResolvedValue({ found: 0, matched: 2, drafted: 1, ready: 0, applied: 0, waiting: 3 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ waiting: 3 }) }))
  })

  it('redirects to sign-in without a session', async () => {
    authMock.mockResolvedValue(null)
    await expect(DashboardLayout({ children: <p>x</p> })).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/signin')
  })

  it('renders the shell around the page with the skip-link target', async () => {
    render(await DashboardLayout({ children: <p>content</p> }))
    expect(document.getElementById('main-content')).not.toBeNull()
    expect(screen.getByText('content')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-desktop').className).toContain('w-[232px]')
  })

  it('honours the saved collapsed cookie on the first render', async () => {
    cookieStore.get.mockImplementation((name: string) => (name === 'cvb-sidebar' ? { value: 'collapsed' } : undefined))
    render(await DashboardLayout({ children: <p>content</p> }))
    expect(screen.getByTestId('sidebar-desktop').className).toContain('w-14')
  })

  it('passes the waiting count for the signed-in user to the sidebar', async () => {
    render(await DashboardLayout({ children: <p>content</p> }))
    expect(countStages).toHaveBeenCalledWith('u1')
    expect(screen.getByRole('link', { name: /job search/i })).toHaveTextContent('3')
  })
})
