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

  describe('in-flight state', () => {
    // A slow PDF render left the trigger enabled with no feedback, so users
    // clicked again and queued duplicate downloads and duplicate server work.
    it('disables the trigger and announces progress while busy', () => {
      render(<ExportMenu onExport={vi.fn()} busy />)

      const trigger = screen.getByRole('button', { name: /exporting, please wait/i })
      expect(trigger).toBeDisabled()
      expect(trigger).toHaveAttribute('aria-busy', 'true')
      expect(trigger).toHaveTextContent(/exporting/i)
    })

    it('cannot open the menu while busy', () => {
      render(<ExportMenu onExport={vi.fn()} busy />)

      fireEvent.click(screen.getByRole('button', { name: /exporting, please wait/i }))

      expect(screen.queryByRole('menu')).toBeNull()
    })

    it('keeps the menu closed if an export starts while it is open', () => {
      const { rerender } = render(<ExportMenu onExport={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /export options/i }))
      expect(screen.getByRole('menu')).toBeInTheDocument()

      rerender(<ExportMenu onExport={vi.fn()} busy />)

      expect(screen.queryByRole('menu')).toBeNull()
    })

    it('is enabled and openable when not busy', () => {
      render(<ExportMenu onExport={vi.fn()} />)

      const trigger = screen.getByRole('button', { name: /export options/i })
      expect(trigger).not.toBeDisabled()
      fireEvent.click(trigger)
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })
  })
})
