import { describe, it, expect, beforeEach } from 'vitest'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { getSectionItems, setSectionItems } from './section-items'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc', pageMargins: 1.0, lineSpacing: 1.15,
  sectionOrder: ['work'], layout: 'single-column', columnAssignment: {}, excludedAtsKeywords: [],
}

describe('getSectionItems', () => {
  it('reads a built-in section array', () => {
    const data: ResumeData = { work: [{ name: 'Acme' }] }
    expect(getSectionItems(data, 'work')).toEqual([{ name: 'Acme' }])
  })

  it('returns an empty array for a missing built-in section', () => {
    expect(getSectionItems({}, 'work')).toEqual([])
  })

  it('reads a custom section by id', () => {
    const data: ResumeData = {
      customSections: [{ id: 'abc', name: 'Custom', enabledFields: [], items: [{ id: 'i1', title: 'X' }] }],
    }
    expect(getSectionItems(data, 'custom:abc')).toEqual([{ id: 'i1', title: 'X' }])
  })

  it('returns an empty array for an unknown custom section id', () => {
    const data: ResumeData = { customSections: [] }
    expect(getSectionItems(data, 'custom:missing')).toEqual([])
  })
})

describe('setSectionItems', () => {
  beforeEach(() => {
    useResumeEditorStore.setState({
      resumeId: 'r1', title: 'CV',
      data: { work: [{ name: 'Old' }], customSections: [{ id: 'abc', name: 'Custom', enabledFields: [], items: [] }] },
      meta: defaultMeta, isDirty: false, isSaving: false, saveError: null,
      _history: [], _future: [], canUndo: false, canRedo: false,
    })
  })

  it('writes a built-in section array via setSectionData', () => {
    setSectionItems('work', [{ name: 'New' }])
    expect(useResumeEditorStore.getState().data.work).toEqual([{ name: 'New' }])
    expect(useResumeEditorStore.getState().isDirty).toBe(true)
  })

  it('writes a custom section\'s items via updateCustomSection', () => {
    setSectionItems('custom:abc', [{ id: 'i1', title: 'New item' }])
    const cs = useResumeEditorStore.getState().data.customSections?.find((c) => c.id === 'abc')
    expect(cs?.items).toEqual([{ id: 'i1', title: 'New item' }])
  })
})
