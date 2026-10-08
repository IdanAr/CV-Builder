// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react'
import { EditorShell } from './EditorShell'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

// EditorShell navigates programmatically when leaving with unsaved edits, so
// it needs an app-router context that jsdom doesn't provide.
const routerMock = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerMock.push,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

vi.mock('./EditTab', () => ({ EditTab: () => <div>EditTabContent</div> }))
vi.mock('./PreviewTab', () => ({
  PreviewTab: ({
    interactive,
    expandable,
    expanded,
    onToggleExpand,
  }: {
    interactive?: boolean
    expandable?: boolean
    expanded?: boolean
    onToggleExpand?: () => void
  }) => (
    <div data-testid="preview-tab-mock" data-interactive={String(interactive)} data-expandable={String(expandable)}>
      PreviewTabContent
      {expandable && (
        <button
          title={expanded ? 'Collapse preview' : 'Expand preview'}
          aria-label={expanded ? 'Collapse preview' : 'Expand preview'}
          onClick={onToggleExpand}
        />
      )}
    </div>
  ),
}))
// Real TemplateGrid, so the `active` wiring from the shell is observable as
// thumbnail presence.
vi.mock('./DesignPanel', async () => {
  const { TemplateGrid } = await import('./design/TemplateGrid')
  return {
    DesignPanel: ({ active = true }: { active?: boolean }) => (
      <div>DesignPanelContent<TemplateGrid active={active} /></div>
    ),
  }
})
vi.mock('@/components/ats/AtsScorePanel', () => ({ AtsScorePanel: () => <div>AtsScorePanelContent</div> }))
vi.mock('./ExportMenu', () => ({
  ExportMenu: ({
    onExport,
    onJsonExport,
  }: {
    onExport: (format: 'pdf' | 'docx', mode: 'designed' | 'ats') => void
    onJsonExport?: () => void
  }) => (
    <>
      <button onClick={() => onExport('pdf', 'designed')}>Export</button>
      <button onClick={onJsonExport}>JSON</button>
    </>
  ),
}))

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

