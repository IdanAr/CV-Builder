// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectCell, TextCell, UrlCell } from './cells'

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

// SelectCell restored focus already; the two text-editing cells did not. They
// swap the trigger button for an input while editing, so committing unmounted
// the input and focus fell to <body> — in a grid, every single cell edit sent
// a keyboard user back to the top of the document.
describe('inline text cells return focus to their trigger', () => {
  it('TextCell restores focus after committing with Enter', () => {
    const onCommit = vi.fn()
    render(<TextCell value="Acme" onCommit={onCommit} ariaLabel="Company" />)

    const trigger = screen.getByRole('button', { name: 'Edit Company' })
    // jsdom's fireEvent.click does not move focus the way a real click does.
    trigger.focus()
    fireEvent.click(trigger)

    const input = screen.getByRole('textbox', { name: 'Company' })
    fireEvent.change(input, { target: { value: 'Globex' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onCommit).toHaveBeenCalledWith('Globex')
    expect(screen.getByRole('button', { name: 'Edit Company' })).toHaveFocus()
  })

  it('TextCell restores focus when the edit is cancelled with Escape', () => {
    const onCommit = vi.fn()
    render(<TextCell value="Acme" onCommit={onCommit} ariaLabel="Company" />)

    const trigger = screen.getByRole('button', { name: 'Edit Company' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Company' }), { key: 'Escape' })

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Edit Company' })).toHaveFocus()
  })

  it('UrlCell restores focus after committing', () => {
    const onCommit = vi.fn()
    render(<UrlCell value="https://acme.com" onCommit={onCommit} ariaLabel="Link" />)

    const trigger = screen.getByRole('button', { name: 'Edit Link' })
    trigger.focus()
    fireEvent.click(trigger)

    const input = screen.getByRole('textbox', { name: 'Link' })
    fireEvent.change(input, { target: { value: 'https://globex.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onCommit).toHaveBeenCalledWith('https://globex.com')
    expect(screen.getByRole('button', { name: 'Edit Link' })).toHaveFocus()
  })

  // Focus should only be forced back when the user was actually editing —
  // otherwise a cell would steal focus on its first render.
  it('does not grab focus on first render', () => {
    render(<TextCell value="Acme" onCommit={vi.fn()} ariaLabel="Company" />)
    expect(screen.getByRole('button', { name: 'Edit Company' })).not.toHaveFocus()
  })
})
