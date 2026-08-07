// components/editor/PreviewEditOverlay.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRef } from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { PreviewEditOverlay } from './PreviewEditOverlay'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import type { ResumeData } from '@/lib/schemas/resume.zod'

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const data: ResumeData = {
  work: [{ name: 'Acme' }, { name: 'Globex' }],
}

function Harness() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div ref={innerRef}>
        <div data-pv-section="work">
          <div data-pv-entry={0}>Job 1</div>
          <div data-pv-entry={1}>Job 2</div>
        </div>
      </div>
      <PreviewEditOverlay innerRef={innerRef} wrapperRef={wrapperRef} scale={1} sectionOrder={['work']} data={data} />
    </div>
  )
}

describe('PreviewEditOverlay measurement', () => {
  it('renders one section drag handle and one handle per entry', async () => {
    // jsdom's getBoundingClientRect returns all-zero rects by default, which
    // is fine here: the test only asserts handles are rendered per measured
    // element, not their pixel position (Task 10 will cover positioning
    // behavior with mocked non-zero rects).
    render(<Harness />)
    await act(async () => {})
    expect(screen.getByTestId('pv-handle-section|work')).toBeTruthy()
    expect(screen.getByTestId('pv-handle-entry|work|0')).toBeTruthy()
    expect(screen.getByTestId('pv-handle-entry|work|1')).toBeTruthy()
  })

  it('renders nothing for a section with no matching data-pv-section element', async () => {
    function EmptyHarness() {
      const wrapperRef = useRef<HTMLDivElement>(null)
      const innerRef = useRef<HTMLDivElement>(null)
      return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
          <div ref={innerRef} />
          <PreviewEditOverlay innerRef={innerRef} wrapperRef={wrapperRef} scale={1} sectionOrder={['education']} data={{}} />
        </div>
      )
    }
    render(<EmptyHarness />)
    await act(async () => {})
    expect(screen.queryByTestId('pv-handle-section|education')).toBeNull()
  })
})

describe('parseHandleId', () => {
  it('parses a section id', async () => {
    const { parseHandleId } = await import('./PreviewEditOverlay')
    expect(parseHandleId('section|work')).toEqual({ kind: 'section', sectionKey: 'work' })
  })

  it('parses an entry id, preserving colons in a custom section key', async () => {
    const { parseHandleId } = await import('./PreviewEditOverlay')
    expect(parseHandleId('entry|custom:abc-123|2')).toEqual({ kind: 'entry', sectionKey: 'custom:abc-123', index: 2 })
  })

  it('returns null for an unrecognized id', async () => {
    const { parseHandleId } = await import('./PreviewEditOverlay')
    expect(parseHandleId('nonsense')).toBeNull()
  })
})

describe('resolveDragEnd', () => {
  it('computes a new sectionOrder when two section handles are swapped', async () => {
    const { resolveDragEnd } = await import('./PreviewEditOverlay')
    const result = resolveDragEnd('section|work', 'section|education', ['work', 'education', 'skills'], {})
    expect(result).toEqual({ kind: 'section', sectionOrder: ['education', 'work', 'skills'] })
  })

  it('computes reordered items when two entry handles in the same section are swapped', async () => {
    const { resolveDragEnd } = await import('./PreviewEditOverlay')
    const data: ResumeData = { work: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }
    const result = resolveDragEnd('entry|work|0', 'entry|work|2', ['work'], data)
    expect(result).toEqual({ kind: 'entry', sectionKey: 'work', items: [{ name: 'B' }, { name: 'C' }, { name: 'A' }] })
  })

  it('returns null when the two entries belong to different sections', async () => {
    const { resolveDragEnd } = await import('./PreviewEditOverlay')
    const data: ResumeData = { work: [{ name: 'A' }], education: [{ institution: 'U' }] }
    expect(resolveDragEnd('entry|work|0', 'entry|education|0', ['work', 'education'], data)).toBeNull()
  })

  it('returns null when a section handle is dropped on an entry handle', async () => {
    const { resolveDragEnd } = await import('./PreviewEditOverlay')
    const data: ResumeData = { work: [{ name: 'A' }] }
    expect(resolveDragEnd('section|work', 'entry|work|0', ['work'], data)).toBeNull()
  })

  it('returns null when dropped on itself', async () => {
    const { resolveDragEnd } = await import('./PreviewEditOverlay')
    expect(resolveDragEnd('section|work', 'section|work', ['work'], {})).toBeNull()
  })

  it('returns null for an out-of-range entry index', async () => {
    const { resolveDragEnd } = await import('./PreviewEditOverlay')
    const data: ResumeData = { work: [{ name: 'A' }] }
    expect(resolveDragEnd('entry|work|0', 'entry|work|5', ['work'], data)).toBeNull()
  })
})

