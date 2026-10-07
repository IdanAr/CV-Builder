// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const renders: string[] = []
const seenMeta: Record<string, unknown> = {}

vi.mock('@/components/cvs/CvThumbnail', async () => {
  const actual = await vi.importActual<typeof import('@/components/cvs/CvThumbnail')>(
    '@/components/cvs/CvThumbnail'
  )
  const Real = actual.CvThumbnail as unknown as React.ComponentType<{ data: unknown; meta: unknown }>
  const Recording = React.memo(function Recording(props: { data: unknown; meta: unknown }) {
    const id = (props.meta as { templateId: string }).templateId
    renders.push(id)
    seenMeta[id] = props.meta
    return <Real {...props} />
  })
  return { CvThumbnail: Recording }
})

import { TemplateGrid } from './TemplateGrid'

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
  renders.length = 0
  useResumeEditorStore.setState({
    resumeId: 'r1', title: 'CV', data: { basics: { name: 'Zed Quill' } } as never, meta: defaultMeta,
    isDirty: false, isSaving: false, saveError: null,
    _history: [], _future: [], canUndo: false, canRedo: false,
  })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('TemplateGrid', () => {
  it('renders five template buttons in a Template group with the active one pressed', () => {
    render(<TemplateGrid />)
    const group = screen.getByRole('group', { name: 'Template' })
    expect(group.querySelectorAll('button')).toHaveLength(5)
    expect(screen.getByRole('button', { name: /^Classic/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Modern/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('names each button by its label only and describes it with the description', () => {
    render(<TemplateGrid />)
    const modern = screen.getByRole('button', { name: 'Modern' })
    expect(modern).toHaveAccessibleDescription('Bold header block, accent titles')
  })

  it('renders five thumbnails showing the user data', () => {
    const { container } = render(<TemplateGrid />)
    expect(screen.getAllByTestId('cv-thumbnail-page')).toHaveLength(5)
    expect(container.textContent).toContain('Zed Quill')
  })

  it('passes each card its own templateId to its thumbnail', () => {
    render(<TemplateGrid />)
    for (const id of ['classic', 'modern', 'minimal', 'executive', 'sidebar']) {
      expect((seenMeta[id] as { templateId: string }).templateId).toBe(id)
    }
  })

  it('clicking Modern sets the template', () => {
    render(<TemplateGrid />)
    fireEvent.click(screen.getByRole('button', { name: 'Modern' }))
    expect(useResumeEditorStore.getState().meta.templateId).toBe('modern')
  })

  it('clicking the already-selected template is a no-op (no history entry)', () => {
    render(<TemplateGrid />)
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }))
    expect(useResumeEditorStore.getState()._history).toHaveLength(0)
    expect(useResumeEditorStore.getState().canUndo).toBe(false)
  })

  it('gives the selected card the cobalt ring', () => {
    render(<TemplateGrid />)
    expect(screen.getByRole('button', { name: 'Classic' }).className).toContain('ring-accent-600')
    expect(screen.getByRole('button', { name: 'Modern' }).className).not.toContain('ring-accent-600')
  })

  it('does not re-render thumbnails when only the selected template changes', () => {
    vi.useFakeTimers()
    render(<TemplateGrid />)
    renders.length = 0
    act(() => { useResumeEditorStore.getState().setMeta({ templateId: 'modern' }) })
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.getByRole('button', { name: 'Modern' })).toHaveAttribute('aria-pressed', 'true')
    expect(renders).toEqual([])
  })

  describe('active={false} (Design tab hidden)', () => {
    it('renders the cards without any thumbnail', () => {
      render(<TemplateGrid active={false} />)
      expect(screen.queryAllByTestId('cv-thumbnail-page')).toHaveLength(0)
      expect(screen.getByRole('group', { name: 'Template' }).querySelectorAll('button')).toHaveLength(5)
      expect(screen.getByRole('button', { name: 'Classic' })).toHaveAttribute('aria-pressed', 'true')
      expect(renders).toEqual([])
    })

    it('selecting a template still works and renders no thumbnails', () => {
      render(<TemplateGrid active={false} />)
      fireEvent.click(screen.getByRole('button', { name: 'Modern' }))
      expect(useResumeEditorStore.getState().meta.templateId).toBe('modern')
      expect(screen.getByRole('button', { name: 'Modern' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.queryAllByTestId('cv-thumbnail-page')).toHaveLength(0)
    })

    it('shows thumbnails with the user data immediately when switched to active', () => {
      const { rerender, container } = render(<TemplateGrid active={false} />)
      rerender(<TemplateGrid active />)
      expect(screen.getAllByTestId('cv-thumbnail-page')).toHaveLength(5)
      expect(container.textContent).toContain('Zed Quill')
    })

    it('does not re-render at all on unrelated data or meta changes', () => {
      const onRender = vi.fn()
      render(
        <React.Profiler id="grid" onRender={onRender}>
          <TemplateGrid active={false} />
        </React.Profiler>
      )
      const after = onRender.mock.calls.length
      act(() => {
        useResumeEditorStore.setState((s) => ({
          data: { ...s.data, basics: { ...(s.data.basics ?? {}), summary: 'x' } } as never,
          meta: { ...s.meta, primaryColor: '#ff0000' },
        }))
      })
      expect(onRender.mock.calls.length).toBe(after)
    })
  })
})
