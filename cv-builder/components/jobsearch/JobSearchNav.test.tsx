// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JobSearchNav } from './JobSearchNav'

describe('JobSearchNav', () => {
  it('shows the unread count badge on the trigger when there are unread matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 3 }) }))

    render(<JobSearchNav />)

    expect(await screen.findByText('3')).toBeInTheDocument()
  })

  it('shows no badge when the unread count is zero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) }))

    render(<JobSearchNav />)

    await screen.findByLabelText('Job search menu')
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('caps the displayed badge at "99+"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 150 }) }))

    render(<JobSearchNav />)

    expect(await screen.findByText('99+')).toBeInTheDocument()
  })

  it('opens a menu with links to Profiles and Job Matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) }))

    render(<JobSearchNav />)

    await userEvent.click(await screen.findByLabelText('Job search menu'))

    expect(screen.getByRole('menuitem', { name: 'Profiles' })).toHaveAttribute('href', '/dashboard/jobsearch')
    expect(screen.getByRole('menuitem', { name: /Job Matches/ })).toHaveAttribute(
      'href',
      '/dashboard/jobsearch/notifications'
    )
  })

  it('closes the menu on Escape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) }))

    render(<JobSearchNav />)

    await userEvent.click(await screen.findByLabelText('Job search menu'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
