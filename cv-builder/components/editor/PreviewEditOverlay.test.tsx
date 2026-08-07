// components/editor/PreviewEditOverlay.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRef } from 'react'
import { render, screen, act } from '@testing-library/react'
import { PreviewEditOverlay } from './PreviewEditOverlay'
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
