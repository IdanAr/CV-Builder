// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { DesignPanel } from './DesignPanel'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0,
  lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column',
  columnAssignment: {},
  excludedAtsKeywords: [],
}

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1',
    title: 'CV',
    data: {},
    meta: defaultMeta,
    isDirty: false,
    isSaving: false,
    saveError: null,
  })
})

describe('DesignPanel', () => {
  it('renders template options', () => {
    render(<DesignPanel />)
    expect(screen.getByText('Classic')).toBeTruthy()
    expect(screen.getByText('Modern')).toBeTruthy()
    expect(screen.getByText('Minimal')).toBeTruthy()
  })

  it('clicking a template calls setMeta with the new templateId', () => {
    render(<DesignPanel />)
    fireEvent.click(screen.getByText('Modern'))
    expect(useResumeEditorStore.getState().meta.templateId).toBe('modern')
  })

  it('clicking layout toggle updates layout', () => {
    render(<DesignPanel />)
    fireEvent.click(screen.getByText('Two columns'))
    expect(useResumeEditorStore.getState().meta.layout).toBe('two-column')
  })

  it('the Two columns option is not offered for the Minimal template', () => {
    useResumeEditorStore.setState({
      resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
      data: {},
      meta: { ...defaultMeta, templateId: 'minimal' },
    })
    render(<DesignPanel />)
    expect(screen.queryByText('Two columns')).toBeNull()
    expect(screen.getByText('Single column')).toBeTruthy()
  })

  it('section columns block is hidden in single-column mode', () => {
    render(<DesignPanel />)
    expect(screen.queryByText('Section columns')).toBeNull()
  })

  it('section columns block is visible in two-column mode', () => {
    useResumeEditorStore.setState({
      resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
      data: {},
      meta: { ...defaultMeta, layout: 'two-column' },
    })
    render(<DesignPanel />)
    expect(screen.getByText('Section columns')).toBeTruthy()
  })

  it('section columns block shows LEFT and RIGHT badges', () => {
    useResumeEditorStore.setState({
      resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
      data: {},
      meta: { ...defaultMeta, layout: 'two-column', sectionOrder: ['work', 'skills'] },
    })
    render(<DesignPanel />)
    const leftBtns = screen.getAllByText('Left')
    const rightBtns = screen.getAllByText('Right')
    expect(leftBtns.length).toBeGreaterThan(0)
    expect(rightBtns.length).toBeGreaterThan(0)
  })

  it('clicking RIGHT badge updates columnAssignment', () => {
    useResumeEditorStore.setState({
      resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
      data: {},
      meta: { ...defaultMeta, layout: 'two-column', sectionOrder: ['work', 'skills'] },
    })
    render(<DesignPanel />)
    // 'work' defaults to left — click Right to move it
    const rightBtns = screen.getAllByText('Right')
    fireEvent.click(rightBtns[0])
    expect(useResumeEditorStore.getState().meta.columnAssignment?.work).toBe('right')
  })

  describe('color input validation', () => {
    const errorText = 'Enter a valid hex color (e.g. #0066cc)'

    it('typing a valid hex into the primary color text input calls setMeta', () => {
      render(<DesignPanel />)
      const input = screen.getByPlaceholderText('#000000') as HTMLInputElement
      fireEvent.change(input, { target: { value: '#123abc' } })
      expect(useResumeEditorStore.getState().meta.primaryColor).toBe('#123abc')
      expect(screen.queryByText(errorText)).toBeNull()
    })

    it('typing an invalid hex into the primary color text input shows an error and does not call setMeta', () => {
      render(<DesignPanel />)
      const input = screen.getByPlaceholderText('#000000') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'purple' } })
      expect(screen.getByText(errorText)).toBeTruthy()
      expect(useResumeEditorStore.getState().meta.primaryColor).toBe('#000000')
    })

    it('does not show an error before the primary color text input has been interacted with', () => {
      render(<DesignPanel />)
      expect(screen.queryByText(errorText)).toBeNull()
    })

    it('blurring the primary color text input while invalid reverts the displayed value and clears the error', () => {
      render(<DesignPanel />)
      const input = screen.getByPlaceholderText('#000000') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'purple' } })
      fireEvent.blur(input)
      expect(input.value).toBe('#000000')
      expect(screen.queryByText(errorText)).toBeNull()
    })

    it('using the primary color swatch still updates meta immediately and syncs the text draft', () => {
      const { container } = render(<DesignPanel />)
      const swatch = container.querySelectorAll('input[type="color"]')[0] as HTMLInputElement
      fireEvent.change(swatch, { target: { value: '#abcdef' } })
      expect(useResumeEditorStore.getState().meta.primaryColor).toBe('#abcdef')
      const textInput = screen.getByPlaceholderText('#000000') as HTMLInputElement
      expect(textInput.value).toBe('#abcdef')
    })

    it('typing a valid hex into the accent color text input calls setMeta', () => {
      render(<DesignPanel />)
      const input = screen.getByPlaceholderText('#0066cc') as HTMLInputElement
      fireEvent.change(input, { target: { value: '#654321' } })
      expect(useResumeEditorStore.getState().meta.accentColor).toBe('#654321')
    })

    it('typing an invalid hex into the accent color text input shows an error and does not call setMeta', () => {
      render(<DesignPanel />)
      const input = screen.getByPlaceholderText('#0066cc') as HTMLInputElement
      fireEvent.change(input, { target: { value: '#12' } })
      expect(screen.getByText(errorText)).toBeTruthy()
      expect(useResumeEditorStore.getState().meta.accentColor).toBe('#0066cc')
    })

    it('blurring the accent color text input while invalid reverts the displayed value', () => {
      render(<DesignPanel />)
      const input = screen.getByPlaceholderText('#0066cc') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'nope' } })
      fireEvent.blur(input)
      expect(input.value).toBe('#0066cc')
      expect(screen.queryByText(errorText)).toBeNull()
    })

    it('using the accent color swatch still updates meta immediately', () => {
      const { container } = render(<DesignPanel />)
      const swatch = container.querySelectorAll('input[type="color"]')[1] as HTMLInputElement
      fireEvent.change(swatch, { target: { value: '#fedcba' } })
      expect(useResumeEditorStore.getState().meta.accentColor).toBe('#fedcba')
    })

    it('syncs the primary color text draft when meta.primaryColor changes externally (e.g. undo/redo)', () => {
      render(<DesignPanel />)
      const input = screen.getByPlaceholderText('#000000') as HTMLInputElement
      expect(input.value).toBe('#000000')

      // Simulate an external change to meta (undo/redo, not this component's own inputs).
      act(() => {
        useResumeEditorStore.setState((s) => ({ meta: { ...s.meta, primaryColor: '#ff0000' } }))
      })

      expect(input.value).toBe('#ff0000')
      expect(screen.queryByText(errorText)).toBeNull()
    })

    it('syncs the accent color text draft when meta.accentColor changes externally (e.g. undo/redo)', () => {
      render(<DesignPanel />)
      const input = screen.getByPlaceholderText('#0066cc') as HTMLInputElement
      expect(input.value).toBe('#0066cc')

      act(() => {
        useResumeEditorStore.setState((s) => ({ meta: { ...s.meta, accentColor: '#00ff00' } }))
      })

      expect(input.value).toBe('#00ff00')
      expect(screen.queryByText(errorText)).toBeNull()
    })
  })

  describe('color preset palette', () => {
    it('renders a labeled preset swatch group for primary and accent colors', () => {
      render(<DesignPanel />)
      expect(screen.getByRole('group', { name: /primary color presets/i })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: /accent color presets/i })).toBeInTheDocument()
    })

    it('renders more than one clickable preset swatch per palette', () => {
      render(<DesignPanel />)
      const primaryGroup = screen.getByRole('group', { name: /primary color presets/i })
      const accentGroup = screen.getByRole('group', { name: /accent color presets/i })
      expect(primaryGroup.querySelectorAll('button').length).toBeGreaterThan(1)
      expect(accentGroup.querySelectorAll('button').length).toBeGreaterThan(1)
    })

    it('clicking a primary color preset updates meta and the text draft', () => {
      render(<DesignPanel />)
      const primaryGroup = screen.getByRole('group', { name: /primary color presets/i })
      const navyBtn = primaryGroup.querySelector('button[title="Navy"]') as HTMLButtonElement
      fireEvent.click(navyBtn)
      expect(useResumeEditorStore.getState().meta.primaryColor).toBe('#1e3a8a')
      const textInput = screen.getByPlaceholderText('#000000') as HTMLInputElement
      expect(textInput.value).toBe('#1e3a8a')
    })

    it('clicking an accent color preset updates meta and the text draft', () => {
      render(<DesignPanel />)
      const accentGroup = screen.getByRole('group', { name: /accent color presets/i })
      const tealBtn = accentGroup.querySelector('button[title="Teal"]') as HTMLButtonElement
      fireEvent.click(tealBtn)
      expect(useResumeEditorStore.getState().meta.accentColor).toBe('#0f766e')
      const textInput = screen.getByPlaceholderText('#0066cc') as HTMLInputElement
      expect(textInput.value).toBe('#0f766e')
    })

    it('marks the preset matching the current primary color as pressed', () => {
      render(<DesignPanel />)
      const primaryGroup = screen.getByRole('group', { name: /primary color presets/i })
      const blackBtn = primaryGroup.querySelector('button[title="Black"]') as HTMLButtonElement
      expect(blackBtn).toHaveAttribute('aria-pressed', 'true')
      const navyBtn = primaryGroup.querySelector('button[title="Navy"]') as HTMLButtonElement
      expect(navyBtn).toHaveAttribute('aria-pressed', 'false')
    })

    it('marks the preset matching the current accent color as pressed', () => {
      render(<DesignPanel />)
      const accentGroup = screen.getByRole('group', { name: /accent color presets/i })
      const classicBlueBtn = accentGroup.querySelector('button[title="Classic Blue"]') as HTMLButtonElement
      expect(classicBlueBtn).toHaveAttribute('aria-pressed', 'true')
    })

    it('the custom color picker input still has an accessible label', () => {
      render(<DesignPanel />)
      expect(screen.getByLabelText(/custom primary color/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/custom accent color/i)).toBeInTheDocument()
    })
  })

  describe('sidebar layout', () => {
    it('hides the Single/Two-column toggle for the sidebar template', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, templateId: 'sidebar' },
      })
      render(<DesignPanel />)
      expect(screen.queryByText('Single column')).toBeNull()
      expect(screen.queryByText('Two columns')).toBeNull()
    })

    it('shows the Section columns editor for the sidebar template regardless of layout', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, templateId: 'sidebar', layout: 'single-column', sectionOrder: ['work', 'skills', 'languages'] },
      })
      render(<DesignPanel />)
      expect(screen.getByText('Section columns')).toBeTruthy()
    })

    it('shows skills on the rail (left) side by sidebar defaults', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, templateId: 'sidebar', sectionOrder: ['skills'], columnAssignment: {} },
      })
      render(<DesignPanel />)
      // SortableColumnRow always renders both "Left" and "Right" buttons, styling
      // whichever is the current side with the active (bg-white) class. Skills has
      // no LEFT_DEFAULTS entry, so this only passes when the sidebar's own column
      // defaults (SIDEBAR_COLUMN_DEFAULTS) are threaded through getColumnSide.
      const leftBtn = screen.getByRole('button', { name: 'Left' })
      const rightBtn = screen.getByRole('button', { name: 'Right' })
      expect(leftBtn.className).toContain('bg-white')
      expect(rightBtn.className).not.toContain('bg-white')
    })
  })
})