/** Stubs window.matchMedia so useMediaQuery reports `matches` for every query. */
function setViewport(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
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
  setViewport(false) // default to desktop unless a test overrides it
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EditorShell — desktop layout (>= breakpoint)', () => {
  it('renders both the edit panel and the preview panel side-by-side', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    expect(screen.getByText('EditTabContent')).toBeInTheDocument()
    expect(screen.getByText('PreviewTabContent')).toBeInTheDocument()
  })

  it('renders the resize divider', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    expect(screen.getByTestId('panel-resize-divider')).toBeInTheDocument()
  })

  it('does not render the mobile edit/preview switcher', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    expect(screen.queryByRole('tablist', { name: /view/i })).not.toBeInTheDocument()
  })

  it('only renders template thumbnails once the Design tab is active', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    const panel = () => document.getElementById('editor-panel-design') as HTMLElement
    expect(within(panel()).queryAllByTestId('cv-thumbnail-page')).toHaveLength(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Design' }))
    expect(within(panel()).getAllByTestId('cv-thumbnail-page')).toHaveLength(5)
  })

  it('still switches between Edit/Design/ATS tabs', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Design' }))
    expect(screen.getByText('DesignPanelContent')).toBeInTheDocument()
  })

  it('shows the Undo/Redo controls on the Edit tab', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    expect(screen.getByRole('button', { name: /Undo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Redo/i })).toBeInTheDocument()
  })

  it('shows the Undo/Redo controls on the Design tab', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Design' }))
    expect(screen.getByRole('button', { name: /Undo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Redo/i })).toBeInTheDocument()
  })

  it('keeps the Undo/Redo controls in the top bar on the ATS tab', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    fireEvent.click(screen.getByRole('tab', { name: 'ATS' }))
    expect(screen.getByRole('button', { name: /Undo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Redo/i })).toBeInTheDocument()
  })

  it('still supports the preview expand/collapse toggle', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    fireEvent.click(screen.getByTitle('Expand preview'))
    // Edit panel collapses to the vertical tab strip; preview stays visible.
    expect(screen.getByText('PreviewTabContent')).toBeInTheDocument()
    expect(screen.queryByText('EditTabContent')).not.toBeInTheDocument()
  })

  it('tells PreviewTab to hide its edit overlay when Expanded Preview is on, and to show it otherwise', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    expect(screen.getByTestId('preview-tab-mock')).toHaveAttribute('data-interactive', 'true')
    fireEvent.click(screen.getByTitle('Expand preview'))
    expect(screen.getByTestId('preview-tab-mock')).toHaveAttribute('data-interactive', 'false')
    fireEvent.click(screen.getByTitle('Collapse preview'))
    expect(screen.getByTestId('preview-tab-mock')).toHaveAttribute('data-interactive', 'true')
  })

  it('title input still edits the store', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    const input = screen.getByDisplayValue('CV')
    fireEvent.change(input, { target: { value: 'New Title' } })
    expect(useResumeEditorStore.getState().title).toBe('New Title')
  })

  it('expand/collapse toggle exposes an aria-label that reflects current state', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    const btn = screen.getByRole('button', { name: 'Expand preview' })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(screen.getByRole('button', { name: 'Collapse preview' })).toBeInTheDocument()
  })

  it('resize divider exposes separator role and aria-value attributes', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    const divider = screen.getByTestId('panel-resize-divider')
    expect(divider).toHaveAttribute('role', 'separator')
    expect(divider).toHaveAttribute('aria-orientation', 'vertical')
    expect(divider).toHaveAttribute('tabIndex', '0')
    expect(divider.getAttribute('aria-valuenow')).not.toBeNull()
    expect(divider.getAttribute('aria-valuemin')).not.toBeNull()
    expect(divider.getAttribute('aria-valuemax')).not.toBeNull()
  })

  it('pressing arrow keys while the divider is focused resizes the panel within bounds', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    const divider = screen.getByTestId('panel-resize-divider')
    const initial = Number(divider.getAttribute('aria-valuenow'))

    fireEvent.keyDown(divider, { key: 'ArrowRight' })
    expect(Number(divider.getAttribute('aria-valuenow'))).toBe(initial + 16)

    fireEvent.keyDown(divider, { key: 'ArrowRight', shiftKey: true })
    expect(Number(divider.getAttribute('aria-valuenow'))).toBe(initial + 16 + 64)

    fireEvent.keyDown(divider, { key: 'ArrowLeft' })
    expect(Number(divider.getAttribute('aria-valuenow'))).toBe(initial + 64)

    const min = Number(divider.getAttribute('aria-valuemin'))
    const max = Number(divider.getAttribute('aria-valuemax'))
    expect(Number(divider.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(min)
    expect(Number(divider.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(max)
  })

  it('persists panel width to localStorage after a keyboard resize, like pointer-drag release does', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    const divider = screen.getByTestId('panel-resize-divider')
    const initial = Number(divider.getAttribute('aria-valuenow'))
    fireEvent.keyDown(divider, { key: 'ArrowRight' })
    expect(localStorage.getItem('cv-builder:panel-width')).toBe(String(initial + 16))
  })

  describe('panel width 320-480', () => {
    const originalInnerWidth = window.innerWidth
    function setViewport(w: number) {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w })
    }
    afterEach(() => setViewport(originalInnerWidth))

    function divider() {
      return screen.getByTestId('panel-resize-divider')
    }
    function renderShell() {
      render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    }

    it('defaults to 380px and exposes 320/480 bounds at a wide viewport', () => {
      setViewport(1280)
      renderShell()
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(380)
      expect(divider()).toHaveAttribute('aria-valuemin', '320')
      expect(divider()).toHaveAttribute('aria-valuemax', '480')
      expect(divider().previousElementSibling).toHaveStyle({ width: '380px' })
    })

    it('re-clamps the panel width when the window shrinks', () => {
      setViewport(1280)
      localStorage.setItem('cv-builder:panel-width', '480')
      renderShell()
      expect(divider().previousElementSibling).toHaveStyle({ width: '480px' })
      act(() => {
        setViewport(700)
        window.dispatchEvent(new Event('resize'))
      })
      const w = parseInt((divider().previousElementSibling as HTMLElement).style.width, 10)
      expect(w).toBeLessThanOrEqual(Math.floor(700 * 0.6))
    })

    function resizeWindow(w: number) {
      act(() => {
        setViewport(w)
        window.dispatchEvent(new Event('resize'))
      })
    }

    it('returns to the width the user chose after the window shrinks and grows back', () => {
      setViewport(1280)
      localStorage.setItem('cv-builder:panel-width', '480')
      renderShell()
      resizeWindow(700)
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(420)
      resizeWindow(1280)
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(480)
    })

    it('treats a width chosen at a narrow window as the preference after it grows', () => {
      setViewport(1280)
      renderShell()
      resizeWindow(700)
      // 380 + 3 * 16 = 428, clamped to 420 at this viewport.
      for (let i = 0; i < 3; i++) fireEvent.keyDown(divider(), { key: 'ArrowRight' })
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(420)
      resizeWindow(1280)
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(420)
    })

    it('clamps to 320 at a narrow viewport where the 60% cap is below the minimum', () => {
      setViewport(375)
      renderShell()
      expect(divider()).toHaveAttribute('aria-valuemin', '320')
      expect(divider()).toHaveAttribute('aria-valuemax', '320')
    })

    it('clamps an old stored 500 down to 480', () => {
      setViewport(1280)
      localStorage.setItem('cv-builder:panel-width', '500')
      renderShell()
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(480)
    })

    it('clamps a stored 100 up to 320', () => {
      setViewport(1280)
      localStorage.setItem('cv-builder:panel-width', '100')
      renderShell()
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(320)
    })

    it('ignores a garbage stored width', () => {
      setViewport(1280)
      localStorage.setItem('cv-builder:panel-width', 'abc')
      renderShell()
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(380)
    })

    it('steps 16 (Shift 64) with the arrow keys, stays within 320-480 and persists', () => {
      setViewport(1280)
      renderShell()
      fireEvent.keyDown(divider(), { key: 'ArrowRight' })
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(396)
      expect(localStorage.getItem('cv-builder:panel-width')).toBe('396')
      fireEvent.keyDown(divider(), { key: 'ArrowRight', shiftKey: true })
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(460)
      fireEvent.keyDown(divider(), { key: 'ArrowRight', shiftKey: true })
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(480)
      expect(localStorage.getItem('cv-builder:panel-width')).toBe('480')
      for (let i = 0; i < 4; i++) fireEvent.keyDown(divider(), { key: 'ArrowLeft', shiftKey: true })
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(320)
      expect(localStorage.getItem('cv-builder:panel-width')).toBe('320')
    })

    describe('pointer drag relative to the panel left edge', () => {
      function mockLeft(left: number) {
        return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left } as DOMRect)
      }
      function startDrag() {
        const d = divider()
        d.setPointerCapture = vi.fn()
        fireEvent.pointerDown(d, { pointerId: 1, clientX: 436 })
        return d
      }
      afterEach(() => vi.restoreAllMocks())

      it('subtracts the panel left offset (56): clientX 456 -> width 400', () => {
        setViewport(1280)
        mockLeft(56)
        renderShell()
        const d = startDrag()
        fireEvent.pointerMove(d, { pointerId: 1, clientX: 456 })
        expect(Number(d.getAttribute('aria-valuenow'))).toBe(400)
        expect(d.previousElementSibling).toHaveStyle({ width: '400px' })
        fireEvent.pointerUp(d, { pointerId: 1 })
        expect(localStorage.getItem('cv-builder:panel-width')).toBe('400')
      })

      it('with offset 0 clientX is the width', () => {
        setViewport(1280)
        mockLeft(0)
        renderShell()
        const d = startDrag()
        fireEvent.pointerMove(d, { pointerId: 1, clientX: 400 })
        expect(Number(d.getAttribute('aria-valuenow'))).toBe(400)
      })

      it('still clamps to bounds', () => {
        setViewport(1280)
        mockLeft(56)
        renderShell()
        const d = startDrag()
        fireEvent.pointerMove(d, { pointerId: 1, clientX: 56 + 900 })
        expect(Number(d.getAttribute('aria-valuenow'))).toBe(480)
        fireEvent.pointerMove(d, { pointerId: 1, clientX: 56 + 10 })
        expect(Number(d.getAttribute('aria-valuenow'))).toBe(320)
      })

      it('pointercancel restores the starting width', () => {
        setViewport(1280)
        mockLeft(56)
        renderShell()
        const d = startDrag()
        fireEvent.pointerMove(d, { pointerId: 1, clientX: 56 + 450 })
        expect(Number(d.getAttribute('aria-valuenow'))).toBe(450)
        fireEvent.pointerCancel(d, { pointerId: 1 })
        expect(Number(d.getAttribute('aria-valuenow'))).toBe(380)
      })

      it('pointercancel at a narrow window restores the chosen preference, not the clamped width', () => {
        setViewport(1280)
        localStorage.setItem('cv-builder:panel-width', '480')
        mockLeft(56)
        renderShell()
        resizeWindow(700)
        const d = startDrag()
        fireEvent.pointerMove(d, { pointerId: 1, clientX: 56 + 330 })
        fireEvent.pointerCancel(d, { pointerId: 1 })
        expect(Number(d.getAttribute('aria-valuenow'))).toBe(420)
        resizeWindow(1280)
        expect(Number(d.getAttribute('aria-valuenow'))).toBe(480)
      })

      it('a plain click at a narrow window does not overwrite the preference', () => {
        setViewport(1280)
        localStorage.setItem('cv-builder:panel-width', '480')
        mockLeft(56)
        renderShell()
        resizeWindow(700)
        const d = startDrag()
        fireEvent.pointerUp(d, { pointerId: 1 })
        expect(localStorage.getItem('cv-builder:panel-width')).toBe('480')
        resizeWindow(1280)
        expect(Number(d.getAttribute('aria-valuenow'))).toBe(480)
      })
    })

    it('mounting in a narrow window keeps the stored width as the preference for when it grows', () => {
      setViewport(700)
      localStorage.setItem('cv-builder:panel-width', '480')
      renderShell()
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(420)
      resizeWindow(1280)
      expect(Number(divider().getAttribute('aria-valuenow'))).toBe(480)
    })

    it('keeps its accessible name', () => {
      renderShell()
      expect(divider()).toHaveAttribute('aria-label', 'Resize editor panel')
    })
  })
})

