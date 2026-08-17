// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from './FilterBar'
import { defaultBoardColumns } from '@/lib/schemas/application.zod'
import type { ColumnFilter } from '@/lib/applications/filter'

const columns = [
  ...defaultBoardColumns(),
  {
    id: 'yearsExp',
    key: 'yearsExp',
    label: 'Years Experience',
    type: 'number' as const,
    isBuiltIn: false,
    order: 6000,
  },
  {
    id: 'followedUp',
    key: 'followedUp',
    label: 'Followed Up',
    type: 'checkbox' as const,
    isBuiltIn: false,
    order: 7000,
  },
]

function openEditorFor(label: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name: '+ Filter' }))
  fireEvent.change(screen.getByLabelText(/filter by/i), {
    target: { value: columns.find((c) => (typeof label === 'string' ? c.label === label : label.test(c.label)))!.id },
  })
}

describe('FilterBar', () => {
  it('shows the existing filter value when reopening the editor for an options-filtered column', () => {
    const filters: ColumnFilter[] = [{ columnId: 'status', kind: 'options', optionIds: ['applied'] }]
    render(<FilterBar columns={columns} filters={filters} onChange={vi.fn()} />)

    openEditorFor('Status')

    expect(screen.getByRole('checkbox', { name: /applied/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /interviewing/i })).not.toBeChecked()
  })

  it('shows the existing filter value when reopening the editor for a range-filtered column', () => {
    const filters: ColumnFilter[] = [{ columnId: 'yearsExp', kind: 'range', min: 2, max: 5 }]
    render(<FilterBar columns={columns} filters={filters} onChange={vi.fn()} />)

    openEditorFor('Years Experience')

    expect(screen.getByLabelText(/minimum years experience/i)).toHaveValue(2)
    expect(screen.getByLabelText(/maximum years experience/i)).toHaveValue(5)
  })

  it('shows the existing filter value when reopening the editor for a text-filtered column', () => {
    const filters: ColumnFilter[] = [{ columnId: 'company', kind: 'text', query: 'Acme' }]
    render(<FilterBar columns={columns} filters={filters} onChange={vi.fn()} />)

    openEditorFor('Company')

    expect(screen.getByLabelText(/company contains/i)).toHaveValue('Acme')
  })

  it('shows the existing filter value when reopening the editor for a checkbox-filtered column', () => {
    const filters: ColumnFilter[] = [{ columnId: 'followedUp', kind: 'checkbox', value: false }]
    render(<FilterBar columns={columns} filters={filters} onChange={vi.fn()} />)

    openEditorFor('Followed Up')

    expect(screen.getByRole('checkbox', { name: /only (un)?checked rows/i })).not.toBeChecked()
  })

  it('shows the existing filter value when reopening the editor for a dateRange-filtered column', () => {
    const filters: ColumnFilter[] = [
      { columnId: 'createdAt', kind: 'dateRange', from: '2026-01-01', to: '2026-02-15' },
    ]
    render(<FilterBar columns={columns} filters={filters} onChange={vi.fn()} />)

    openEditorFor('Applied')

    expect(screen.getByLabelText(/applied from/i)).toHaveValue('2026-01-01')
    expect(screen.getByLabelText(/applied until/i)).toHaveValue('2026-02-15')
  })

  it('leaves the editor blank/default for a column with no existing filter', () => {
    const filters: ColumnFilter[] = [{ columnId: 'status', kind: 'options', optionIds: ['applied'] }]
    render(<FilterBar columns={columns} filters={filters} onChange={vi.fn()} />)

    openEditorFor('Company')

    expect(screen.getByLabelText(/company contains/i)).toHaveValue('')
  })
})
