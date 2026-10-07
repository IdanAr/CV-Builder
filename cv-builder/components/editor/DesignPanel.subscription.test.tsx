// @vitest-environment jsdom
import React, { Profiler } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { DesignPanel } from './DesignPanel'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

// TemplateGrid deliberately subscribes to all of `data` (it renders thumbnails
// of the user's CV, debounced), so it is stubbed here: this file guards that
// the rest of the panel only cares about customSections.
vi.mock('./design/TemplateGrid', () => ({ TemplateGrid: () => null }))

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

describe('DesignPanel data subscription scope', () => {
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
    // Mount alone commits more than once (dnd-kit's own effects inside
    // DndContext/SortableContext fire regardless), so assert the commit count
    // does not grow from an unrelated data change.
    const callsAfterMount = onRender.mock.calls.length

    act(() => {
      useResumeEditorStore.setState((s) => ({
        data: { ...s.data, basics: { ...s.data.basics, summary: 'x' } },
      }))
    })
    expect(onRender.mock.calls.length).toBe(callsAfterMount)
  })
})
