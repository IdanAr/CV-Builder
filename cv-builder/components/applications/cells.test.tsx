// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectCell } from './cells'

const options = [
  { id: 'opt-a', label: 'Option A', color: '#4f46e5' },
  { id: 'opt-b', label: 'Option B', color: '#059669' },
]

describe('SelectCell', () => {
  it('exposes the panel as a listbox with selectable options', () => {
    render(
      <SelectCell value="opt-a" onCommit={() => {}} ariaLabel="Status" options={options} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Change Status' }))

    const listbox = screen.getByRole('listbox')
    const opts = screen.getAllByRole('option')
    expect(listbox).toBeInTheDocument()
    expect(opts).toHaveLength(2)
    expect(opts[0]).toHaveAttribute('aria-selected', 'true')
    expect(opts[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('closes on Escape and returns focus to the trigger button', () => {
    render(
      <SelectCell value="opt-a" onCommit={() => {}} ariaLabel="Status" options={options} />
    )
    const trigger = screen.getByRole('button', { name: 'Change Status' })
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the trigger button after committing a selection', () => {
    const onCommit = vi.fn()
    render(
      <SelectCell value="opt-a" onCommit={onCommit} ariaLabel="Status" options={options} />
    )
    const trigger = screen.getByRole('button', { name: 'Change Status' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('option', { name: /Option B/ }))

    expect(onCommit).toHaveBeenCalledWith('opt-b')
    expect(trigger).toHaveFocus()
  })
})
