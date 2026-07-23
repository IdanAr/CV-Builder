'use client'

// Debounced ground-truth pagination: after the user stops editing, POST the
// current editor state to the pagination endpoint (which renders the real
// export PDF server-side) and report the true page count + page-start
// anchors. Never fires on a keystroke — the debounce guarantees at most one
// render per pause, per the project rule against per-keystroke PDF renders.
import { useEffect, useMemo, useState } from 'react'
import { useDebounce } from '@/lib/hooks/use-debounce'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export type PaginationStatus = 'syncing' | 'synced' | 'error'

export interface PdfPaginationState {
  status: PaginationStatus
  pageCount: number | null
  anchors: string[]
}

const DEFAULT_DELAY_MS = 1200

export function usePdfPagination(
  data: ResumeData,
  meta: ResumeMeta,
  delay: number = DEFAULT_DELAY_MS
): PdfPaginationState {
  const payload = useMemo(() => JSON.stringify({ data, meta }), [data, meta])
  const debouncedPayload = useDebounce(payload, delay)
  const [state, setState] = useState<PdfPaginationState>({
    status: 'syncing',
    pageCount: null,
    anchors: [],
  })

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, status: 'syncing' }))

    // Note: useDebounce's own initial state mirrors the input value
    // synchronously on mount (no artificial delay for the first render), so
    // we cannot key the fetch trigger off its output directly — that would
    // fire a request at t=0 instead of after `delay`. We debounce the actual
    // network call ourselves here; `debouncedPayload` below is used only to
    // detect staleness for the UI.
    const timer = setTimeout(() => {
      fetch('/api/preview/pagination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`pagination request failed: ${res.status}`)
          const json = (await res.json()) as { pageCount: number; anchors: string[] }
          if (!cancelled) setState({ status: 'synced', pageCount: json.pageCount, anchors: json.anchors })
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return
          if (!cancelled) setState((s) => ({ ...s, status: 'error' }))
        })
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [payload, delay])

  // Editor state newer than the last response → anchors are stale.
  const isStale = payload !== debouncedPayload
  if (isStale && state.status === 'synced') {
    return { ...state, status: 'syncing' }
  }
  return state
}
