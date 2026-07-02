// lib/stores/__tests__/resume-editor.store.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useResumeEditorStore, initAutoSave } from '../resume-editor.store'
import type { ResumeData, ResumeMeta, CustomSection } from '@/lib/schemas/resume.zod'

const emptyData: ResumeData = {}
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
    resumeId: '', title: '', data: emptyData, meta: defaultMeta,
    isDirty: false, isSaving: false, saveError: null,
    _history: [], _future: [], canUndo: false, canRedo: false,
  })
})

describe('hydrate', () => {
  it('populates store and clears isDirty', () => {
    useResumeEditorStore.getState().hydrate('r1', 'My CV', emptyData, defaultMeta)
    const s = useResumeEditorStore.getState()
    expect(s.resumeId).toBe('r1')
    expect(s.title).toBe('My CV')
    expect(s.isDirty).toBe(false)
    expect(s.saveError).toBeNull()
  })
})

describe('setTitle', () => {
  it('updates title and marks isDirty', () => {
    useResumeEditorStore.getState().hydrate('r1', 'My CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setTitle('Updated')
    expect(useResumeEditorStore.getState().title).toBe('Updated')
    expect(useResumeEditorStore.getState().isDirty).toBe(true)
  })
})

describe('setSectionData', () => {
  it('updates work and marks isDirty', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    const work = [{ name: 'Acme', position: 'Engineer', startDate: '2020-01' }]
    useResumeEditorStore.getState().setSectionData('work', work)
    expect(useResumeEditorStore.getState().data.work).toEqual(work)
    expect(useResumeEditorStore.getState().isDirty).toBe(true)
  })

  it('preserves other sections when updating one', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', { basics: { name: 'Jane' } }, defaultMeta)
    useResumeEditorStore.getState().setSectionData('work', [{ name: 'Acme' }])
    expect(useResumeEditorStore.getState().data.basics?.name).toBe('Jane')
  })
})

describe('setMeta', () => {
  it('merges patch without overwriting other fields', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setMeta({ fontFamily: 'Arial' })
    expect(useResumeEditorStore.getState().meta.fontFamily).toBe('Arial')
    expect(useResumeEditorStore.getState().meta.headerFontFamily).toBe('Calibri')
    expect(useResumeEditorStore.getState().isDirty).toBe(true)
  })

  it('clamps pageMargins to minimum 0.5', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setMeta({ pageMargins: 0.2 })
    expect(useResumeEditorStore.getState().meta.pageMargins).toBe(0.5)
  })

  it('clamps pageMargins to maximum 1.5', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setMeta({ pageMargins: 2.0 })
    expect(useResumeEditorStore.getState().meta.pageMargins).toBe(1.5)
  })

  it('clamps lineSpacing to minimum 1.0', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setMeta({ lineSpacing: 0.5 })
    expect(useResumeEditorStore.getState().meta.lineSpacing).toBe(1.0)
  })

  it('clamps lineSpacing to maximum 1.15', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setMeta({ lineSpacing: 2.0 })
    expect(useResumeEditorStore.getState().meta.lineSpacing).toBe(1.15)
  })
})

const sampleSection: CustomSection = {
  id: 'sec1',
  name: 'My Publications',
  enabledFields: ['subtitle', 'dateRange'],
  items: [],
}

describe('addCustomSection', () => {
  it('appends section to data.customSections and adds custom:id to sectionOrder', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', {}, defaultMeta)
    useResumeEditorStore.getState().addCustomSection(sampleSection)
    const s = useResumeEditorStore.getState()
    expect(s.data.customSections).toEqual([sampleSection])
    expect(s.meta.sectionOrder).toContain('custom:sec1')
    expect(s.isDirty).toBe(true)
  })

  it('appends multiple sections independently', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', {}, defaultMeta)
    useResumeEditorStore.getState().addCustomSection(sampleSection)
    useResumeEditorStore.getState().addCustomSection({ ...sampleSection, id: 'sec2', name: 'Awards' })
    const s = useResumeEditorStore.getState()
    expect(s.data.customSections).toHaveLength(2)
    expect(s.meta.sectionOrder).toContain('custom:sec1')
    expect(s.meta.sectionOrder).toContain('custom:sec2')
  })
})