describe('EditorShell — tab/tabpanel ARIA association', () => {
  it('associates each tab with its panel via aria-controls/id, and marks panels role=tabpanel', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    const editTab = screen.getByRole('tab', { name: 'Edit' })
    const designTab = screen.getByRole('tab', { name: 'Design' })

    const editPanelId = editTab.getAttribute('aria-controls')
    expect(editPanelId).toBeTruthy()
    const editPanel = document.getElementById(editPanelId!)
    expect(editPanel).toHaveAttribute('role', 'tabpanel')
    expect(editPanel).toHaveAttribute('aria-labelledby', editTab.id)

    const designPanelId = designTab.getAttribute('aria-controls')
    expect(designPanelId).toBeTruthy()
    expect(designPanelId).not.toBe(editPanelId)
  })
})

describe('EditorShell — mobile layout (below breakpoint)', () => {
  beforeEach(() => setViewport(true))

  it('shows only the edit panel by default, not the preview panel', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    expect(screen.getByText('EditTabContent')).toBeInTheDocument()
    expect(screen.queryByText('PreviewTabContent')).not.toBeInTheDocument()
  })

  it('renders an Edit/Preview switcher control', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    const switcher = screen.getByRole('tablist', { name: /view/i })
    expect(switcher).toBeInTheDocument()
    // Scoped to the switcher itself: the Edit/Design/ATS/Cover Letter tab bar
    // rendered inside the edit view (mobileView defaults to 'edit') now also
    // exposes an "Edit" tab (role="tab"), so an unscoped query would match both.
    expect(within(switcher).getByRole('tab', { name: 'Edit' })).toBeInTheDocument()
    expect(within(switcher).getByRole('tab', { name: 'Preview' })).toBeInTheDocument()
  })

  it('does not render the resize divider', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    expect(screen.queryByTestId('panel-resize-divider')).not.toBeInTheDocument()
  })

  it('switching to Preview via the switcher hides the edit panel and shows preview', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
    expect(screen.queryByText('EditTabContent')).not.toBeInTheDocument()
    expect(screen.getByText('PreviewTabContent')).toBeInTheDocument()
  })

  it('does not offer the expand toggle on mobile, and has no Live Preview strip', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
    expect(screen.getByTestId('preview-tab-mock')).toHaveAttribute('data-expandable', 'false')
    expect(screen.queryByText('Live Preview')).not.toBeInTheDocument()
  })

  it('switching back to Edit restores the edit panel', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Edit' }))
    expect(screen.getByText('EditTabContent')).toBeInTheDocument()
    expect(screen.queryByText('PreviewTabContent')).not.toBeInTheDocument()
  })

  it('the existing Edit/Design/ATS tab bar still works inside the edit view', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Design' }))
    expect(screen.getByText('DesignPanelContent')).toBeInTheDocument()
  })
})

