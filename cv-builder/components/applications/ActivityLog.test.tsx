// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActivityLog, formatActivityLine } from './ActivityLog'
import type { ActivityEntry } from '@/lib/applications/types'

const entries: ActivityEntry[] = [
  {
    _id: 'ev2',
    field: 'status',
    fieldLabel: 'Status',
    fromValue: 'Applied',
    toValue: 'Interviewing',
    changedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    _id: 'ev1',
    field: 'company',
    fieldLabel: 'Company',
    fromValue: null,
    toValue: 'Acme',
    changedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  },
]

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('formatActivityLine', () => {
  it('formats a change as "{label} changed from \'{from}\' to \'{to}\'"', () => {
    expect(formatActivityLine(entries[0])).toBe("Status changed from 'Applied' to 'Interviewing'")
  })

  it('renders null values as an em dash', () => {
    expect(formatActivityLine(entries[1])).toBe("Company changed from — to 'Acme'")
  })
})

describe('ActivityLog', () => {
  it('fetches and lists the log when opened, with relative timestamps', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ activity: entries }) })
    )
    render(<ActivityLog applicationId="a1" company="Acme" />)

    fireEvent.click(screen.getByRole('button', { name: 'Activity log for application at Acme' }))

    expect(fetch).toHaveBeenCalledWith('/api/applications/a1/activity')
    expect(
      await screen.findByText("Status changed from 'Applied' to 'Interviewing'")
    ).toBeInTheDocument()
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument()
    expect(screen.getByText('2 hours ago')).toBeInTheDocument()
  })

  it('shows an empty-state line when there is no activity yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ activity: [] }) })
    )
    render(<ActivityLog applicationId="a1" company="Acme" />)

    fireEvent.click(screen.getByRole('button', { name: /Activity log/ }))
    expect(await screen.findByText(/No changes yet/)).toBeInTheDocument()
  })

  it('shows an error line when the fetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    render(<ActivityLog applicationId="a1" company="Acme" />)

    fireEvent.click(screen.getByRole('button', { name: /Activity log/ }))
    expect(await screen.findByText(/Could not load/)).toBeInTheDocument()
  })
})