describe('updateCustomSection', () => {
  it('patches name without affecting other sections or sectionOrder', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', { customSections: [sampleSection] }, {
      ...defaultMeta,
      sectionOrder: [...defaultMeta.sectionOrder, 'custom:sec1'],
    })
    useResumeEditorStore.getState().updateCustomSection('sec1', { name: 'Renamed' })
    const s = useResumeEditorStore.getState()
    expect(s.data.customSections?.[0].name).toBe('Renamed')
    expect(s.meta.sectionOrder).toContain('custom:sec1')
    expect(s.isDirty).toBe(true)
  })

  it('patches enabledFields without losing items', () => {
    const withItem: CustomSection = {
      ...sampleSection,
      items: [{ id: 'i1', title: 'Paper' }],
    }
    useResumeEditorStore.getState().hydrate('r1', 'CV', { customSections: [withItem] }, defaultMeta)
    useResumeEditorStore.getState().updateCustomSection('sec1', { enabledFields: ['summary', 'keywords'] })
    const s = useResumeEditorStore.getState()
    expect(s.data.customSections?.[0].enabledFields).toEqual(['summary', 'keywords'])
    expect(s.data.customSections?.[0].items).toEqual([{ id: 'i1', title: 'Paper' }])
  })
})

describe('removeCustomSection', () => {
  it('removes section from data and removes key from sectionOrder', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', { customSections: [sampleSection] }, {
      ...defaultMeta,
      sectionOrder: [...defaultMeta.sectionOrder, 'custom:sec1'],
    })
    useResumeEditorStore.getState().removeCustomSection('sec1')
    const s = useResumeEditorStore.getState()
    expect(s.data.customSections).toEqual([])
    expect(s.meta.sectionOrder).not.toContain('custom:sec1')
    expect(s.isDirty).toBe(true)
  })

  it('removing one section does not affect other custom sections', () => {
    const sec2: CustomSection = { ...sampleSection, id: 'sec2', name: 'Other' }
    useResumeEditorStore.getState().hydrate('r1', 'CV',
      { customSections: [sampleSection, sec2] },
      { ...defaultMeta, sectionOrder: [...defaultMeta.sectionOrder, 'custom:sec1', 'custom:sec2'] }
    )
    useResumeEditorStore.getState().removeCustomSection('sec1')
    const s = useResumeEditorStore.getState()
    expect(s.data.customSections).toHaveLength(1)
    expect(s.data.customSections?.[0].id).toBe('sec2')
    expect(s.meta.sectionOrder).toContain('custom:sec2')
  })
})

describe('undo/redo', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('canUndo is false initially', () => {
    const s = useResumeEditorStore.getState()
    expect(s.canUndo).toBe(false)
    expect(s.canRedo).toBe(false)
  })

  it('setTitle makes canUndo true', () => {
    useResumeEditorStore.getState().setTitle('test')
    expect(useResumeEditorStore.getState().canUndo).toBe(true)
  })

  it('undo restores previous title', () => {
    useResumeEditorStore.getState().setTitle('A')
    vi.advanceTimersByTime(600)
    useResumeEditorStore.getState().setTitle('B')
    useResumeEditorStore.getState().undo()
    const s = useResumeEditorStore.getState()
    expect(s.title).toBe('A')
    expect(s.canRedo).toBe(true)
  })

  it('redo re-applies change', () => {
    useResumeEditorStore.getState().setTitle('A')
    vi.advanceTimersByTime(600)
    useResumeEditorStore.getState().setTitle('B')
    useResumeEditorStore.getState().undo()
    useResumeEditorStore.getState().redo()
    const s = useResumeEditorStore.getState()
    expect(s.title).toBe('B')
    expect(s.canRedo).toBe(false)
  })

  it('undo is no-op when stack empty', () => {
    const before = useResumeEditorStore.getState()
    expect(() => useResumeEditorStore.getState().undo()).not.toThrow()
    const after = useResumeEditorStore.getState()
    expect(after.canUndo).toBe(false)
    expect(after.canRedo).toBe(false)
    expect(after.title).toBe(before.title)
  })

  it('history capped at 50', () => {
    for (let i = 0; i < 51; i++) {
      vi.advanceTimersByTime(600)
      useResumeEditorStore.getState().setTitle(`title-${i}`)
    }
    expect(useResumeEditorStore.getState()._history.length).toBe(50)
  })

  it('coalesces rapid edits into a single history entry', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setTitle('A')
    useResumeEditorStore.getState().setTitle('AB')
    useResumeEditorStore.getState().setTitle('ABC')
    expect(useResumeEditorStore.getState()._history.length).toBe(1)
    useResumeEditorStore.getState().undo()
    expect(useResumeEditorStore.getState().title).toBe('CV')
  })

  it('starts a new history entry after a 500ms pause', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setTitle('A')
    vi.advanceTimersByTime(600)
    useResumeEditorStore.getState().setTitle('B')
    expect(useResumeEditorStore.getState()._history.length).toBe(2)
    useResumeEditorStore.getState().undo()
    expect(useResumeEditorStore.getState().title).toBe('A')
  })

  it('edits right after undo push history instead of coalescing', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setTitle('A')
    useResumeEditorStore.getState().undo()
    useResumeEditorStore.getState().setTitle('B')
    expect(useResumeEditorStore.getState().canUndo).toBe(true)
    useResumeEditorStore.getState().undo()
    expect(useResumeEditorStore.getState().title).toBe('CV')
  })

  it('hydrate clears history', () => {
    useResumeEditorStore.getState().setTitle('before-hydrate')
    useResumeEditorStore.getState().hydrate('r1', 'Fresh', emptyData, defaultMeta)
    const s = useResumeEditorStore.getState()
    expect(s._history.length).toBe(0)
    expect(s.canUndo).toBe(false)
  })
})

