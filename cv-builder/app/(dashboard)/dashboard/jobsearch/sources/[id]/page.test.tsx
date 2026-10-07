// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const redirectMock = vi.fn()
const notFoundMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    throw new Error('NEXT_REDIRECT')
  },
  notFound: () => {
    notFoundMock()
    throw new Error('NEXT_NOT_FOUND')
  },
}))
const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => authMock() }))
const getProfileMock = vi.fn()
vi.mock('@/lib/api/jobsearch-profiles', () => ({
  getJobSearchProfile: (u: string, id: string) => getProfileMock(u, id),
}))
const listRulesMock = vi.fn()
vi.mock('@/lib/api/jobsearch-rules', () => ({
  listRulesForProfile: (u: string, id: string) => listRulesMock(u, id),
}))
vi.mock('@/components/jobsearch/RuleBuilder', () => ({
  RuleBuilder: ({ profileId }: { profileId: string }) => <div data-testid="rules">{profileId}</div>,
}))
vi.mock('@/components/jobsearch/ProfileSettings', () => ({
  ProfileSettings: ({ profileId }: { profileId: string }) => <div data-testid="settings">{profileId}</div>,
}))

async function renderPage(tab?: string) {
  const { default: Page } = await import('./page')
  return render(
    await Page({ params: Promise.resolve({ id: 'p1' }), searchParams: Promise.resolve({ tab }) })
  )
}

describe('sources profile page', () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    getProfileMock.mockResolvedValue({ _id: 'p1', name: 'Backend' })
    listRulesMock.mockResolvedValue([{}, {}])
  })
  afterEach(() => vi.clearAllMocks())

  it('redirects signed-out visitors to /signin', async () => {
    authMock.mockResolvedValue(null)
    const { default: Page } = await import('./page')
    await expect(
      Page({ params: Promise.resolve({ id: 'p1' }), searchParams: Promise.resolve({}) })
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/signin')
  })

  it('shows Rules by default', async () => {
    await renderPage()
    expect(screen.getByTestId('rules')).toHaveTextContent('p1')
    expect(screen.queryByTestId('settings')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Rules/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Rules/ })).toHaveAttribute('href', '/dashboard/jobsearch/sources/p1')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/dashboard/jobsearch/sources/p1?tab=settings'
    )
  })

  it('shows Settings for ?tab=settings', async () => {
    await renderPage('settings')
    expect(screen.getByTestId('settings')).toHaveTextContent('p1')
    expect(screen.queryByTestId('rules')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  })

  it('falls back to Rules for an unknown tab', async () => {
    await renderPage('jobs')
    expect(screen.getByTestId('rules')).toBeInTheDocument()
  })

  it('links back to Sources and rules and out to the pipeline', async () => {
    await renderPage()
    expect(screen.getByRole('link', { name: /Sources and rules/ })).toHaveAttribute(
      'href',
      '/dashboard/jobsearch/sources'
    )
    expect(screen.getByRole('link', { name: 'View jobs' })).toHaveAttribute(
      'href',
      '/dashboard/jobsearch?profile=p1'
    )
  })

  it('404s for a missing profile', async () => {
    getProfileMock.mockResolvedValue(null)
    const { default: Page } = await import('./page')
    await expect(
      Page({ params: Promise.resolve({ id: 'p1' }), searchParams: Promise.resolve({}) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('scopes every fetch to the session user', async () => {
    await renderPage()
    expect(getProfileMock).toHaveBeenCalledWith('user-1', 'p1')
    expect(listRulesMock).toHaveBeenCalledWith('user-1', 'p1')
  })
})
