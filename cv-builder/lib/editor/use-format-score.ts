'use client'

import { useMemo } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { scoreResume } from '@/lib/ats/scorer'

/**
 * ATS "format" sub-score (0-100) of the résumé in the editor store — the same
 * number the CV library's "ATS format" column shows. Debounced so typing does
 * not re-score on every keystroke; depends on `data` only, so design (`meta`)
 * changes never trigger a recompute.
 */
export function useFormatScore(): number {
  const data = useResumeEditorStore((s) => s.data)
  const debouncedData = useDebounce(data, 300)
  return useMemo(() => scoreResume(debouncedData, '').breakdown.format, [debouncedData])
}