describe('EditorShell export flushes pending changes first', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PATCHes the current (dirty) state before requesting the export, so the server has the latest edits', async () => {
    const calls: string[] = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        calls.push('patch')
        return { ok: true, json: async () => ({ resume: {} }) }
      }
      calls.push('export')
      return { ok: true, blob: async () => new Blob(['x'], { type: 'application/pdf' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })

    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    act(() => {
      useResumeEditorStore.setState({
        meta: { ...defaultMeta, sidebarRailWidth: 20 },
        isDirty: true,
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(calls).toEqual(['patch', 'export']))
    const patchCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'PATCH')
    const patchBody = JSON.parse((patchCall![1] as RequestInit).body as string)
    expect(patchBody.meta.sidebarRailWidth).toBe(20)
    expect(useResumeEditorStore.getState().isDirty).toBe(false)
  })

  it('flushes pending edits before leaving the editor, then navigates', async () => {
    // `beforeunload` never fires for client-side navigation, so clicking this
    // link inside the autosave debounce used to drop the pending edits.
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({}),
    }))
    vi.stubGlobal('fetch', fetchMock)
    routerMock.push.mockClear()

    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    act(() => {
      useResumeEditorStore.setState({ isDirty: true })
    })

    fireEvent.click(screen.getByRole('link', { name: /my cvs/i }))

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/dashboard/cvs'))
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH')).toBe(true)
  })

  it('navigates normally without intercepting when there is nothing unsaved', async () => {
    routerMock.push.mockClear()
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    act(() => {
      useResumeEditorStore.setState({ isDirty: false })
    })

    fireEvent.click(screen.getByRole('link', { name: /my cvs/i }))

    // The plain <Link> handles it; no programmatic push, no flush.
    expect(routerMock.push).not.toHaveBeenCalled()
  })

  it('skips the PATCH and exports directly when there is nothing unsaved', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      blob: async () => new Blob(['x']),
    }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })

    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    act(() => {
      useResumeEditorStore.setState({ isDirty: false })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST')
  })

  it('aborts the export and shows an error toast when the flush save fails', async () => {
    // The export call itself is mocked to SUCCEED (not throw) so that, under
    // the current bug (flushSave never rejects), the test reaches a distinct,
    // non-racy failure: a success toast instead of the expected error toast —
    // rather than both the buggy and fixed paths coincidentally producing an
    // error toast via two different catch blocks.
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return { ok: false, status: 401, json: async () => ({}) }
      }
      return { ok: true, blob: async () => new Blob(['x'], { type: 'application/pdf' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })

    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    act(() => {
      useResumeEditorStore.setState({ isDirty: true })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    const { useToastStore } = await import('@/lib/stores/toast.store')
    await waitFor(() =>
      expect(useToastStore.getState().toasts.some((t) => t.variant === 'error')).toBe(true)
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PATCH')
  })
})

describe('EditorShell pendingFocus', () => {
  it('switches the active tab to Edit when pendingFocus is set', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    // First move off the Edit tab so the assertion below can actually
    // discriminate wired-vs-unwired behavior: the Edit tab is the default
    // active tab on mount, so asserting aria-selected="true" without first
    // leaving it would pass even if the pendingFocus effect were deleted.
    fireEvent.click(screen.getByRole('tab', { name: 'Design' }))
    expect(screen.getByRole('tab', { name: 'Edit' }).getAttribute('aria-selected')).toBe('false')

    // Set pendingFocus AFTER mount — EditorShell's own hydrate() call on
    // mount resets pendingFocus to null (Task 3), so setting it beforehand
    // would be immediately overwritten.
    act(() => {
      useResumeEditorStore.getState().requestFocus('work')
    })

    expect(screen.getByRole('tab', { name: 'Edit' }).getAttribute('aria-selected')).toBe('true')
  })

  it('switches the mobile view back to Edit when pendingFocus is set', () => {
    setViewport(true)
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    // Move to the Preview side of the mobile switcher first, so the effect
    // has something real to reverse.
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
    expect(screen.queryByText('EditTabContent')).not.toBeInTheDocument()
    expect(screen.getByText('PreviewTabContent')).toBeInTheDocument()

    act(() => {
      useResumeEditorStore.getState().requestFocus('work')
    })

    expect(screen.getByText('EditTabContent')).toBeInTheDocument()
    expect(screen.queryByText('PreviewTabContent')).not.toBeInTheDocument()
  })
})

