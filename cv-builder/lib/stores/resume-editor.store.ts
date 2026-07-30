// lib/stores/resume-editor.store.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { ResumeData, ResumeMeta, CustomSection } from '@/lib/schemas/resume.zod'

export interface ResumeEditorStore {
  resumeId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  _history: Array<{ title: string; data: ResumeData; meta: ResumeMeta }>
  _future:  Array<{ title: string; data: ResumeData; meta: ResumeMeta }>
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  setTitle: (title: string) => void
  setData: (patch: Partial<ResumeData>) => void
  setMeta: (patch: Partial<ResumeMeta>) => void
  setSectionData: <K extends keyof ResumeData>(section: K, value: ResumeData[K]) => void
  addCustomSection: (section: CustomSection) => void
  updateCustomSection: (id: string, patch: Partial<CustomSection>) => void
  removeCustomSection: (id: string) => void
  removeBuiltInSection: (section: Exclude<keyof ResumeData, 'basics' | 'customSections' | 'coverLetter'>) => void
  hydrate: (resumeId: string, title: string, data: ResumeData, meta: ResumeMeta) => void
  _setIsSaving: (v: boolean) => void
  _setIsDirty: (v: boolean) => void
  _setSaveError: (v: string | null) => void
}

const MAX_HISTORY = 50
// Edits closer together than this are treated as one action (e.g. a typing
// burst), so undo works at word granularity instead of per keystroke.
const HISTORY_COALESCE_MS = 500

let _lastPushAt = 0

function pushHistory(
  s: ResumeEditorStore
): Pick<ResumeEditorStore, '_history' | '_future' | 'canUndo' | 'canRedo'> {
  const now = Date.now()
  const coalesce = s._history.length > 0 && now - _lastPushAt < HISTORY_COALESCE_MS
  _lastPushAt = now
  if (coalesce) {
    return { _history: s._history, _future: [], canUndo: true, canRedo: false }
  }
  const entry = { title: s.title, data: s.data, meta: s.meta }
  const history = [...s._history, entry]
  if (history.length > MAX_HISTORY) history.shift()
  return { _history: history, _future: [], canUndo: true, canRedo: false }
}

export const useResumeEditorStore = create<ResumeEditorStore>()(
  subscribeWithSelector((set) => ({
    resumeId: '',
    title: '',
    data: {},
    meta: {
      templateId: 'classic',
      fontFamily: 'Calibri',
      headerFontFamily: 'Calibri',
      primaryColor: '#000000',
      accentColor: '#0066cc',
      pageMargins: 1.0,
      lineSpacing: 1.15,
      sectionOrder: [
        'work',
        'education',
        'skills',
        'certificates',
        'awards',
        'publications',
        'volunteer',
        'languages',
        'interests',
        'projects',
      ],
      layout: 'single-column',
      columnAssignment: {},
      excludedAtsKeywords: [],
    },
    isDirty: false,
    isSaving: false,
    saveError: null,
    _history: [],
    _future: [],
    canUndo: false,
    canRedo: false,
    undo: () =>
      set((s) => {
        if (s._history.length === 0) return {}
        _lastPushAt = 0 // next edit starts a fresh history entry
        const history = [...s._history]
        const prev = history.pop()!
        const future = [{ title: s.title, data: s.data, meta: s.meta }, ...s._future]
        return {
          title: prev.title,
          data: prev.data,
          meta: prev.meta,
          _history: history,
          _future: future,
          canUndo: history.length > 0,
          canRedo: true,
          isDirty: true,
        }
      }),
    redo: () =>
      set((s) => {
        if (s._future.length === 0) return {}
        _lastPushAt = 0 // next edit starts a fresh history entry
        const future = [...s._future]
        const next = future.shift()!
        const history = [...s._history, { title: s.title, data: s.data, meta: s.meta }]
        if (history.length > MAX_HISTORY) history.shift()
        return {
          title: next.title,
          data: next.data,
          meta: next.meta,
          _history: history,
          _future: future,
          canUndo: true,
          canRedo: future.length > 0,
          isDirty: true,
        }
      }),
    setTitle: (title) =>
      set((s) => ({ ...pushHistory(s), title, isDirty: true })),
    setData: (patch) =>
      set((s) => ({ ...pushHistory(s), data: { ...s.data, ...patch }, isDirty: true })),
    setMeta: (patch) =>
      set((s) => {
        const merged: ResumeMeta = { ...s.meta, ...patch }
        if (patch.pageMargins !== undefined)
          merged.pageMargins = Math.max(0.5, Math.min(1.5, patch.pageMargins))
        if (patch.lineSpacing !== undefined)
          merged.lineSpacing = Math.max(1.0, Math.min(1.15, patch.lineSpacing))
        // Minimal is a single-column-only template — switching to it (or setting
        // two-column while on it) always resolves to single-column.
        if (merged.templateId === 'minimal')
          merged.layout = 'single-column'
        return { ...pushHistory(s), meta: merged, isDirty: true }
      }),
    setSectionData: (section, value) =>
      set((s) => ({ ...pushHistory(s), data: { ...s.data, [section]: value }, isDirty: true })),
    addCustomSection: (section) =>
      set((s) => ({
        ...pushHistory(s),
        data: { ...s.data, customSections: [...(s.data.customSections ?? []), section] },
        meta: { ...s.meta, sectionOrder: [...s.meta.sectionOrder, `custom:${section.id}`] },
        isDirty: true,
      })),
    updateCustomSection: (id, patch) =>
      set((s) => ({
        ...pushHistory(s),
        data: {
          ...s.data,
          customSections: (s.data.customSections ?? []).map((cs) =>
            cs.id === id ? { ...cs, ...patch } : cs
          ),
        },
        isDirty: true,
      })),
    removeCustomSection: (id) =>
      set((s) => ({
        ...pushHistory(s),
        data: {
          ...s.data,
          customSections: (s.data.customSections ?? []).filter((cs) => cs.id !== id),
        },
        meta: {
          ...s.meta,
          sectionOrder: s.meta.sectionOrder.filter((k) => k !== `custom:${id}`),
        },
        isDirty: true,
      })),
    removeBuiltInSection: (section) =>
      set((s) => {
        const clearedData: Partial<ResumeData> = { [section]: [] }
        return {
          ...pushHistory(s),
          data: { ...s.data, ...clearedData },
          meta: {
            ...s.meta,
            sectionOrder: s.meta.sectionOrder.filter((k) => k !== section),
          },
          isDirty: true,
        }
      }),
    hydrate: (resumeId, title, data, meta) => {
      _lastPushAt = 0
      set({ resumeId, title, data, meta, isDirty: false, saveError: null, _history: [], _future: [], canUndo: false, canRedo: false })
    },
    _setIsSaving: (isSaving) => set({ isSaving }),
    _setIsDirty: (isDirty) => set({ isDirty }),
    _setSaveError: (saveError) => set({ saveError }),
  }))
)

