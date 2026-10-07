// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { SpacingControls } from './SpacingControls'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0, sidebarRailWidth: 33,
  lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column',
  columnAssignment: {},
  excludedAtsKeywords: [], fontScale: 1,
}

const meta = () => useResumeEditorStore.getState().meta

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1', title: 'CV', data: {}, meta: defaultMeta,
    isDirty: false, isSaving: false, saveError: null,
  })
})

describe('SpacingControls', () => {
  it('checks the default presets', () => {
    render(<SpacingControls />)
    expect(screen.getByRole('radio', { name: 'Default' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Normal' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true')
  })

  it('clicking presets writes the preset values', () => {
    render(<SpacingControls />)
    fireEvent.click(screen.getByRole('radio', { name: 'Larger' }))
    expect(meta().fontScale).toBe(1.05)
    fireEvent.click(screen.getByRole('radio', { name: 'Relaxed' }))
    expect(meta().lineSpacing).toBe(1.3)
    fireEvent.click(screen.getByRole('radio', { name: 'Narrow' }))
    expect(meta().pageMargins).toBe(0.6)
  })

  it('shows Custom when no preset matches', () => {
    useResumeEditorStore.setState({ meta: { ...defaultMeta, lineSpacing: 1.2 } })
    render(<SpacingControls />)
    const group = screen.getByRole('radiogroup', { name: 'Line spacing' })
    for (const r of group.querySelectorAll('[role="radio"]')) expect(r).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/Custom \(1\.20\)/)).toBeTruthy()
  })

  it('Advanced slider still edits the value', () => {
    const { container } = render(<SpacingControls />)
    const details = container.querySelectorAll('details')
    expect(details).toHaveLength(3)
    const slider = screen.getByLabelText('Line spacing', { selector: 'input' }) as HTMLInputElement
    expect(slider.min).toBe('1')
    expect(slider.max).toBe('1.3')
    fireEvent.change(slider, { target: { value: '1.25' } })
    expect(meta().lineSpacing).toBe(1.25)
  })

  it('one undo reverts one preset click', () => {
    render(<SpacingControls />)
    fireEvent.click(screen.getByRole('radio', { name: 'Wide' }))
    expect(meta().pageMargins).toBe(1.3)
    act(() => useResumeEditorStore.getState().undo())
    expect(meta().pageMargins).toBe(1.0)
  })
})
