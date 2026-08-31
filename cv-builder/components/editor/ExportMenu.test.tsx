// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExportMenu } from './ExportMenu'

describe('ExportMenu', () => {
  it('opens on click and fires onExport with format and mode', () => {
    const onExport = vi.fn()
    render(<ExportMenu onExport={onExport} />)

    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    fireEvent.click(screen.getByText('PDF - ATS-optimized'))

    expect(onExport).toHaveBeenCalledWith('pdf', 'ats')
  })

  it('offers designed and ats variants for both formats', () => {
    render(<ExportMenu onExport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    expect(screen.getByText('PDF - Designed')).toBeTruthy()
    expect(screen.getByText('PDF - ATS-optimized')).toBeTruthy()
    expect(screen.getByText('DOCX - Designed')).toBeTruthy()
    expect(screen.getByText('DOCX - ATS-optimized')).toBeTruthy()
  })

  it('closes after selecting an item', () => {
    render(<ExportMenu onExport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    fireEvent.click(screen.getByText('DOCX - Designed'))
    expect(screen.queryByText('PDF - Designed')).toBeNull()
  })

  it('exposes menu semantics and expanded state', () => {
    render(<ExportMenu onExport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /export/i })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getAllByRole('menuitem')).toHaveLength(4)
  })

  it('closes on Escape', () => {
    render(<ExportMenu onExport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('moves focus to the first menu item when opened', () => {
    render(<ExportMenu onExport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus()
  })

  it('moves focus to the next item on ArrowDown, wrapping past the last item', () => {
    render(<ExportMenu onExport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    const items = screen.getAllByRole('menuitem')

    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(items[1]).toHaveFocus()

    fireEvent.keyDown(items[1], { key: 'ArrowDown' })
    fireEvent.keyDown(items[2], { key: 'ArrowDown' })
    fireEvent.keyDown(items[3], { key: 'ArrowDown' })
    expect(items[0]).toHaveFocus()
  })

  it('moves focus to the previous item on ArrowUp, wrapping before the first item', () => {
    render(<ExportMenu onExport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    const items = screen.getAllByRole('menuitem')

    fireEvent.keyDown(items[0], { key: 'ArrowUp' })
    expect(items[3]).toHaveFocus()
  })
})
