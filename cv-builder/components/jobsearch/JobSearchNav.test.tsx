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

  // The hand-rolled menu this replaced gave both items `tabIndex={-1}` and
  // focused only the first, with no arrow-key handling anywhere — so a keyboard
  // user could open the menu and reach "Profiles" but never "Job Matches".
  it('lets a keyboard user reach every item, not just the first', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) }))

    render(<JobSearchNav />)

    const trigger = await screen.findByLabelText('Job search menu')
    trigger.focus()
    // Opening from the keyboard puts focus on the first item.
    await userEvent.keyboard('{Enter}')
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()
  })

  it('wraps arrow-key focus around both ends of the menu', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) }))

    render(<JobSearchNav />)

    const trigger = await screen.findByLabelText('Job search menu')
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    const items = screen.getAllByRole('menuitem')

    // Down from the last item wraps to the first.
    for (let i = 0; i < items.length; i++) await userEvent.keyboard('{ArrowDown}')
    expect(items[0]).toHaveFocus()

    // Up from the first wraps to the last.
    await userEvent.keyboard('{ArrowUp}')
    expect(items[items.length - 1]).toHaveFocus()
  })

  it('returns focus to the trigger when Escape closes the menu', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) }))

    render(<JobSearchNav />)

    const trigger = await screen.findByLabelText('Job search menu')
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
