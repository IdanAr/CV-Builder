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
  setTitle: (title: string) => void
  setData: (patch: Partial<ResumeData>) => void
  setMeta: (patch: Partial<ResumeMeta>) => void
  setSectionData: <K extends keyof ResumeData>(section: K, value: ResumeData[K]) => void
  addCustomSection: (section: CustomSection) => void
  updateCustomSection: (id: string, patch: Partial<CustomSection>) => void
  removeCustomSection: (id: string) => void
  hydrate: (resumeId: string, title: string, data: ResumeData, meta: ResumeMeta) => void
  _setIsSaving: (v: boolean) => void
  _setIsDirty: (v: boolean) => void
  _setSaveError: (v: string | null) => void
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
      sectionOrder: ['work', 'education', 'skills', 'volunteer', 'languages'],
      layout: 'single-column',
    },
    isDirty: false,
    isSaving: false,
    saveError: null,
    setTitle: (title) => set({ title, isDirty: true }),
    setData: (patch) => set((s) => ({ data: { ...s.data, ...patch }, isDirty: true })),
    setMeta: (patch) =>
      set((s) => {
        const merged: ResumeMeta = { ...s.meta, ...patch }
        if (patch.pageMargins !== undefined)
          merged.pageMargins = Math.max(0.5, Math.min(1.5, patch.pageMargins))
        if (patch.lineSpacing !== undefined)
          merged.lineSpacing = Math.max(1.0, Math.min(1.15, patch.lineSpacing))
        return { meta: merged, isDirty: true }
      }),
    setSectionData: (section, value) =>
      set((s) => ({ data: { ...s.data, [section]: value }, isDirty: true })),
    addCustomSection: (section) =>
      set((s) => ({
        data: { ...s.data, customSections: [...(s.data.customSections ?? []), section] },
        meta: { ...s.meta, sectionOrder: [...s.meta.sectionOrder, `custom:${section.id}`] },
        isDirty: true,
      })),
    updateCustomSection: (id, patch) =>
      set((s) => ({
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
    hydrate: (resumeId, title, data, meta) =>
      set({ resumeId, title, data, meta, isDirty: false, saveError: null }),
    _setIsSaving: (isSaving) => set({ isSaving }),
    _setIsDirty: (isDirty) => set({ isDirty }),
    _setSaveError: (saveError) => set({ saveError }),
  }))
)

let _saveTimer: ReturnType<typeof setTimeout> | null = null
let _retryCount = 0

export function initAutoSave(): () => void {
  _retryCount = 0
  if (_saveTimer) {
    clearTimeout(_saveTimer)
    _saveTimer = null
  }
  return useResumeEditorStore.subscribe(
    (s) => s.isDirty,
    (isDirty) => {
      if (!isDirty) return
      if (_saveTimer) clearTimeout(_saveTimer)
      _saveTimer = setTimeout(performSave, 1000)
    }
  )
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    _setIsDirty(false)
    _setSaveError(null)
    _retryCount = 0
  } catch {
    if (_retryCount < 1) {
      _retryCount++
      _setSaveError("Changes couldn't be saved — retrying…")
      setTimeout(performSave, 3000)
    } else {
      _retryCount = 0
      _setSaveError("Changes couldn't be saved — retrying failed. Please check your connection.")
    }
  } finally {
    _setIsSaving(false)
  }
}
