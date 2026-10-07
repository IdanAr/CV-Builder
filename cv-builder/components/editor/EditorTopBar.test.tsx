// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorTopBar } from './EditorTopBar'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'

function setup(over: Partial<React.ComponentProps<typeof EditorTopBar>> = {}) {
  const props = {
    onLeave: vi.fn((e: React.MouseEvent) => e.preventDefault()),
    onExport: vi.fn(),
    onJsonExport: vi.fn(),
    exporting: false,
    leaving: false,
    ...over,
  }
  render(<EditorTopBar {...props} />)
  return props
}

beforeEach(() => {
  useResumeEditorStore.setState({
    title: 'My CV',
    isDirty: false,
    isSaving: false,
    saveError: null,
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    setTitle: vi.fn(),
  })
})

describe('EditorTopBar', () => {
  it('renders the back link to the CV library and forwards clicks', () => {
    const p = setup()
    const link = screen.getByRole('link', { name: /my cvs/i })
    expect(link.getAttribute('href')).toBe('/dashboard/cvs')
    expect(link.getAttribute('aria-busy')).toBe('false')
    fireEvent.click(link)
    expect(p.onLeave).toHaveBeenCalled()
  })

  it('marks the link busy while leaving', () => {
    setup({ leaving: true })
    expect(screen.getByRole('link', { name: /my cvs/i }).getAttribute('aria-busy')).toBe('true')
  })

  it('binds the title input to the store', () => {
    setup()
    const input = screen.getByRole('textbox', { name: 'Resume title' }) as HTMLInputElement
    expect(input.value).toBe('My CV')
    fireEvent.change(input, { target: { value: 'New' } })
    expect(useResumeEditorStore.getState().setTitle).toHaveBeenCalledWith('New')
  })

  it('shows Saved, Saving and Unsaved states in a polite status region', () => {
    setup()
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toContain('Saved')
  })

  it('shows Saving…', () => {
    useResumeEditorStore.setState({ isSaving: true })
    setup()
    expect(screen.getByRole('status').textContent).toContain('Saving…')
  })

  it('shows Unsaved as an attention chip', () => {
    useResumeEditorStore.setState({ isDirty: true })
    setup()
    const chip = screen.getByText('Unsaved')
    expect(chip.className).toContain('text-fg-attention')
    expect(chip.className).toContain('bg-surface-attention')
  })

  it('shows the save error in the danger colour', () => {
    useResumeEditorStore.setState({ saveError: 'Save failed' })
    setup()
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Save failed')
    expect(status.className).toContain('text-fg-danger')
  })

  it('disables Undo/Redo per store flags and calls the actions', () => {
    useResumeEditorStore.setState({ canUndo: true, canRedo: false })
    setup()
    const undo = screen.getByRole('button', { name: 'Undo' })
    const redo = screen.getByRole('button', { name: 'Redo' })
    expect(undo).toBeEnabled()
    expect(redo).toBeDisabled()
    fireEvent.click(undo)
    expect(useResumeEditorStore.getState().undo).toHaveBeenCalled()
  })

  it('calls redo when enabled', () => {
    useResumeEditorStore.setState({ canRedo: true })
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(useResumeEditorStore.getState().redo).toHaveBeenCalled()
  })

  it('wires the export menu items and the JSON item', () => {
    const p = setup()
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Export options' }))
    for (const [label, f, m] of [
      ['PDF - Designed', 'pdf', 'designed'],
      ['PDF - ATS-optimized', 'pdf', 'ats'],
      ['DOCX - Designed', 'docx', 'designed'],
      ['DOCX - ATS-optimized', 'docx', 'ats'],
    ]) {
      open()
      fireEvent.click(screen.getByText(label))
      expect(p.onExport).toHaveBeenLastCalledWith(f, m)
    }
    open()
    fireEvent.click(screen.getByText('JSON - Raw data'))
    expect(p.onJsonExport).toHaveBeenCalledTimes(1)
  })

  it('shows the busy export trigger', () => {
    setup({ exporting: true })
    expect(screen.getByRole('button', { name: 'Exporting, please wait' })).toBeDisabled()
  })

  it('keeps the mobile class contract: flexible title, hidden link text, no wide fixed widths', () => {
    setup()
    const input = screen.getByRole('textbox', { name: 'Resume title' })
    expect(input.className).toContain('min-w-0')
    expect(input.className).toContain('flex-1')
    expect(screen.getByText('My CVs').className).toContain('sr-only')
    const header = screen.getByRole('banner')
    const widths = Array.from(header.querySelectorAll('*'))
      .flatMap((el) => (el.getAttribute('class') ?? '').split(/\s+/))
      .map((c) => /^(?:min-)?w-\[(\d+)px\]$/.exec(c)?.[1])
      .filter(Boolean)
      .map(Number)
    expect(widths.every((w) => w <= 120)).toBe(true)
  })
})