describe('EditorShell — preserved capabilities (characterization)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Undo / Redo', () => {
    it('starts disabled, enables after an edit, and Undo then Redo walk the history', () => {
      render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
      const undo = screen.getByRole('button', { name: /Undo/i })
      const redo = screen.getByRole('button', { name: /Redo/i })
      expect(undo).toHaveAttribute('aria-disabled', 'true')
      expect(redo).toHaveAttribute('aria-disabled', 'true')

      act(() => {
        useResumeEditorStore.getState().setMeta({ templateId: 'modern' })
      })
      expect(undo).toHaveAttribute('aria-disabled', 'false')
      expect(redo).toHaveAttribute('aria-disabled', 'true')

      fireEvent.click(undo)
      expect(useResumeEditorStore.getState().meta.templateId).toBe('classic')
      expect(undo).toHaveAttribute('aria-disabled', 'true')
      expect(redo).toHaveAttribute('aria-disabled', 'false')

      fireEvent.click(redo)
      expect(useResumeEditorStore.getState().meta.templateId).toBe('modern')
      expect(redo).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('tab keyboard navigation', () => {
    it('ArrowRight/ArrowLeft/End/Home move selection across Edit, Design, ATS and Cover Letter', () => {
      render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
      const tab = (name: string) => screen.getByRole('tab', { name })
      const selected = () =>
        screen
          .getAllByRole('tab')
          .filter((t) => t.getAttribute('aria-selected') === 'true')
          .map((t) => t.textContent)

      expect(selected()).toEqual(['Edit'])
      tab('Edit').focus()
      fireEvent.keyDown(tab('Edit'), { key: 'ArrowRight' })
      expect(selected()).toEqual(['Design'])
      fireEvent.keyDown(tab('Design'), { key: 'ArrowRight' })
      expect(selected()).toEqual(['ATS'])
      fireEvent.keyDown(tab('ATS'), { key: 'ArrowRight' })
      expect(selected()).toEqual(['Cover Letter'])
      fireEvent.keyDown(tab('Cover Letter'), { key: 'ArrowLeft' })
      expect(selected()).toEqual(['ATS'])
      fireEvent.keyDown(tab('ATS'), { key: 'Home' })
      expect(selected()).toEqual(['Edit'])
      fireEvent.keyDown(tab('Edit'), { key: 'End' })
      expect(selected()).toEqual(['Cover Letter'])
    })

    it('clicking the Cover Letter tab selects it', () => {
      render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
      fireEvent.click(screen.getByRole('tab', { name: 'Cover Letter' }))
      expect(screen.getByRole('tab', { name: 'Cover Letter' })).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('panel divider pointer resize and persistence', () => {
    function boundsOf(divider: HTMLElement) {
      return {
        min: Number(divider.getAttribute('aria-valuemin')),
        max: Number(divider.getAttribute('aria-valuemax')),
      }
    }

    it('dragging the divider resizes within bounds and persists the width on release', () => {
      render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
      const divider = screen.getByTestId('panel-resize-divider')
      divider.setPointerCapture = vi.fn()
      const { min, max } = boundsOf(divider)
      const target = Math.floor((min + max) / 2)

      fireEvent.pointerDown(divider, { pointerId: 1, clientX: min })
      fireEvent.pointerMove(divider, { pointerId: 1, clientX: target })
      expect(Number(divider.getAttribute('aria-valuenow'))).toBe(target)
      // Not persisted until release.
      fireEvent.pointerUp(divider, { pointerId: 1 })
      expect(localStorage.getItem('cv-builder:panel-width')).toBe(String(target))

      // Dragging far past either edge clamps to the bounds.
      fireEvent.pointerDown(divider, { pointerId: 1, clientX: target })
      fireEvent.pointerMove(divider, { pointerId: 1, clientX: 100000 })
      expect(Number(divider.getAttribute('aria-valuenow'))).toBe(max)
      fireEvent.pointerMove(divider, { pointerId: 1, clientX: -100000 })
      expect(Number(divider.getAttribute('aria-valuenow'))).toBe(min)
      fireEvent.pointerUp(divider, { pointerId: 1 })
    })

    it('cancelling a drag restores the width from before the drag', () => {
      render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
      const divider = screen.getByTestId('panel-resize-divider')
      divider.setPointerCapture = vi.fn()
      const { min, max } = boundsOf(divider)
      const before = Number(divider.getAttribute('aria-valuenow'))
      const moved = before === max ? min : max

      fireEvent.pointerDown(divider, { pointerId: 1, clientX: before })
      fireEvent.pointerMove(divider, { pointerId: 1, clientX: moved })
      expect(Number(divider.getAttribute('aria-valuenow'))).toBe(moved)
      fireEvent.pointerCancel(divider, { pointerId: 1 })
      expect(Number(divider.getAttribute('aria-valuenow'))).toBe(before)
    })

    it('restores a persisted panel width on mount', () => {
      const first = render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
      const { min, max } = boundsOf(screen.getByTestId('panel-resize-divider'))
      first.unmount()
      const saved = Math.floor((min + max) / 2) + 1
      localStorage.setItem('cv-builder:panel-width', String(saved))

      render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
      expect(Number(screen.getByTestId('panel-resize-divider').getAttribute('aria-valuenow'))).toBe(saved)
    })
  })

  describe('leaving via the back link when the save fails', () => {
    function stubFailingSave() {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
      )
    }

    it('asks for confirmation and stays put when the user declines', async () => {
      stubFailingSave()
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      routerMock.push.mockClear()
      render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
      act(() => {
        useResumeEditorStore.setState({ isDirty: true })
      })

      fireEvent.click(screen.getByRole('link', { name: /my cvs/i }))

      await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1))
      expect(routerMock.push).not.toHaveBeenCalled()
    })

    it('navigates anyway when the user accepts losing the unsaved changes', async () => {
      stubFailingSave()
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      routerMock.push.mockClear()
      render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
      act(() => {
        useResumeEditorStore.setState({ isDirty: true })
      })

      fireEvent.click(screen.getByRole('link', { name: /my cvs/i }))

      await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/dashboard/cvs'))
      expect(confirmSpy).toHaveBeenCalledTimes(1)
    })

    it('never asks for confirmation when the save succeeds', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
      const confirmSpy = vi.spyOn(window, 'confirm')
      routerMock.push.mockClear()
      render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
      act(() => {
        useResumeEditorStore.setState({ isDirty: true })
      })

      fireEvent.click(screen.getByRole('link', { name: /my cvs/i }))

      await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/dashboard/cvs'))
      expect(confirmSpy).not.toHaveBeenCalled()
    })
  })

  describe('JSON export', () => {
    it('downloads { data, meta } as <title>.json without hitting the network', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      let blob: Blob | undefined
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn((b: Blob) => {
          blob = b
          return 'blob:mock'
        }),
        revokeObjectURL: vi.fn(),
      })
      const clicked: string[] = []
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this.download)
      })

      render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
      act(() => {
        useResumeEditorStore.getState().setTitle('My Great CV')
      })
      fireEvent.click(screen.getByRole('button', { name: 'JSON' }))

      expect(clicked).toEqual(['My-Great-CV.json'])
      expect(fetchMock).not.toHaveBeenCalled()
      const parsed = JSON.parse(await blob!.text())
      expect(Object.keys(parsed).sort()).toEqual(['data', 'meta'])
      expect(parsed.meta.templateId).toBe('classic')
    })
  })
})
