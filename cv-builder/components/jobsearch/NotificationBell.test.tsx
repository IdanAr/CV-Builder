// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationBell } from './NotificationBell'

describe('NotificationBell', () => {
  it('shows the unread count badge when there are unread matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 3 }) }))

    render(<NotificationBell />)

    expect(await screen.findByText('3')).toBeInTheDocument()
  })

  it('shows no badge when the unread count is zero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) }))

    render(<NotificationBell />)

    await screen.findByLabelText('Job matches')
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('caps the displayed badge at "99+"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 150 }) }))

    render(<NotificationBell />)

    expect(await screen.findByText('99+')).toBeInTheDocument()
  })

  it('links to the job matches page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) }))

    render(<NotificationBell />)

    const link = await screen.findByLabelText('Job matches')
    expect(link).toHaveAttribute('href', '/dashboard/jobsearch/notifications')
  })
})
