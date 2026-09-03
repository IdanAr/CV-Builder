// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardNavActions } from './DashboardNavActions'

// JobSearchNav fetches its unread count on mount.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) })
  )
})

const user = { name: 'Ada Lovelace', email: 'ada@example.com', image: null }

describe('DashboardNavActions', () => {
  it('never links a section to itself', () => {
    render(<DashboardNavActions user={user} current="jobsearch" />)

    expect(screen.getByRole('link', { name: 'My CVs' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Applications' })).toBeInTheDocument()
  })

  it('omits the Applications link while on the applications page', () => {
    render(<DashboardNavActions user={user} current="applications" />)

    expect(screen.getByRole('link', { name: 'My CVs' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Applications' })).not.toBeInTheDocument()
  })

  it('omits the My CVs link while on the résumé library', () => {
    render(<DashboardNavActions user={user} current="resumes" />)

    expect(screen.queryByRole('link', { name: 'My CVs' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Applications' })).toBeInTheDocument()
  })

  it('shows the marketing homepage link only when asked', () => {
    const { rerender } = render(<DashboardNavActions user={user} current="resumes" />)
    expect(screen.queryByRole('link', { name: 'Homepage' })).not.toBeInTheDocument()

    rerender(<DashboardNavActions user={user} current="resumes" showHomepage />)
    expect(screen.getByRole('link', { name: 'Homepage' })).toHaveAttribute('href', '/')
  })

  it('renders leading actions ahead of the navigation cluster', () => {
    render(
      <DashboardNavActions
        user={user}
        current="resumes"
        leading={<button type="button">New CV</button>}
      />
    )

    expect(screen.getByRole('button', { name: 'New CV' })).toBeInTheDocument()
  })

  it('always carries the job search menu and the profile button', async () => {
    render(<DashboardNavActions user={user} current="applications" />)

    expect(await screen.findByLabelText('Job search menu')).toBeInTheDocument()
    // The profile trigger shows initials; the full name lives inside its menu.
    expect(screen.getByText('AL')).toBeInTheDocument()
  })
})
