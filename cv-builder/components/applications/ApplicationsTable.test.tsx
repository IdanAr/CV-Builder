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
    customFields: {},
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
    // Leading grip-spacer + one per column (each contains its drag grip) + actions.
    expect(headers.map((h) => h.textContent?.replace('⠿', ''))).toEqual([
      '',
      'Company',
      'Role',
      'Status',
      'Resume',
      'Applied',
      'Notes',
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

  it('fires onDeleteRow', () => {
    const { onDeleteRow } = renderTable()

    fireEvent.click(screen.getByRole('button', { name: 'Delete application at Acme' }))
    expect(onDeleteRow).toHaveBeenCalledWith('a1')
  })
})
