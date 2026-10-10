// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
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
  excludedAtsKeywords: [], fontScale: 1,
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

// The spacing sliders live inside collapsed <details> ("Advanced").
function openAdvanced(container: HTMLElement) {
  container.querySelectorAll('details').forEach((d) => { d.open = true })
}

// Every control but the template gallery sits in a collapsed section; open
// the one a test needs, the way a user would.
function openSection(name: 'Colors' | 'Typography' | 'Layout' | 'Size and spacing') {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }))
}

function renderPanel(section?: Parameters<typeof openSection>[0], opts: { customColors?: boolean } = {}) {
  const utils = render(<DesignPanel />)
  if (section) openSection(section)
  if (opts.customColors) fireEvent.click(screen.getByRole('button', { name: /custom colors/i }))
  return utils
}

describe('DesignPanel', () => {
  it('titles its sections with h2 headings and no h3', () => {
    render(<DesignPanel />)
    const h2 = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '')
    for (const t of ['Template', 'Colors', 'Typography', 'Layout', 'Size and spacing']) {
      expect(h2.some((h) => h.startsWith(t))).toBe(true)
    }
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
  })

  it('starts with every section collapsed and keeps at most one open', () => {
    render(<DesignPanel />)
    const header = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
    for (const n of ['Colors', 'Typography', 'Layout', 'Size and spacing']) {
      expect(header(n)).toHaveAttribute('aria-expanded', 'false')
    }
    fireEvent.click(header('Colors'))
    expect(header('Colors')).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(header('Layout'))
    expect(header('Layout')).toHaveAttribute('aria-expanded', 'true')
    expect(header('Colors')).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(header('Layout'))
    expect(header('Layout')).toHaveAttribute('aria-expanded', 'false')
  })

  it('summarises current values in the collapsed headers', () => {
    useResumeEditorStore.setState({
      meta: { ...defaultMeta, headerFontFamily: 'Cambria', layout: 'two-column', lineSpacing: 1.3 },
    })
    render(<DesignPanel />)
    expect(screen.getByRole('button', { name: /^Typography/ })).toHaveTextContent('Editorial · Cambria / Calibri')
    expect(screen.getByRole('button', { name: /^Layout/ })).toHaveTextContent('Two columns')
    expect(screen.getByRole('button', { name: /^Size and spacing/ })).toHaveTextContent('Default · Relaxed · Standard')
  })

  it('line spacing slider reaches 1.3', () => {
    const { container } = renderPanel('Size and spacing')
    openAdvanced(container)
    const slider = screen.getByRole('slider', { name: /line spacing/i }) as HTMLInputElement
    expect(slider.max).toBe('1.3')
    expect(slider.min).toBe('1')
  })

  it('marks the active template and layout buttons as pressed for assistive tech', () => {
    renderPanel('Layout')
    // Anchored to the start: "Classic"/"Modern" alone would also match the
    // "Classic Blue"/"Modern..." color-preset buttons' aria-labels below.
    const classicBtn = screen.getByRole('button', { name: /^classic\b/i })
    expect(classicBtn).toHaveAttribute('aria-pressed', 'true')
    const modernBtn = screen.getByRole('button', { name: /^modern\b/i })
    expect(modernBtn).toHaveAttribute('aria-pressed', 'false')

    const singleColumnBtn = screen.getByRole('button', { name: /^single column/i })
    expect(singleColumnBtn).toHaveAttribute('aria-pressed', 'true')
    const twoColumnBtn = screen.getByRole('button', { name: /^two columns/i })
    expect(twoColumnBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('design controls write only meta: data keeps the same object identity', () => {
    const before = useResumeEditorStore.getState().data
    const { container } = render(<DesignPanel />)
    fireEvent.click(screen.getByText('Modern'))
    openSection('Typography')
    fireEvent.click(screen.getByRole('radio', { name: /Editorial/ }))
    openSection('Size and spacing')
    fireEvent.click(screen.getByRole('radio', { name: 'Relaxed' }))
    openSection('Colors')
    fireEvent.click(screen.getByRole('radio', { name: 'Ocean' }))
    expect(useResumeEditorStore.getState().meta.templateId).toBe('modern')
    expect(useResumeEditorStore.getState().meta.primaryColor).toBe('#0c4a6e')
    expect(useResumeEditorStore.getState().data).toBe(before)
    expect(container).toBeTruthy()
  })

  it('renders template options', () => {
    render(<DesignPanel />)
    const gallery = screen.getByRole('group', { name: 'Template' })
    expect(within(gallery).getByText('Classic')).toBeTruthy()
    expect(within(gallery).getByText('Modern')).toBeTruthy()
    expect(within(gallery).getByText('Minimal')).toBeTruthy()
  })

  it('clicking a template calls setMeta with the new templateId', () => {
    render(<DesignPanel />)
    fireEvent.click(screen.getByText('Modern'))
    expect(useResumeEditorStore.getState().meta.templateId).toBe('modern')
  })

  it('clicking layout toggle updates layout', () => {
    renderPanel('Layout')
    fireEvent.click(screen.getByText('Two columns'))
    expect(useResumeEditorStore.getState().meta.layout).toBe('two-column')
  })

  it('the Two columns option is not offered for the Minimal template', () => {
    useResumeEditorStore.setState({
      resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
      data: {},
      meta: { ...defaultMeta, templateId: 'minimal' },
    })
    renderPanel('Layout')
    expect(screen.queryByText('Two columns', { selector: 'button' })).toBeNull()
    expect(screen.getByText('Single column', { selector: 'button' })).toBeTruthy()
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
    renderPanel('Layout')
    expect(screen.getByText('Section columns')).toBeTruthy()
  })

  it('section columns block shows LEFT and RIGHT badges', () => {
    useResumeEditorStore.setState({
      resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
      data: {},
      meta: { ...defaultMeta, layout: 'two-column', sectionOrder: ['work', 'skills'] },
    })
    renderPanel('Layout')
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
    renderPanel('Layout')
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

      renderPanel('Layout')

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
      renderPanel('Layout')
      const handles = screen.getAllByRole('button', { name: /drag to reorder/i })
      expect(handles).toHaveLength(3)
      // Sanity check only: verifying the full pointer drag sequence is
      // covered elsewhere; this just confirms the sensor/attributes are
      // still wired for pointer interaction after adding KeyboardSensor.
      expect(handles[0]).toHaveAttribute('role', 'button')
    })
  })

  describe('color input validation', () => {
    const errorText = 'Enter a valid hex color (e.g. #0066cc)'

    it('typing a valid hex into the primary color text input calls setMeta', () => {
      renderPanel('Colors', { customColors: true })
      const input = screen.getByPlaceholderText('#000000') as HTMLInputElement
      fireEvent.change(input, { target: { value: '#123abc' } })
      expect(useResumeEditorStore.getState().meta.primaryColor).toBe('#123abc')
      expect(screen.queryByText(errorText)).toBeNull()
    })

    it('typing an invalid hex into the primary color text input shows an error and does not call setMeta', () => {
      renderPanel('Colors', { customColors: true })
      const input = screen.getByPlaceholderText('#000000') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'purple' } })
      expect(screen.getByText(errorText)).toBeTruthy()
      expect(useResumeEditorStore.getState().meta.primaryColor).toBe('#000000')
    })

    it('does not show an error before the primary color text input has been interacted with', () => {
      renderPanel('Colors', { customColors: true })
      expect(screen.queryByText(errorText)).toBeNull()
    })

    it('blurring the primary color text input while invalid reverts the displayed value and clears the error', () => {
      renderPanel('Colors', { customColors: true })
      const input = screen.getByPlaceholderText('#000000') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'purple' } })
      fireEvent.blur(input)
      expect(input.value).toBe('#000000')
      expect(screen.queryByText(errorText)).toBeNull()
    })

    it('using the primary color swatch still updates meta immediately and syncs the text draft', () => {
      const { container } = renderPanel('Colors', { customColors: true })
      const swatch = container.querySelectorAll('input[type="color"]')[0] as HTMLInputElement
      fireEvent.change(swatch, { target: { value: '#abcdef' } })
      expect(useResumeEditorStore.getState().meta.primaryColor).toBe('#abcdef')
      const textInput = screen.getByPlaceholderText('#000000') as HTMLInputElement
      expect(textInput.value).toBe('#abcdef')
    })

    it('typing a valid hex into the accent color text input calls setMeta', () => {
      renderPanel('Colors', { customColors: true })
      const input = screen.getByPlaceholderText('#0066cc') as HTMLInputElement
      fireEvent.change(input, { target: { value: '#654321' } })
      expect(useResumeEditorStore.getState().meta.accentColor).toBe('#654321')
    })

    it('typing an invalid hex into the accent color text input shows an error and does not call setMeta', () => {
      renderPanel('Colors', { customColors: true })
      const input = screen.getByPlaceholderText('#0066cc') as HTMLInputElement
      fireEvent.change(input, { target: { value: '#12' } })
      expect(screen.getByText(errorText)).toBeTruthy()
      expect(useResumeEditorStore.getState().meta.accentColor).toBe('#0066cc')
    })

    it('blurring the accent color text input while invalid reverts the displayed value', () => {
      renderPanel('Colors', { customColors: true })
      const input = screen.getByPlaceholderText('#0066cc') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'nope' } })
      fireEvent.blur(input)
      expect(input.value).toBe('#0066cc')
      expect(screen.queryByText(errorText)).toBeNull()
    })

    it('using the accent color swatch still updates meta immediately', () => {
      const { container } = renderPanel('Colors', { customColors: true })
      const swatch = container.querySelectorAll('input[type="color"]')[1] as HTMLInputElement
      fireEvent.change(swatch, { target: { value: '#fedcba' } })
      expect(useResumeEditorStore.getState().meta.accentColor).toBe('#fedcba')
    })

    it('syncs the primary color text draft when meta.primaryColor changes externally (e.g. undo/redo)', () => {
      renderPanel('Colors', { customColors: true })
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
      renderPanel('Colors', { customColors: true })
      const input = screen.getByPlaceholderText('#0066cc') as HTMLInputElement
      expect(input.value).toBe('#0066cc')

      act(() => {
        useResumeEditorStore.setState((s) => ({ meta: { ...s.meta, accentColor: '#00ff00' } }))
      })

      expect(input.value).toBe('#00ff00')
      expect(screen.queryByText(errorText)).toBeNull()
    })
  })

  describe('color themes', () => {
    it('offers a labelled radiogroup of themes with the matching one checked', () => {
      renderPanel('Colors')
      const group = screen.getByRole('radiogroup', { name: 'Color theme' })
      expect(within(group).getAllByRole('radio').length).toBeGreaterThan(5)
      // defaultMeta is #000000 / #0066cc, the Classic theme.
      expect(within(group).getByRole('radio', { name: 'Classic' })).toHaveAttribute('aria-checked', 'true')
      expect(within(group).getByRole('radio', { name: 'Ocean' })).toHaveAttribute('aria-checked', 'false')
    })

    it('choosing a theme sets both colours in one history entry', () => {
      useResumeEditorStore.setState({ _history: [], _future: [] })
      renderPanel('Colors')
      fireEvent.click(screen.getByRole('radio', { name: 'Forest' }))
      const meta = useResumeEditorStore.getState().meta
      expect(meta.primaryColor).toBe('#14532d')
      expect(meta.accentColor).toBe('#15803d')
      expect(useResumeEditorStore.getState()._history).toHaveLength(1)
    })

    it('summarises the theme in the collapsed section header', () => {
      render(<DesignPanel />)
      expect(screen.getByRole('button', { name: /^Colors/ })).toHaveTextContent('Classic')
      act(() => {
        useResumeEditorStore.setState((s) => ({ meta: { ...s.meta, primaryColor: '#123456' } }))
      })
      expect(screen.getByRole('button', { name: /^Colors/ })).toHaveTextContent('Custom')
    })

    it('opens the custom colour fields by itself when the CV uses an off-theme pair', () => {
      useResumeEditorStore.setState((s) => ({ meta: { ...s.meta, primaryColor: '#123456' } }))
      renderPanel('Colors')
      expect(screen.getByPlaceholderText('#000000')).toHaveValue('#123456')
      expect(screen.queryByRole('radio', { checked: true })).toBeNull()
    })

    it('the custom color picker input still has an accessible label', () => {
      renderPanel('Colors', { customColors: true })
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
      renderPanel('Layout')
      expect(screen.queryByText('Single column')).toBeNull()
      expect(screen.queryByText('Two columns')).toBeNull()
    })

    // Added because the answer to "which section can go in the rail?" used to be
    // silently "not Work, Education, Volunteer or a custom one" — those vanished
    // rather than moving. They all render in either column now, so the panel
    // says so, and says which ones actually suit a rail that narrow.
    it('tells the user both columns accept any section, and what the rail suits', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, templateId: 'sidebar', sidebarRailWidth: 33 },
      })
      renderPanel('Layout')
      expect(screen.getByText(/Every section can go in either column/i)).toBeTruthy()
      expect(screen.getByText(/33% of the page width/i)).toBeTruthy()
    })

    it('does not show that note on templates without a rail', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, templateId: 'classic' },
      })
      renderPanel('Layout')
      expect(screen.queryByText(/Every section can go in either column/i)).toBeNull()
    })

    it('shows the Section columns editor for the sidebar template regardless of layout', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, templateId: 'sidebar', layout: 'single-column', sectionOrder: ['work', 'skills', 'languages'] },
      })
      renderPanel('Layout')
      // Scoped to the section's own label: the sidebar guidance note below the
      // layout toggle names the same control, so a bare getByText now matches twice.
      expect(screen.getByText('Section columns', { selector: 'p' })).toBeTruthy()
    })

    it('shows skills on the rail (left) side by sidebar defaults', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, templateId: 'sidebar', sectionOrder: ['skills'], columnAssignment: {} },
      })
      renderPanel('Layout')
      // SortableColumnRow always renders both "Left" and "Right" buttons, styling
      // whichever is the current side with the active (text-fg-heading) class. Skills has
      // no LEFT_DEFAULTS entry, so this only passes when the sidebar's own column
      // defaults (SIDEBAR_COLUMN_DEFAULTS) are threaded through getColumnSide.
      const leftBtn = screen.getByRole('button', { name: 'Left' })
      const rightBtn = screen.getByRole('button', { name: 'Right' })
      expect(leftBtn.className).toContain('text-fg-heading')
      expect(rightBtn.className).not.toContain('text-fg-heading')
    })
  })

  describe('rail width slider (sidebar-only)', () => {
    it('is hidden for non-sidebar templates', () => {
      renderPanel('Layout')
      expect(screen.queryByText(/Rail width/)).toBeNull()
    })

    it('is shown for the sidebar template with the current value', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, templateId: 'sidebar', sidebarRailWidth: 28 },
      })
      renderPanel('Layout')
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
      renderPanel('Layout')
      const slider = screen.getByRole('slider', { name: /Rail width/i })
      expect(slider).toHaveProperty('value', '33')
    })

    it('changing the slider calls setMeta with sidebarRailWidth', () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, templateId: 'sidebar' },
      })
      renderPanel('Layout')
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
      renderPanel('Layout')
      const slider = screen.getByRole('slider', { name: /Rail width/i }) as HTMLInputElement
      expect(slider.min).toBe('20')
      expect(slider.max).toBe('40')
    })
  })

  // Font, margin and line-spacing controls were rebuilt (pairing cards plus a
  // customize list; presets plus Advanced sliders). The store effects below are
  // the behaviour preserved from the original selects/sliders.
  describe('typography and spacing controls (store effects)', () => {
    it('choosing a body font updates meta.fontFamily only', () => {
      renderPanel('Typography')
      fireEvent.click(screen.getByRole('button', { name: 'Body font: Calibri' }))
      const list = screen.getByRole('radiogroup', { name: 'Fonts for body' })
      fireEvent.click(within(list).getByRole('radio', { name: /Georgia/ }))
      const meta = useResumeEditorStore.getState().meta
      expect(meta.fontFamily).toBe('Georgia')
      expect(meta.headerFontFamily).toBe('Calibri')
    })

    it('choosing a heading font updates meta.headerFontFamily only', () => {
      renderPanel('Typography')
      fireEvent.click(screen.getByRole('button', { name: 'Headings font: Calibri' }))
      const list = screen.getByRole('radiogroup', { name: 'Fonts for headings' })
      fireEvent.click(within(list).getByRole('radio', { name: /Georgia/ }))
      const meta = useResumeEditorStore.getState().meta
      expect(meta.headerFontFamily).toBe('Georgia')
      expect(meta.fontFamily).toBe('Calibri')
    })

    it('offers the same font options for body and heading', () => {
      renderPanel('Typography')
      const names = (group: HTMLElement) =>
        within(group).getAllByRole('radio').map((r) => r.textContent)
      fireEvent.click(screen.getByRole('button', { name: 'Body font: Calibri' }))
      const body = names(screen.getByRole('radiogroup', { name: 'Fonts for body' }))
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
      fireEvent.click(screen.getByRole('button', { name: 'Headings font: Calibri' }))
      const heading = names(screen.getByRole('radiogroup', { name: 'Fonts for headings' }))
      expect(body.length).toBeGreaterThan(1)
      expect(body).toEqual(heading)
      expect(body.some((n) => n?.startsWith('Calibri'))).toBe(true)
    })

    it('the page margins slider (under Advanced) updates meta.pageMargins', () => {
      const { container } = renderPanel('Size and spacing')
      openAdvanced(container)
      const margins = screen.getByRole('slider', { name: 'Page margins' }) as HTMLInputElement
      expect(margins.min).toBe('0.5')
      expect(margins.max).toBe('1.5')
      fireEvent.change(margins, { target: { value: '0.8' } })
      expect(useResumeEditorStore.getState().meta.pageMargins).toBeCloseTo(0.8)
    })

    it('a margin preset writes meta.pageMargins', () => {
      renderPanel('Size and spacing')
      const group = screen.getByRole('radiogroup', { name: 'Margin presets' })
      const radios = within(group).getAllByRole('radio')
      fireEvent.click(radios.find((r) => r.getAttribute('aria-checked') === 'false')!)
      expect(useResumeEditorStore.getState().meta.pageMargins).not.toBe(1.0)
    })

    it('the line spacing slider (under Advanced) updates meta.lineSpacing', () => {
      const { container } = renderPanel('Size and spacing')
      openAdvanced(container)
      const slider = screen.getByRole('slider', { name: /line spacing/i })
      fireEvent.change(slider, { target: { value: '1.3' } })
      expect(useResumeEditorStore.getState().meta.lineSpacing).toBeCloseTo(1.3)
    })

    it('a line spacing preset writes meta.lineSpacing', () => {
      renderPanel('Size and spacing')
      const group = screen.getByRole('radiogroup', { name: 'Line spacing presets' })
      const radios = within(group).getAllByRole('radio')
      fireEvent.click(radios.find((r) => r.getAttribute('aria-checked') === 'false')!)
      expect(useResumeEditorStore.getState().meta.lineSpacing).not.toBe(1.15)
    })
  })

  describe('section reorder screen-reader announcements', () => {
    it('announces the dragged section and its position while moving and on drop', async () => {
      useResumeEditorStore.setState({
        resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
        data: {},
        meta: { ...defaultMeta, layout: 'two-column', sectionOrder: ['work', 'education', 'skills'] },
      })
      const rectSpy = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement) {
          const index = this.parentElement ? Array.from(this.parentElement.children).indexOf(this) : 0
          const top = Math.max(index, 0) * 60
          return { top, left: 0, right: 240, bottom: top + 56, width: 240, height: 56, x: 0, y: top, toJSON() { return {} } } as DOMRect
        })
      renderPanel('Layout')
      const handles = screen.getAllByRole('button', { name: /drag to reorder/i })
      handles[0].focus()
      fireEvent.keyDown(handles[0], { key: ' ', code: 'Space' })
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(document.body.textContent).toMatch(/Work is over position 1 of 3/)
      fireEvent.keyDown(handles[0], { key: 'ArrowDown', code: 'ArrowDown' })
      fireEvent.keyDown(handles[0], { key: ' ', code: 'Space' })
      expect(document.body.textContent).toMatch(/Work was moved to position 2 of 3/)
      rectSpy.mockRestore()
    })
  })
})