describe('PreviewEditOverlay add-entry', () => {
  beforeEach(() => {
    useResumeEditorStore.setState({
      data: { work: [{ name: 'Acme' }] },
      meta: { ...useResumeEditorStore.getState().meta, sectionOrder: ['work'] },
      pendingFocus: null,
    })
  })

  it('appends a blank work entry and requests focus on the work section', () => {
    function OneSectionHarness() {
      const wrapperRef = useRef<HTMLDivElement>(null)
      const innerRef = useRef<HTMLDivElement>(null)
      return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
          <div ref={innerRef}>
            <div data-pv-section="work"><div data-pv-entry={0}>Job</div></div>
          </div>
          <PreviewEditOverlay innerRef={innerRef} wrapperRef={wrapperRef} scale={1} sectionOrder={['work']} data={{ work: [{ name: 'Acme' }] }} />
        </div>
      )
    }
    render(<OneSectionHarness />)
    fireEvent.click(screen.getByTestId('pv-add-entry-work'))
    expect(useResumeEditorStore.getState().data.work).toHaveLength(2)
    expect(useResumeEditorStore.getState().data.work?.[1]).toEqual({
      name: '', position: '', url: '', startDate: '', endDate: '', summary: '', highlights: [],
    })
    expect(useResumeEditorStore.getState().pendingFocus).toBe('work')
  })
})

describe('PreviewEditOverlay add-section', () => {
  beforeEach(() => {
    useResumeEditorStore.setState({
      data: { work: [{ name: 'Acme' }] },
      meta: { ...useResumeEditorStore.getState().meta, sectionOrder: ['work'] },
      pendingFocus: null,
    })
  })

  function OneSectionHarness() {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const innerRef = useRef<HTMLDivElement>(null)
    return (
      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <div ref={innerRef}>
          <div data-pv-section="work"><div data-pv-entry={0}>Job</div></div>
        </div>
        <PreviewEditOverlay innerRef={innerRef} wrapperRef={wrapperRef} scale={1} sectionOrder={['work']} data={{ work: [{ name: 'Acme' }] }} />
      </div>
    )
  }

  it('adds a new custom section and requests focus on it', () => {
    render(<OneSectionHarness />)
    fireEvent.click(screen.getByTestId('pv-add-section-toggle'))
    fireEvent.click(screen.getByText('+ New custom section'))
    const sections = useResumeEditorStore.getState().data.customSections ?? []
    expect(sections).toHaveLength(1)
    expect(useResumeEditorStore.getState().meta.sectionOrder).toContain(`custom:${sections[0].id}`)
    expect(useResumeEditorStore.getState().pendingFocus).toBe(`custom:${sections[0].id}`)
  })

  it('re-adds a removed built-in section', () => {
    render(<OneSectionHarness />)
    fireEvent.click(screen.getByTestId('pv-add-section-toggle'))
    fireEvent.click(screen.getByText('Education'))
    expect(useResumeEditorStore.getState().meta.sectionOrder).toEqual(['work', 'education'])
    expect(useResumeEditorStore.getState().pendingFocus).toBe('education')
  })
})
