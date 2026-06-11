import { describe, it, expect, beforeEach } from 'vitest'
import { useResumeEditorStore } from './resume-editor.store'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

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
    _history: [],
    _future: [],
    canUndo: false,
    canRedo: false,
  })
})

describe('setMeta — Minimal template is single-column only', () => {
  it('switching to minimal from a two-column template resets layout to single-column', () => {
    useResumeEditorStore.setState({ meta: { ...defaultMeta, templateId: 'classic', layout: 'two-column' } })
    useResumeEditorStore.getState().setMeta({ templateId: 'minimal' })
    const meta = useResumeEditorStore.getState().meta
    expect(meta.templateId).toBe('minimal')
    expect(meta.layout).toBe('single-column')
  })

  it('setting two-column while on minimal is ignored', () => {
    useResumeEditorStore.setState({ meta: { ...defaultMeta, templateId: 'minimal' } })
    useResumeEditorStore.getState().setMeta({ layout: 'two-column' })
    expect(useResumeEditorStore.getState().meta.layout).toBe('single-column')
  })

  it('switching to minimal and two-column in the same patch resolves to single-column', () => {
    useResumeEditorStore.getState().setMeta({ templateId: 'minimal', layout: 'two-column' })
    expect(useResumeEditorStore.getState().meta.layout).toBe('single-column')
  })

  it('other templates can still switch to two-column', () => {
    useResumeEditorStore.getState().setMeta({ layout: 'two-column' })
    expect(useResumeEditorStore.getState().meta.layout).toBe('two-column')
  })
})