let _saveTimer: ReturnType<typeof setTimeout> | null = null
let _retryTimer: ReturnType<typeof setTimeout> | null = null
let _retryCount = 0
const MAX_RETRIES = 3
const RETRY_DELAYS = [3000, 6000, 12000] // exponential backoff

export function initAutoSave(): () => void {
  _retryCount = 0
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null }
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null }
  const unsubscribe = useResumeEditorStore.subscribe(
    (s) => s.isDirty,
    (isDirty) => {
      if (!isDirty) return
      if (_saveTimer) clearTimeout(_saveTimer)
      _saveTimer = setTimeout(performSave, 1000)
    }
  )
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (useResumeEditorStore.getState().isDirty) {
      e.preventDefault()
      e.returnValue = ''
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload)
  }
  return () => {
    unsubscribe()
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
    if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null }
    if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null }
  }
}

async function performSave(): Promise<void> {
  const { resumeId, title, data, meta, _setIsSaving, _setIsDirty, _setSaveError } =
    useResumeEditorStore.getState()
  if (!resumeId) return
  _setIsSaving(true)
  try {
    const res = await fetch(`/api/resumes/${resumeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, data, meta }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const detail = body?.code ?? `HTTP ${res.status}`
      throw new Error(detail, { cause: { status: res.status, body } })
    }
    // Only mark clean if nothing changed while the request was in flight;
    // otherwise those edits would be silently dropped until the next keystroke.
    const current = useResumeEditorStore.getState()
    if (current.title === title && current.data === data && current.meta === meta) {
      _setIsDirty(false)
    } else {
      if (_saveTimer) clearTimeout(_saveTimer)
      _saveTimer = setTimeout(performSave, 1000)
    }
    _setSaveError(null)
    _retryCount = 0
  } catch (err) {
    const cause = (err as { cause?: { status?: number; body?: { code?: string; details?: unknown } } }).cause
    const status = cause?.status
    // Validation errors won't resolve on retry — surface them immediately with details.
    if (status === 400) {
      const details = cause?.body?.details
      console.error('[AutoSave] Validation error — save aborted:', details ?? cause?.body)
      _retryCount = 0
      _setSaveError("Couldn't save — some fields have invalid values. Check URLs and email addresses.")
      return
    }
    if (status === 401) {
      console.error('[AutoSave] Session expired')
      _retryCount = 0
      _setSaveError("Couldn't save — your session has expired. Please refresh the page.")
      return
    }
    if (_retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[_retryCount] ?? 12000
      _retryCount++
      console.warn(`[AutoSave] Save failed (attempt ${_retryCount}/${MAX_RETRIES}), retrying in ${delay / 1000}s…`, err)
      _setSaveError(`Couldn't save — retrying… (attempt ${_retryCount}/${MAX_RETRIES})`)
      _retryTimer = setTimeout(performSave, delay)
    } else {
      console.error('[AutoSave] All retries exhausted:', err)
      _retryCount = 0
      _setSaveError("Couldn't save after several attempts — please check your connection and try again.")
    }
  } finally {
    _setIsSaving(false)
  }
}
