// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorShell } from './EditorShell'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

vi.mock('./EditTab', () => ({ EditTab: () => <div>EditTabContent</div> }))
vi.mock('./PreviewTab', () => ({ PreviewTab: () => <div>PreviewTabContent</div> }))
vi.mock('./DesignPanel', () => ({ DesignPanel: () => <div>DesignPanelContent</div> }))
vi.mock('@/components/ats/AtsScorePanel', () => ({ AtsScorePanel: () => <div>AtsScorePanelContent</div> }))
vi.mock('./ExportMenu', () => ({ ExportMenu: () => <button>Export</button> }))
vi.mock('@/components/ui/UserProfileButton', () => ({ UserProfileButton: () => <div>Profile</div> }))

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

  it('still switches between Edit/Design/ATS tabs', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    fireEvent.click(screen.getByRole('button', { name: 'Design' }))
    expect(screen.getByText('DesignPanelContent')).toBeInTheDocument()
  })

  it('still supports the preview expand/collapse toggle', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    fireEvent.click(screen.getByTitle('Expand preview'))
    // Edit panel collapses to the vertical tab strip; preview stays visible.
    expect(screen.getByText('PreviewTabContent')).toBeInTheDocument()
    expect(screen.queryByText('EditTabContent')).not.toBeInTheDocument()
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
    expect(screen.getByRole('tablist', { name: /view/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeInTheDocument()
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

  it('switching back to Edit restores the edit panel', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Edit' }))
    expect(screen.getByText('EditTabContent')).toBeInTheDocument()
    expect(screen.queryByText('PreviewTabContent')).not.toBeInTheDocument()
  })

  it('the existing Edit/Design/ATS tab bar still works inside the edit view', () => {
    render(<EditorShell resumeId="r1" title="CV" data={{}} meta={defaultMeta} />)
    fireEvent.click(screen.getByRole('button', { name: 'Design' }))
    expect(screen.getByText('DesignPanelContent')).toBeInTheDocument()
  })
})
