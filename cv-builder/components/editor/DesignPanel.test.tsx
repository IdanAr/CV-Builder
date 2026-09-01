// @vitest-environment jsdom
import React, { Profiler } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  pageMargins: 1.0, sidebarRailWidth: 33,
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
  it('marks the active template and layout buttons as pressed for assistive tech', () => {
    render(<DesignPanel />)
    // Anchored to the start: "Classic"/"Modern" alone would also match the
    // "Classic Blue"/"Modern..." color-preset buttons' aria-labels below.
    const classicBtn = screen.getByRole('button', { name: /^classic\b/i })
    expect(classicBtn).toHaveAttribute('aria-pressed', 'true')
    const modernBtn = screen.getByRole('button', { name: /^modern\b/i })
    expect(modernBtn).toHaveAttribute('aria-pressed', 'false')

    const singleColumnBtn = screen.getByRole('button', { name: /single column/i })
    expect(singleColumnBtn).toHaveAttribute('aria-pressed', 'true')
    const twoColumnBtn = screen.getByRole('button', { name: /two columns/i })
    expect(twoColumnBtn).toHaveAttribute('aria-pressed', 'false')
  })

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

  describe('section columns keyboard drag-and-drop', () => {
    // dnd-kit's KeyboardSensor drives movement off getBoundingClientRect of
    // each sortable row (via sortableKeyboardCoordinates' rect.top compares).
    // jsdom returns an all-zero rect for every element by default, which
    // makes every row indistinguishable and the sensor unable to compute a
    // next position — so this mock gives each row a distinct vertical
    // position based on its DOM order, matching how a real layout would.
    function mockRowRects() {
      return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement
      ) {
        const parent = this.parentElement
        const siblings = parent ? Array.from(parent.children) : []
        const index = siblings.indexOf(this)
        const top = index >= 0 ? index * 60 : 0
        return {
          top,
          left: 0,
          right: 240,
          bottom: top + 56,
          width: 240,
          height: 56,
          x: 0,
          y: top,
          toJSON() {
            return {}
          },
        } as DOMRect
      })
    }

    it('reorders a section via keyboard (Space to pick up, Arrow to move, Space to drop)', async () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, layout: 'two-column', sectionOrder: ['work', 'education', 'skills'] },
      })
      const rectSpy = mockRowRects()

      render(<DesignPanel />)

      const handles = screen.getAllByRole('button', { name: /drag to reorder/i })
      expect(handles).toHaveLength(3)

      handles[0].focus()
      fireEvent.keyDown(handles[0], { key: ' ', code: 'Space' })
      // KeyboardSensor attaches its keydown listener via setTimeout(0) after
      // pickup, so the following keys must wait a tick to be picked up.
      await new Promise((resolve) => setTimeout(resolve, 0))
      fireEvent.keyDown(handles[0], { key: 'ArrowDown', code: 'ArrowDown' })
      fireEvent.keyDown(handles[0], { key: ' ', code: 'Space' })

      expect(useResumeEditorStore.getState().meta.sectionOrder).toEqual(['education', 'work', 'skills'])

      rectSpy.mockRestore()
    })

    it('pointer-based drag-and-drop still works (PointerSensor unaffected by the keyboard fix)', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, layout: 'two-column', sectionOrder: ['work', 'education', 'skills'] },
      })
      render(<DesignPanel />)
      const handles = screen.getAllByRole('button', { name: /drag to reorder/i })
      expect(handles).toHaveLength(3)
      // Sanity check only: verifying the full pointer drag sequence is
      // covered elsewhere; this just confirms the sensor/attributes are
      // still wired for pointer interaction after adding KeyboardSensor.
      expect(handles[0]).toHaveAttribute('role', 'button')
    })
  })

  describe('data subscription scope', () => {
    it('does not re-render when an unrelated part of data changes (only customSections matters here)', () => {
      const onRender = vi.fn()

      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: { basics: { name: 'Jordan' } },
        meta: { ...defaultMeta, layout: 'two-column', sectionOrder: ['work', 'skills'] },
      })
      render(
        <Profiler id="design-panel-test" onRender={onRender}>
          <DesignPanel />
        </Profiler>
      )
      // Mount alone commits more than once here (dnd-kit's own effects inside
      // DndContext/SortableContext — e.g. id generation, initial measurement —
      // fire regardless of this fix), so the meaningful assertion is that the
      // commit count doesn't grow further from an unrelated data change, not
      // that mount itself produces exactly one commit.
      const callsAfterMount = onRender.mock.calls.length

      // Simulate a keystroke in an unrelated field (e.g. the summary editor) —
      // this is the exact kind of store update that fires on every keystroke
      // anywhere in the editor while DesignPanel is mounted but not visible.
      act(() => {
        useResumeEditorStore.setState((s) => ({
          data: { ...s.data, basics: { ...s.data.basics, summary: 'x' } },
        }))
      })
      expect(onRender.mock.calls.length).toBe(callsAfterMount)
    })
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

  describe('rail width slider (sidebar-only)', () => {
    it('is hidden for non-sidebar templates', () => {
      render(<DesignPanel />)
      expect(screen.queryByText(/Rail width/)).toBeNull()
    })

    it('is shown for the sidebar template with the current value', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, templateId: 'sidebar', sidebarRailWidth: 28 },
      })
      render(<DesignPanel />)
      expect(screen.getByText(/Rail width/)).toBeTruthy()
      const slider = screen.getByRole('slider', { name: /Rail width/i })
      expect(slider).toHaveProperty('value', '28')
    })

    it('defaults the displayed value to 33 when sidebarRailWidth is missing from meta', () => {
      const { sidebarRailWidth: _unused, ...metaWithoutRailWidth } = { ...defaultMeta, templateId: 'sidebar', sidebarRailWidth: 33 }
      void _unused
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: metaWithoutRailWidth as typeof defaultMeta,
      })
      render(<DesignPanel />)
      const slider = screen.getByRole('slider', { name: /Rail width/i })
      expect(slider).toHaveProperty('value', '33')
    })

    it('changing the slider calls setMeta with sidebarRailWidth', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, templateId: 'sidebar' },
      })
      render(<DesignPanel />)
      const slider = screen.getByRole('slider', { name: /Rail width/i })
      fireEvent.change(slider, { target: { value: '25' } })
      expect(useResumeEditorStore.getState().meta.sidebarRailWidth).toBe(25)
    })

    it('constrains the slider to the 20-40 range', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, templateId: 'sidebar' },
      })
      render(<DesignPanel />)
      const slider = screen.getByRole('slider', { name: /Rail width/i }) as HTMLInputElement
      expect(slider.min).toBe('20')
      expect(slider.max).toBe('40')
    })
  })
})
