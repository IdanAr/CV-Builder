// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ApplicationsTable from './ApplicationsTable'
import { defaultBoardColumns } from '@/lib/schemas/application.zod'
import type { ApplicationRow } from '@/lib/applications/types'

const apps: ApplicationRow[] = [
  {
    _id: 'a1',
    resumeId: 'r1',
    company: 'Acme',
    role: 'Engineer',
    status: 'applied',
    order: 1000,
    customFields: { 'col-link': 'https://linkedin.com/in/jordanavery/details/' },
    resumeTitle: 'Backend CV',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
  },
  {
    _id: 'a2',
    company: 'Globex',
    role: 'PM',
    status: 'offer',
    order: 2000,
    customFields: { 'col-notes': 'phone screen done' },
    createdAt: '2026-07-02T10:00:00.000Z',
    updatedAt: '2026-07-02T10:00:00.000Z',
  },
]

const columns = [
  ...defaultBoardColumns(),
  {
    id: 'col-notes',
    key: 'col-notes',
    label: 'Notes',
    type: 'text' as const,
    isBuiltIn: false,
    order: 6000,
  },
  {
    id: 'col-link',
    key: 'col-link',
    label: 'Link',
    type: 'url' as const,
    isBuiltIn: false,
    order: 7000,
  },
]

function renderTable(overrides: Partial<React.ComponentProps<typeof ApplicationsTable>> = {}) {
  const onCellChange = vi.fn()
  const onDeleteRow = vi.fn()
  render(
    <ApplicationsTable
      applications={apps}
      columns={columns}
      resumes={[{ id: 'r1', title: 'Backend CV' }]}
      onCellChange={onCellChange}
      onDeleteRow={onDeleteRow}
      {...overrides}
    />
  )
  return { onCellChange, onDeleteRow }
}

