import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export function getSectionItems(data: ResumeData, sectionKey: string): unknown[] {
  if (sectionKey.startsWith('custom:')) {
    const id = sectionKey.slice(7)
    return data.customSections?.find((cs) => cs.id === id)?.items ?? []
  }
  const arr = (data as Record<string, unknown>)[sectionKey]
  return Array.isArray(arr) ? arr : []
}

export function setSectionItems(sectionKey: string, items: unknown[]): void {
  const store = useResumeEditorStore.getState()
  if (sectionKey.startsWith('custom:')) {
    const id = sectionKey.slice(7)
    // CustomSection['items'] elements are CustomSectionItem; callers of this
    // function only ever pass back items read from getSectionItems for the
    // same section, so the shape is preserved — a same-file escape hatch,
    // not a public contract.
    store.updateCustomSection(id, { items: items as Parameters<typeof store.updateCustomSection>[1]['items'] })
    return
  }
  store.setSectionData(sectionKey as keyof ResumeData, items as never)
}
