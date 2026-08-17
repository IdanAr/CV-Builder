import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useResumeEditorStore, flushSave } from './resume-editor.store'
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
  excludedAtsKeywords: [],
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

describe('flushSave', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PATCHes the current state immediately, without waiting for the debounce, when isDirty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resume: {} }),
    })
    vi.stubGlobal('fetch', fetchMock)

    useResumeEditorStore.setState({
      meta: { ...defaultMeta, sidebarRailWidth: 20 },
      isDirty: true,
    })

    await flushSave()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/resumes/r1')
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(init.body)
    expect(body.meta.sidebarRailWidth).toBe(20)
    expect(useResumeEditorStore.getState().isDirty).toBe(false)
  })

  it('does nothing when the store is already clean', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    useResumeEditorStore.setState({ isDirty: false })

    await flushSave()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('removeBuiltInSection', () => {
  it('removes the section from sectionOrder and clears its data', () => {
    useResumeEditorStore.getState().hydrate(
      'r1',
      'CV',
      { work: [{ name: 'Acme' }], education: [{ institution: 'MIT' }] },
      { ...defaultMeta, sectionOrder: ['work', 'education', 'skills'] },
    )
    useResumeEditorStore.getState().removeBuiltInSection('work')
    const { data, meta, isDirty } = useResumeEditorStore.getState()
    expect(meta.sectionOrder).toEqual(['education', 'skills'])
    expect(data.work).toEqual([])
    expect(data.education).toEqual([{ institution: 'MIT' }])
    expect(isDirty).toBe(true)
  })

  it('is undoable in a single step', () => {
    useResumeEditorStore.getState().hydrate(
      'r1',
      'CV',
      { work: [{ name: 'Acme' }] },
      { ...defaultMeta, sectionOrder: ['work', 'education'] },
    )
    useResumeEditorStore.getState().removeBuiltInSection('work')
    useResumeEditorStore.getState().undo()
    const { data, meta } = useResumeEditorStore.getState()
    expect(meta.sectionOrder).toEqual(['work', 'education'])
    expect(data.work).toEqual([{ name: 'Acme' }])
  })
})