describe('ApplicationsTable', () => {
  it('renders one column header per configured column, in order', () => {
    renderTable()
    const headers = screen.getAllByRole('columnheader')
    // Leading grip-spacer + one per column (each contains its drag grip,
    // now an icon that contributes no text content) + actions.
    expect(headers.map((h) => h.textContent)).toEqual([
      '',
      'Company',
      'Role',
      'Status',
      'Resume',
      'Applied',
      'Notes',
      'Link',
      '', // actions column
    ])
  })

  it('disables row drag handles while a column sort is active, with an explanatory tooltip', () => {
    renderTable({ rowDragEnabled: false })
    const grip = screen.getByRole('button', { name: 'Reorder application at Acme' })
    expect(grip).toBeDisabled()
    expect(grip).toHaveAttribute('title', expect.stringMatching(/sort/i))
  })

  it('enables row drag handles when no column sort is active', () => {
    renderTable({ rowDragEnabled: true })
    expect(screen.getByRole('button', { name: 'Reorder application at Acme' })).toBeEnabled()
  })

  it('renders a drag grip on every column header', () => {
    renderTable()
    expect(screen.getByRole('button', { name: 'Reorder Notes column' })).toBeInTheDocument()
  })

  it('renders built-in and custom field values, including the status option label', () => {
    renderTable()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('phone screen done')).toBeInTheDocument()
    // Status chip shows the option label, not the 'applied' option id (the
    // 'Applied' date column header also matches, hence the role-scoped query).
    const statusChip = screen.getByRole('button', { name: 'Change Status for Acme' })
    expect(statusChip).toHaveTextContent('Applied')
    expect(screen.getByText('Offer')).toBeInTheDocument()
  })

  it('commits an inline text edit on Enter with the edited value', () => {
    const { onCellChange } = renderTable()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Company for Acme' }))
    const input = screen.getByRole('textbox', { name: 'Company for Acme' })
    fireEvent.change(input, { target: { value: 'Acme Corp' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onCellChange).toHaveBeenCalledTimes(1)
    const [appId, column, value] = onCellChange.mock.calls[0]
    expect(appId).toBe('a1')
    expect(column.key).toBe('company')
    expect(value).toBe('Acme Corp')
  })

  it('does not commit when the edit is cancelled with Escape', () => {
    const { onCellChange } = renderTable()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Company for Acme' }))
    const input = screen.getByRole('textbox', { name: 'Company for Acme' })
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onCellChange).not.toHaveBeenCalled()
  })

  it('changes status via the option dropdown, committing the option id', () => {
    const { onCellChange } = renderTable()

    fireEvent.click(screen.getByRole('button', { name: 'Change Status for Acme' }))
    fireEvent.click(screen.getByRole('button', { name: /Interviewing/ }))

    expect(onCellChange).toHaveBeenCalledTimes(1)
    const [appId, column, value] = onCellChange.mock.calls[0]
    expect(appId).toBe('a1')
    expect(column.key).toBe('status')
    expect(value).toBe('interviewing')
  })

  it('links the resume column via a select of the user resumes', () => {
    const { onCellChange } = renderTable()

    const select = screen.getByRole('combobox', { name: 'Resume for Globex' })
    fireEvent.change(select, { target: { value: 'r1' } })

    const [appId, column, value] = onCellChange.mock.calls[0]
    expect(appId).toBe('a2')
    expect(column.key).toBe('resumeId')
    expect(value).toBe('r1')
  })

  it('renders the URL cell link text as the hostname, keeping the full URL in href and title', () => {
    renderTable()

    const link = screen.getByRole('link', { name: 'linkedin.com' })
    expect(link).toHaveAttribute('href', 'https://linkedin.com/in/jordanavery/details/')
    expect(link).toHaveAttribute('title', 'https://linkedin.com/in/jordanavery/details/')
  })

  it('falls back to the raw string for a URL cell value that is not a parseable URL', () => {
    renderTable({
      applications: [
        {
          ...apps[0],
          customFields: { 'col-link': 'not a url' },
        },
        apps[1],
      ],
    })

    expect(screen.getByRole('link', { name: 'not a url' })).toBeInTheDocument()
  })

  it('fires onDeleteRow', () => {
    const { onDeleteRow } = renderTable()

    fireEvent.click(screen.getByRole('button', { name: 'Delete application at Acme' }))
    expect(onDeleteRow).toHaveBeenCalledWith('a1')
  })

  it('header row is sticky with opaque background', () => {
    renderTable()
    const columnHeaders = screen.getAllByRole('columnheader')
    const headerRow = columnHeaders[0].closest('[role="row"]')
    expect(headerRow).toHaveClass('sticky')
    expect(headerRow).toHaveClass('top-0')
    expect(headerRow).toHaveClass('z-10')
    expect(headerRow).toHaveClass('bg-white')
  })

  describe('SelectCell viewport-aware flip', () => {
    // jsdom returns an all-zero rect for every element by default. The
    // component measures two different divs — its trigger wrapper (exact
    // class match `relative px-1 py-0.5`, unique to SelectCell's container)
    // and the popover panel (`shadow-lg`, unique to this dropdown) — so this
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
        if (this.className === 'relative px-1 py-0.5') {
          return {
            top: triggerTop, bottom: triggerBottom, left: 0, right: 100, width: 100,
            height: triggerBottom - triggerTop, x: 0, y: triggerTop, toJSON: () => ({}),
          } as DOMRect
        }
        if (this.className.includes('shadow-lg')) {
          return {
            top: 0, bottom: panelHeight, left: 0, right: 100, width: 100,
            height: panelHeight, x: 0, y: 0, toJSON: () => ({}),
          } as DOMRect
        }
        return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
      })
    }

    it('opens downward (top-full) by default when there is enough room below', () => {
      vi.stubGlobal('innerHeight', 800)
      const rectSpy = mockRects({ triggerTop: 100, triggerBottom: 120, panelHeight: 150 })

      renderTable()
      fireEvent.click(screen.getByRole('button', { name: 'Change Status for Acme' }))

      const panel = screen.getByText('Clear').closest('div.absolute') as HTMLElement
      expect(panel).toHaveClass('top-full')
      expect(panel).not.toHaveClass('bottom-full')

      rectSpy.mockRestore()
      vi.unstubAllGlobals()
    })

    it('flips upward (bottom-full) when opening below would overflow the viewport', () => {
      // Short viewport + trigger low on the page: below (600 + 8 + 150 = 758)
      // exceeds innerHeight, but above (600 - 150 - 8 = 442 > 0) fits.
      vi.stubGlobal('innerHeight', 650)
      const rectSpy = mockRects({ triggerTop: 580, triggerBottom: 600, panelHeight: 150 })

      renderTable()
      fireEvent.click(screen.getByRole('button', { name: 'Change Status for Acme' }))

      const panel = screen.getByText('Clear').closest('div.absolute') as HTMLElement
      expect(panel).toHaveClass('bottom-full')
      expect(panel).not.toHaveClass('top-full')

      rectSpy.mockRestore()
      vi.unstubAllGlobals()
    })
  })
})
