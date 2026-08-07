// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreviewTab } from './PreviewTab'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'

const ZOOM_KEY = 'cv-builder:preview-zoom'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Reads the scale factor off the inner scaled-content div's inline transform. */
function getScale(): number {
  const el = screen.getByTestId('preview-scaled-content')
  const match = /scale\(([\d.]+)\)/.exec(el.style.transform)
  return match ? parseFloat(match[1]) : NaN
}

describe('PreviewTab — zoom controls', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse({ pageCount: 1, anchors: [] }))
    )
    localStorage.clear()
    useResumeEditorStore.setState({
      data: {},
      meta: ResumeMetaSchema.parse({}),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the zoom control cluster: minus, percentage readout, and plus', () => {
    render(<PreviewTab />)
    expect(screen.getByTestId('zoom-out')).toBeInTheDocument()
    expect(screen.getByTestId('zoom-percentage')).toBeInTheDocument()
    expect(screen.getByTestId('zoom-in')).toBeInTheDocument()
  })

  it('defaults to Fit (auto-fit scale) for a first-time user who never touched the control', () => {
    render(<PreviewTab />)
    expect(screen.getByTestId('zoom-percentage')).toHaveTextContent('Fit')
    // Initial fitScale before any ResizeObserver callback fires.
    expect(getScale()).toBeCloseTo(0.75)
  })

  it('clicking + increases zoom by one step and updates the rendered transform', () => {
    render(<PreviewTab />)
    fireEvent.click(screen.getByTestId('zoom-in'))
    expect(screen.getByTestId('zoom-percentage')).toHaveTextContent('85%')
    expect(getScale()).toBeCloseTo(0.85)
  })

  it('clicking − decreases zoom by one step and updates the rendered transform', () => {
    render(<PreviewTab />)
    fireEvent.click(screen.getByTestId('zoom-out'))
    expect(screen.getByTestId('zoom-percentage')).toHaveTextContent('65%')
    expect(getScale()).toBeCloseTo(0.65)
  })

  it('opening the percentage dropdown and selecting a preset applies that zoom', () => {
    render(<PreviewTab />)
    fireEvent.click(screen.getByTestId('zoom-percentage'))
    fireEvent.click(screen.getByRole('option', { name: '100%' }))
    expect(screen.getByTestId('zoom-percentage')).toHaveTextContent('100%')
    expect(getScale()).toBeCloseTo(1.0)
  })

  it('selecting Fit from the dropdown clears the override back to auto-fit behavior', () => {
    render(<PreviewTab />)
    fireEvent.click(screen.getByTestId('zoom-percentage'))
    fireEvent.click(screen.getByRole('option', { name: '150%' }))
    expect(screen.getByTestId('zoom-percentage')).toHaveTextContent('150%')

    fireEvent.click(screen.getByTestId('zoom-percentage'))
    fireEvent.click(screen.getByRole('option', { name: 'Fit' }))
    expect(screen.getByTestId('zoom-percentage')).toHaveTextContent('Fit')
    expect(getScale()).toBeCloseTo(0.75)
  })

  it('clamps zoom-in at 200%', () => {
    render(<PreviewTab />)
    const zoomIn = screen.getByTestId('zoom-in')
    for (let i = 0; i < 20; i++) fireEvent.click(zoomIn)
    expect(screen.getByTestId('zoom-percentage')).toHaveTextContent('200%')
    expect(getScale()).toBeCloseTo(2.0)
    fireEvent.click(zoomIn)
    expect(screen.getByTestId('zoom-percentage')).toHaveTextContent('200%')
  })

  it('clamps zoom-out at 25%', () => {
    render(<PreviewTab />)
    const zoomOut = screen.getByTestId('zoom-out')
    for (let i = 0; i < 20; i++) fireEvent.click(zoomOut)
    expect(screen.getByTestId('zoom-percentage')).toHaveTextContent('25%')
    expect(getScale()).toBeCloseTo(0.25)
    fireEvent.click(zoomOut)
    expect(screen.getByTestId('zoom-percentage')).toHaveTextContent('25%')
  })

  it('restores a previously-persisted zoom level on mount', () => {
    localStorage.setItem(ZOOM_KEY, '1.25')
    render(<PreviewTab />)
    expect(screen.getByTestId('zoom-percentage')).toHaveTextContent('125%')
    expect(getScale()).toBeCloseTo(1.25)
  })

  it('persists explicit zoom changes to localStorage', () => {
    render(<PreviewTab />)
    fireEvent.click(screen.getByTestId('zoom-in'))
    expect(localStorage.getItem(ZOOM_KEY)).toBe('0.85')
  })

  it('persists the Fit selection to localStorage', () => {
    render(<PreviewTab />)
    fireEvent.click(screen.getByTestId('zoom-in'))
    fireEvent.click(screen.getByTestId('zoom-percentage'))
    fireEvent.click(screen.getByRole('option', { name: 'Fit' }))
    expect(localStorage.getItem(ZOOM_KEY)).toBe('fit')
  })
})

describe('PreviewEditOverlay integration', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse({ pageCount: 1, anchors: [] }))
    )
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders drag handles for sections that have content', async () => {
    useResumeEditorStore.setState({
      data: { work: [{ name: 'Acme' }] },
      meta: { ...useResumeEditorStore.getState().meta, sectionOrder: ['work'] },
    })
    render(<PreviewTab />)
    // Preview content is debounced 300ms; PreviewTab.test.tsx does not use
    // fake timers elsewhere in this file, so wait it out with real timers via
    // findByTestId's built-in polling rather than introducing a new
    // vi.useFakeTimers() setup that would conflict with the rest of the file.
    expect(await screen.findByTestId('pv-handle-section|work', {}, { timeout: 1500 })).toBeTruthy()
  })

  it('renders no overlay controls at all when interactive is false (Expanded Preview mode)', async () => {
    useResumeEditorStore.setState({
      data: { work: [{ name: 'Acme' }] },
      meta: { ...useResumeEditorStore.getState().meta, sectionOrder: ['work'] },
    })
    render(<PreviewTab interactive={false} />)
    // Give the debounce/measurement pass the same window the sibling test
    // waits out, then assert the handle never appears — a clean preview with
    // no editing affordances, as Expanded Preview mode intends.
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(screen.queryByTestId('pv-handle-section|work')).toBeNull()
    expect(screen.queryByTestId('pv-add-section-toggle')).toBeNull()
  })
})
