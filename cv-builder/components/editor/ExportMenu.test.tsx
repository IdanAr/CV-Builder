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
})
