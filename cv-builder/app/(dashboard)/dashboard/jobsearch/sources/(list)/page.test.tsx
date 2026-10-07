// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    throw new Error('NEXT_REDIRECT')
  },
}))
const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => authMock() }))
const listMock = vi.fn()
vi.mock('@/lib/api/jobsearch-profiles', () => ({
  listJobSearchProfiles: (userId: string) => listMock(userId),
}))
vi.mock('@/components/jobsearch/ProfileList', () => ({
  ProfileList: (props: unknown) => <div data-testid="list" data-props={JSON.stringify(props)} />,
}))

describe('sources page', () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    listMock.mockResolvedValue([{ _id: 'p1', name: 'Backend' }])
  })
  afterEach(() => vi.clearAllMocks())

  it('redirects signed-out visitors to /signin', async () => {
    authMock.mockResolvedValue(null)
    const { default: Page } = await import('./page')
    await expect(Page()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/signin')
    expect(listMock).not.toHaveBeenCalled()
  })

  it('renders the shell with a way back to the pipeline and the user-scoped profiles', async () => {
    const { default: Page } = await import('./page')
    render(await Page())
    expect(listMock).toHaveBeenCalledWith('user-1')
    expect(screen.getByRole('heading', { name: 'Sources and rules' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Pipeline/ })).toHaveAttribute('href', '/dashboard/jobsearch')
    expect(screen.queryByRole('navigation', { name: 'Job search views' })).not.toBeInTheDocument()
    expect(screen.getByTestId('list').dataset.props).toContain('Backend')
  })
})