describe('initAutoSave', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('calls PATCH after 1000 ms when isDirty becomes true', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 })
    )
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    const unsub = initAutoSave()
    useResumeEditorStore.getState().setTitle('New Title')
    await vi.runAllTimersAsync()
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/resumes/r1',
      expect.objectContaining({ method: 'PATCH' })
    )
    expect(useResumeEditorStore.getState().isDirty).toBe(false)
    unsub()
    fetchSpy.mockRestore()
  })

  it('shows retrying message during retries and final error after all retries exhausted', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    const unsub = initAutoSave()
    useResumeEditorStore.getState().setTitle('New Title')
    // Fire debounce → first save attempt fails → retrying message set
    await vi.advanceTimersByTimeAsync(1000)
    expect(useResumeEditorStore.getState().saveError).toContain('retrying')
    // Fire all remaining retry timers → all exhausted → final error message
    await vi.runAllTimersAsync()
    expect(useResumeEditorStore.getState().saveError).toContain("several attempts")
    unsub()
    fetchSpy.mockRestore()
  })

  it('clears saveError and marks clean on successful save after retry', async () => {
    let callCount = 0
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++
      if (callCount < 2) throw new Error('network')
      return new Response('{}', { status: 200 })
    })
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    const unsub = initAutoSave()
    useResumeEditorStore.getState().setTitle('New Title')
    await vi.runAllTimersAsync()
    expect(useResumeEditorStore.getState().saveError).toBeNull()
    expect(useResumeEditorStore.getState().isDirty).toBe(false)
    unsub()
    fetchSpy.mockRestore()
  })

  it('persists edits made while a save is in flight instead of marking them clean', async () => {
    let resolveFirst!: (r: Response) => void
    let call = 0
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      call++
      if (call === 1) return new Promise<Response>((res) => { resolveFirst = res })
      return Promise.resolve(new Response('{}', { status: 200 }))
    })
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    const unsub = initAutoSave()

    useResumeEditorStore.getState().setTitle('First')
    await vi.advanceTimersByTimeAsync(1000) // debounce fires; first save now in flight

    useResumeEditorStore.getState().setTitle('Second') // edit lands mid-save
    resolveFirst(new Response('{}', { status: 200 }))
    await vi.runAllTimersAsync()

    const lastBody = JSON.parse(fetchSpy.mock.calls.at(-1)![1]!.body as string)
    expect(lastBody.title).toBe('Second')
    expect(useResumeEditorStore.getState().isDirty).toBe(false)
    unsub()
    fetchSpy.mockRestore()
  })

  it('shows validation error immediately without retrying on HTTP 400', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'VALIDATION_ERROR', details: [] }), { status: 400 })
    )
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    const unsub = initAutoSave()
    useResumeEditorStore.getState().setTitle('New Title')
    await vi.runAllTimersAsync()
    expect(fetchSpy).toHaveBeenCalledTimes(1) // no retries
    expect(useResumeEditorStore.getState().saveError).toContain('invalid values')
    unsub()
    fetchSpy.mockRestore()
  })
})
