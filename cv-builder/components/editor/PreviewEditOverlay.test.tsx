// components/editor/PreviewEditOverlay.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRef } from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { closestCenter, type ClientRect, type CollisionDetection } from '@dnd-kit/core'
import { PreviewEditOverlay, sameKindClosestCenter } from './PreviewEditOverlay'
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
  vi.restoreAllMocks()
})

// jsdom always reports all-zero rects. Entry handles are now suppressed below
// MIN_ENTRY_HANDLE_RECT_HEIGHT (14px), so any test that asserts on entry
// handles has to supply realistic measured heights.
function mockRects(heightFor: (el: HTMLElement) => number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const height = heightFor(this)
    return {
      top: 0, left: 0, right: 100, bottom: height, width: 100, height, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect
  })
}

const TALL_ENOUGH = 20
const TOO_SHORT = 10

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
    // Entries are measured at a legible height so the low-zoom suppression
    // guard doesn't apply; the test asserts handles are rendered per measured
    // element, not their pixel position.
    mockRects((el) => (el.dataset.pvEntry !== undefined ? TALL_ENOUGH : 200))
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
      pendingFocusEntryIndex: null,
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
    const added = useResumeEditorStore.getState().data.work?.[1]
    expect(added).toMatchObject({ name: '', url: '' })
    expect(added?.roles).toHaveLength(1)
    expect(added?.roles?.[0]).toMatchObject({ position: '', startDate: '', endDate: '', summary: '', highlights: [] })
    expect(useResumeEditorStore.getState().pendingFocus).toBe('work')
    // The new entry lands at index 1 (there was 1 entry before this click) —
    // ListFieldManager needs this exact index to scroll to/focus the right
    // row, not just the section as a whole.
    expect(useResumeEditorStore.getState().pendingFocusEntryIndex).toBe(1)
  })
})

