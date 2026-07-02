// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { useResumeEditorStore, initAutoSave } from '../resume-editor.store'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const emptyData: ResumeData = {}
const defaultMeta: ResumeMeta = {
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0,
  lineSpacing: 1.15,
  sectionOrder: ['work'],
  layout: 'single-column',
  columnAssignment: {},
}

function fireBeforeUnload(): Event {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('beforeunload guard', () => {
  let unsub: (() => void) | null = null

  afterEach(() => {
    unsub?.()
    unsub = null
  })

  it('blocks unload while there are unsaved changes', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    unsub = initAutoSave()
    useResumeEditorStore.getState().setTitle('Unsaved edit')
    const event = fireBeforeUnload()
    expect(event.defaultPrevented).toBe(true)
  })

  it('does not block unload when everything is saved', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    unsub = initAutoSave()
    const event = fireBeforeUnload()
    expect(event.defaultPrevented).toBe(false)
  })

  it('removes the listener on cleanup', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    unsub = initAutoSave()
    useResumeEditorStore.getState().setTitle('Unsaved edit')
    unsub()
    unsub = null
    const event = fireBeforeUnload()
    expect(event.defaultPrevented).toBe(false)
  })
})
