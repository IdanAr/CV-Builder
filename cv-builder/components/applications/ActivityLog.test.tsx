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

  it('renders null values as a hyphen', () => {
    expect(formatActivityLine(entries[1])).toBe("Company changed from - to 'Acme'")
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

  it('announces the panel as a live region so loading-to-loaded transitions are heard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ activity: entries }) })
    )
    render(<ActivityLog applicationId="a1" company="Acme" />)

    fireEvent.click(screen.getByRole('button', { name: 'Activity log for application at Acme' }))
    const panel = (await screen.findByText('Activity')).closest('[role="status"]')
    expect(panel).toHaveAttribute('aria-live', 'polite')
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

  it('closes on Escape and returns focus to the trigger button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ activity: [] }) })
    )
    render(<ActivityLog applicationId="a1" company="Acme" />)
    const trigger = screen.getByRole('button', { name: /Activity log/ })
    fireEvent.click(trigger)
    await screen.findByText('Activity')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByText('Activity')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  describe('viewport-aware flip', () => {
    // jsdom returns an all-zero rect for every element by default. The
    // component measures two different divs — its outer trigger wrapper
    // (`relative`, exact match so it isn't confused with any other element)
    // and the popover panel (`shadow-xl`, unique to this panel) — so this
    // mock distinguishes them by className to simulate the trigger sitting
    // near the bottom of a short viewport with a panel too tall to fit below it.
    function mockRects({
      triggerTop,
      triggerBottom,
      panelHeight,
    }: {
      triggerTop: number
      triggerBottom: number
      panelHeight: number
    }) {
      return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement
      ) {
        if (this.className === 'relative') {
          return {
            top: triggerTop, bottom: triggerBottom, left: 0, right: 100, width: 100,
            height: triggerBottom - triggerTop, x: 0, y: triggerTop, toJSON: () => ({}),
          } as DOMRect
        }
        if (this.className.includes('shadow-xl')) {
          return {
            top: 0, bottom: panelHeight, left: 0, right: 100, width: 100,
            height: panelHeight, x: 0, y: 0, toJSON: () => ({}),
          } as DOMRect
        }
        return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
      })
    }

    it('opens downward (top-full) by default when there is enough room below', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ activity: [] }) }))
      vi.stubGlobal('innerHeight', 800)
      const rectSpy = mockRects({ triggerTop: 100, triggerBottom: 120, panelHeight: 200 })

      render(<ActivityLog applicationId="a1" company="Acme" />)
      fireEvent.click(screen.getByRole('button', { name: /Activity log/ }))

      const panel = (await screen.findByText('Activity')).closest('div.absolute') as HTMLElement
      expect(panel).toHaveClass('top-full')
      expect(panel).not.toHaveClass('bottom-full')

      rectSpy.mockRestore()
      vi.unstubAllGlobals()
    })

    it('flips upward (bottom-full) when opening below would overflow the viewport', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ activity: [] }) }))
      // Short viewport + trigger low on the page: below (600 + 8 + 200 = 808)
      // exceeds innerHeight, but above (600 - 200 - 8 = 392 > 0) fits.
      vi.stubGlobal('innerHeight', 650)
      const rectSpy = mockRects({ triggerTop: 580, triggerBottom: 600, panelHeight: 200 })

      render(<ActivityLog applicationId="a1" company="Acme" />)
      fireEvent.click(screen.getByRole('button', { name: /Activity log/ }))

      const panel = (await screen.findByText('Activity')).closest('div.absolute') as HTMLElement
      expect(panel).toHaveClass('bottom-full')
      expect(panel).not.toHaveClass('top-full')

      rectSpy.mockRestore()
      vi.unstubAllGlobals()
    })
  })
})