describe('PreviewEditOverlay add-section', () => {
  beforeEach(() => {
    useResumeEditorStore.setState({
      data: { work: [{ name: 'Acme' }] },
      meta: { ...useResumeEditorStore.getState().meta, sectionOrder: ['work'] },
      pendingFocus: null,
      pendingFocusEntryIndex: null,
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
    expect(useResumeEditorStore.getState().pendingFocusEntryIndex).toBeNull()
  })

  it('re-adds a removed built-in section', () => {
    render(<OneSectionHarness />)
    fireEvent.click(screen.getByTestId('pv-add-section-toggle'))
    fireEvent.click(screen.getByText('Education'))
    expect(useResumeEditorStore.getState().meta.sectionOrder).toEqual(['work', 'education'])
    expect(useResumeEditorStore.getState().pendingFocus).toBe('education')
    expect(useResumeEditorStore.getState().pendingFocusEntryIndex).toBeNull()
  })
})

// Fix 1: PreviewTab feeds this component `data`/`sectionOrder` from *debounced*
// copies (300ms trailing, no maxWait). Rendering off them is correct, but every
// write is a whole-array replacement and must be computed from live store state
// or it silently discards whatever landed in the store since the last debounce
// flush.
describe('PreviewEditOverlay writes read live store state, not stale props', () => {
  // Deliberately frozen at the pre-update snapshot: this is what the debounced
  // prop still holds while the store has already moved on.
  const staleData: ResumeData = { work: [{ name: 'Acme' }] }

  beforeEach(() => {
    useResumeEditorStore.setState({
      data: { work: [{ name: 'Acme' }] },
      meta: { ...useResumeEditorStore.getState().meta, sectionOrder: ['work'] },
      pendingFocus: null,
      pendingFocusEntryIndex: null,
    })
  })

  function StaleHarness() {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const innerRef = useRef<HTMLDivElement>(null)
    return (
      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <div ref={innerRef}>
          <div data-pv-section="work"><div data-pv-entry={0}>Job</div></div>
        </div>
        <PreviewEditOverlay
          innerRef={innerRef}
          wrapperRef={wrapperRef}
          scale={1}
          sectionOrder={['work']}
          data={staleData}
        />
      </div>
    )
  }

  function expectBlankWork(entry: unknown) {
    expect(entry).toMatchObject({ name: '', url: '' })
    const roles = (entry as { roles?: unknown[] }).roles
    expect(roles).toHaveLength(1)
    expect(roles?.[0]).toMatchObject({ position: '', startDate: '', endDate: '', summary: '', highlights: [] })
  }

  it('appends to the live work array when the store changed after render (concurrent edit is not discarded)', () => {
    render(<StaleHarness />)
    // Simulates a typing burst in the Edit tab that the 300ms debounce has not
    // yet propagated into this component's `data` prop.
    act(() => {
      useResumeEditorStore.setState({ data: { work: [{ name: 'Acme Corp' }, { name: 'Globex' }] } })
    })

    fireEvent.click(screen.getByTestId('pv-add-entry-work'))

    const work = useResumeEditorStore.getState().data.work ?? []
    // Reading the stale prop would have written [Acme, blank] — length 2, the
    // concurrent edit gone.
    expect(work).toHaveLength(3)
    expect(work[0].name).toBe('Acme Corp')
    expect(work[1].name).toBe('Globex')
    expectBlankWork(work[2])
  })

  it('keeps both additions when "+" is double-clicked before the props debounce catches up', () => {
    render(<StaleHarness />)
    const addButton = screen.getByTestId('pv-add-entry-work')

    // Two clicks ~150ms apart: the props never change between them.
    fireEvent.click(addButton)
    fireEvent.click(addButton)

    const work = useResumeEditorStore.getState().data.work ?? []
    // Reading the stale prop would have made the second click overwrite the
    // first one's result, leaving length 2.
    expect(work).toHaveLength(3)
    expect(work[0].name).toBe('Acme')
    expectBlankWork(work[1])
    expectBlankWork(work[2])
  })

  it('re-adds a built-in onto the live sectionOrder when the store order changed after render', () => {
    render(<StaleHarness />)
    act(() => {
      useResumeEditorStore.setState({
        meta: { ...useResumeEditorStore.getState().meta, sectionOrder: ['work', 'skills'] },
      })
    })

    fireEvent.click(screen.getByTestId('pv-add-section-toggle'))
    fireEvent.click(screen.getByText('Education'))

    // Reading the stale prop order would have written ['work', 'education'],
    // silently dropping the concurrently added 'skills'.
    expect(useResumeEditorStore.getState().meta.sectionOrder).toEqual(['work', 'skills', 'education'])
  })
})

// Fix 2: section and entry handles share one DndContext and sit in the same
// narrow vertical strip, so unfiltered closestCenter regularly resolves a
// section drag against an entry handle — a silent no-op in resolveDragEnd.
describe('sameKindClosestCenter', () => {
  const R = (top: number): ClientRect =>
    ({ top, left: 0, right: 10, bottom: top + 10, width: 10, height: 10 })

  // The entry droppable is deliberately placed closer to the dragged handle
  // than the section droppable, i.e. the exact geometry that made unfiltered
  // closestCenter pick the wrong kind.
  const droppableRects = new Map<string, ClientRect>([
    ['section|education', R(40)],
    ['entry|work|0', R(12)],
  ])

  function makeArgs(activeId: string): Parameters<CollisionDetection>[0] {
    return {
      active: { id: activeId, data: { current: undefined }, rect: { current: { initial: null, translated: null } } },
      collisionRect: R(10),
      droppableRects,
      droppableContainers: [...droppableRects.keys()].map((id) => ({
        id,
        key: id,
        disabled: false,
        node: { current: null },
        rect: { current: droppableRects.get(id)! },
        data: { current: undefined },
      })),
      pointerCoordinates: null,
    } as unknown as Parameters<CollisionDetection>[0]
  }

  it('(control) unfiltered closestCenter picks the wrong-kind entry handle for a section drag', () => {
    const collisions = closestCenter(makeArgs('section|work'))
    expect(collisions[0]?.id).toBe('entry|work|0')
  })

  it('never returns an entry droppable while a section handle is active', () => {
    const collisions = sameKindClosestCenter(makeArgs('section|work'))
    expect(collisions.every((c) => String(c.id).startsWith('section|'))).toBe(true)
    expect(collisions[0]?.id).toBe('section|education')
  })

  it('never returns a section droppable while an entry handle is active', () => {
    const collisions = sameKindClosestCenter(makeArgs('entry|work|1'))
    expect(collisions.every((c) => String(c.id).startsWith('entry|'))).toBe(true)
    expect(collisions[0]?.id).toBe('entry|work|0')
  })

  it('returns no collisions for an unparseable active id', () => {
    expect(sameKindClosestCenter(makeArgs('nonsense'))).toEqual([])
  })
})

// Fix 3: handle size/offset are fixed post-scale pixels, so at low zoom an
// entry's rendered height can drop below the handle size and adjacent handles
// visually overlap. Conservative mitigation: omit the handle rather than draw
// a broken one.
describe('PreviewEditOverlay low-zoom entry handle suppression', () => {
  function TwoEntryHarness() {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const innerRef = useRef<HTMLDivElement>(null)
    return (
      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <div ref={innerRef}>
          <div data-pv-section="work">
            <div data-pv-entry={0}>Squeezed</div>
            <div data-pv-entry={1}>Roomy</div>
          </div>
        </div>
        <PreviewEditOverlay
          innerRef={innerRef}
          wrapperRef={wrapperRef}
          scale={0.6}
          sectionOrder={['work']}
          data={{ work: [{ name: 'Acme' }, { name: 'Globex' }] }}
        />
      </div>
    )
  }

  it('omits the handle for an entry measured below the minimum height, keeping the normal-height one', async () => {
    mockRects((el) => {
      if (el.dataset.pvEntry === '0') return TOO_SHORT
      if (el.dataset.pvEntry === '1') return TALL_ENOUGH
      return 200
    })
    render(<TwoEntryHarness />)
    await act(async () => {})

    expect(screen.queryByTestId('pv-handle-entry|work|0')).toBeNull()
    expect(screen.getByTestId('pv-handle-entry|work|1')).toBeTruthy()
    // The section handle is never suppressed — sections are spaced far enough
    // apart that they don't crowd.
    expect(screen.getByTestId('pv-handle-section|work')).toBeTruthy()
  })

  it('still renders the add-entry button when every entry is too short, anchored off the section rect', async () => {
    mockRects((el) => (el.dataset.pvEntry !== undefined ? TOO_SHORT : 200))
    render(<TwoEntryHarness />)
    await act(async () => {})

    expect(screen.queryByTestId('pv-handle-entry|work|0')).toBeNull()
    expect(screen.queryByTestId('pv-handle-entry|work|1')).toBeNull()
    const addButton = screen.getByTestId('pv-add-entry-work')
    // section rect top 0 + height 200 + 4px gap — not the 10px entry rect.
    expect(addButton.style.top).toBe('204px')
  })
})

// Section/entry handles and the add-entry button used to be always-visible,
// which read as cluttered — every control now starts hidden and fades in
// only while the user is hovering that section's own region (its title, any
// entry, or the gap around them), all together as one group.
describe('PreviewEditOverlay hover-to-reveal', () => {
  it('hides section and entry handles until the section group is hovered, then hides them again on mouseleave', async () => {
    mockRects((el) => (el.dataset.pvEntry !== undefined ? TALL_ENOUGH : 200))
    render(<Harness />)
    await act(async () => {})

    const group = screen.getByTestId('pv-section-group-work')
    const sectionHandle = screen.getByTestId('pv-handle-section|work')
    const entryHandle = screen.getByTestId('pv-handle-entry|work|0')

    // Controls are mounted (so click handlers/tests can still target them)
    // but visually and interactively hidden until hovered.
    expect(sectionHandle.parentElement?.style.opacity).toBe('0')
    expect(sectionHandle.parentElement?.style.pointerEvents).toBe('none')

    fireEvent.mouseEnter(group)
    expect(sectionHandle.parentElement?.style.opacity).toBe('1')
    expect(sectionHandle.parentElement?.style.pointerEvents).toBe('auto')
    expect(entryHandle.parentElement?.style.opacity).toBe('1')

    fireEvent.mouseLeave(group)
    expect(sectionHandle.parentElement?.style.opacity).toBe('0')
    expect(sectionHandle.parentElement?.style.pointerEvents).toBe('none')
  })

  it('hides the document-level add-section control until its own region is hovered', async () => {
    mockRects(() => 50)
    render(<Harness />)
    await act(async () => {})

    const toggle = screen.getByTestId('pv-add-section-toggle')
    expect(toggle.parentElement?.style.opacity).toBe('0')

    const addSectionRegion = toggle.closest('div')?.parentElement
    expect(addSectionRegion).toBeTruthy()
    fireEvent.mouseEnter(addSectionRegion!)
    expect(toggle.parentElement?.style.opacity).toBe('1')
  })

  it('keeps a section\'s controls visible while a drag is active, even without hovering it', async () => {
    mockRects((el) => (el.dataset.pvEntry !== undefined ? TALL_ENOUGH : 200))
    render(<Harness />)
    await act(async () => {})

    const sectionHandle = screen.getByTestId('pv-handle-section|work')
    expect(sectionHandle.parentElement?.style.opacity).toBe('0')

    // Simulate the effect of a drag being in progress via keyboard activation
    // (Space on a focused draggable starts a dnd-kit keyboard drag without
    // needing real pointer geometry, which jsdom can't provide).
    sectionHandle.focus()
    fireEvent.keyDown(sectionHandle, { code: 'Space' })
    expect(sectionHandle.parentElement?.style.opacity).toBe('1')

    fireEvent.keyDown(sectionHandle, { code: 'Escape' })
  })
})

// WCAG 2.4.7 Focus Visible: the hover-only reveal above leaves every control
// invisible (opacity: 0, pointer-events: none) to a keyboard user who Tabs to
// it without ever hovering. Keyboard focus must reveal the same controls
// hover does.
describe('PreviewEditOverlay focus-to-reveal (keyboard accessibility)', () => {
  it('reveals the add-entry button and section handle when a control inside the group receives keyboard focus, without hovering', async () => {
    mockRects((el) => (el.dataset.pvEntry !== undefined ? TALL_ENOUGH : 200))
    render(<Harness />)
    await act(async () => {})

    const sectionHandle = screen.getByTestId('pv-handle-section|work')
    const addButton = screen.getByTestId('pv-add-entry-work')

    expect(sectionHandle.parentElement?.style.opacity).toBe('0')

    // Tab lands on the add-entry button with no mouseenter ever firing.
    act(() => {
      addButton.focus()
    })
    fireEvent.focus(addButton)

    expect(getComputedStyle(addButton).opacity).toBe('1')
    expect(sectionHandle.parentElement?.style.opacity).toBe('1')
    expect(sectionHandle.parentElement?.style.pointerEvents).toBe('auto')
  })

  it('hides the group again once focus truly leaves it (blur to outside the group)', async () => {
    mockRects((el) => (el.dataset.pvEntry !== undefined ? TALL_ENOUGH : 200))
    render(<Harness />)
    await act(async () => {})

    const addButton = screen.getByTestId('pv-add-entry-work')
    const sectionHandle = screen.getByTestId('pv-handle-section|work')

    act(() => {
      addButton.focus()
    })
    fireEvent.focus(addButton)
    expect(sectionHandle.parentElement?.style.opacity).toBe('1')

    // Focus moves to something entirely outside the group (relatedTarget is
    // not contained by the group's wrapper) — document.body stands in for
    // "somewhere else on the page".
    fireEvent.blur(addButton, { relatedTarget: document.body })
    expect(sectionHandle.parentElement?.style.opacity).toBe('0')
  })

  it('does not flicker the group invisible when focus moves between two controls inside the same group', async () => {
    mockRects((el) => (el.dataset.pvEntry !== undefined ? TALL_ENOUGH : 200))
    render(<Harness />)
    await act(async () => {})

    const sectionHandle = screen.getByTestId('pv-handle-section|work')
    const entryHandle = screen.getByTestId('pv-handle-entry|work|0')
    const addButton = screen.getByTestId('pv-add-entry-work')

    act(() => {
      sectionHandle.focus()
    })
    fireEvent.focus(sectionHandle)
    expect(addButton.parentElement?.style.opacity).toBe('1')

    // Tab moves focus from the section handle to the entry handle, both
    // inside the same group's wrapper: blur fires with relatedTarget set to
    // the element about to receive focus, which the wrapper *does* contain.
    fireEvent.blur(sectionHandle, { relatedTarget: entryHandle })
    // The group must still read visible throughout this transition — no
    // frame where it drops to invisible between the blur and the next focus.
    expect(addButton.parentElement?.style.opacity).toBe('1')

    act(() => {
      entryHandle.focus()
    })
    fireEvent.focus(entryHandle)
    expect(addButton.parentElement?.style.opacity).toBe('1')
  })

  it('reveals the add-section control on keyboard focus of its toggle button, without hovering', async () => {
    mockRects(() => 50)
    render(<Harness />)
    await act(async () => {})

    const toggle = screen.getByTestId('pv-add-section-toggle')
    expect(toggle.parentElement?.style.opacity).toBe('0')

    act(() => {
      toggle.focus()
    })
    fireEvent.focus(toggle)

    expect(toggle.parentElement?.style.opacity).toBe('1')
  })
})

describe('PreviewEditOverlay add-entry button placement', () => {
  it('is horizontally centered within the section, not hugging the left margin', async () => {
    mockRects((el) => (el.dataset.pvEntry !== undefined ? TALL_ENOUGH : 200))
    render(<Harness />)
    await act(async () => {})

    const addButton = screen.getByTestId('pv-add-entry-work')
    // Harness's mocked section rect is 100px wide (see mockRects' fixed
    // `right: 100`); an 18px button centered in it sits at (100-18)/2 = 41px,
    // nowhere near the old fixed `left - 20` positioning against the left edge.
    expect(addButton.style.left).toBe('41px')
  })
})

// Regression test: handle rects passed to DragHandle are section-local (0,0
// = the group's own top-left), not page-absolute. An entry flush with its
// section's left edge — the common case, e.g. Languages/Skills entries with
// no extra indentation — has local `rect.left === 0`. Clamping
// `rect.left - offset` to a minimum of 0 (the pre-fix behavior) then always
// placed the handle at local x=0: exactly on top of the entry's own text,
// not in the margin to its left. The fix lets the position go negative,
// which is the section's real left margin, not the page edge.
describe('PreviewEditOverlay handles do not overlap entry text', () => {
  it('positions the section and entry handles to the left of local x=0, not clamped onto it', async () => {
    // Harness's mocked rects give every element left:0 — both the section
    // and its entries share the same local left edge, reproducing the
    // reported overlap exactly.
    mockRects((el) => (el.dataset.pvEntry !== undefined ? TALL_ENOUGH : 200))
    render(<Harness />)
    await act(async () => {})

    const sectionHandle = screen.getByTestId('pv-handle-section|work')
    const entryHandle = screen.getByTestId('pv-handle-entry|work|0')
    expect(sectionHandle.style.left).toBe('-24px')
    expect(entryHandle.style.left).toBe('-20px')
  })

  // Regression: the hover-catching box used to match the section's own
  // content box exactly, which does NOT include where the handles above
  // actually render (negative local `left`, outside that box). Moving the
  // mouse from the content onto a handle therefore crossed out of the
  // hoverable region and hid it — impossible to ever grab. The catcher must
  // extend far enough left to fully contain the widest handle offset (24px).
  it('widens the hover-catching box to fully contain the handles it reveals, not just the section content', async () => {
    mockRects((el) => (el.dataset.pvEntry !== undefined ? TALL_ENOUGH : 200))
    render(<Harness />)
    await act(async () => {})

    const group = screen.getByTestId('pv-section-group-work')
    const sectionHandle = screen.getByTestId('pv-handle-section|work')

    // The catcher's own local box, in the *outer* group's coordinate space.
    const groupLeft = parseFloat(group.style.left)
    const groupWidth = parseFloat(group.style.width)

    // The handle's position is expressed relative to the group's original
    // (unexpanded) local origin; translate it into that same outer space by
    // undoing the inner layer's own +HANDLE_GUTTER shift, matching how the
    // component computes it.
    const HANDLE_GUTTER = 32
    const handleLeftInOuterSpace = groupLeft + HANDLE_GUTTER + parseFloat(sectionHandle.style.left)

    // The handle's full width must sit within [groupLeft, groupLeft + groupWidth]
    // — i.e. hovering anywhere across the handle never leaves the box that
    // keeps it visible.
    const handleWidth = parseFloat(sectionHandle.style.width)
    expect(handleLeftInOuterSpace).toBeGreaterThanOrEqual(groupLeft)
    expect(handleLeftInOuterSpace + handleWidth).toBeLessThanOrEqual(groupLeft + groupWidth)
  })
})
