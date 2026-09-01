'use client'

// Debounced ground-truth pagination: after the user stops editing, POST the
// current editor state to the pagination endpoint (which renders the real
// export PDF server-side) and report the true page count + page-start
// anchors. Never fires on a keystroke — the debounce guarantees at most one
// render per pause, per the project rule against per-keystroke PDF renders.
//
// `data`/`meta` are debounced *before* serialization (not just before the
// fetch): the editor store hands this hook a new object reference on every
// keystroke, and serializing the full résumé tree on each one is wasted
// work when only the value settled at the end of a pause is ever sent.
import { useEffect, useMemo, useRef, useState } from 'react'
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
  const debouncedData = useDebounce(data, delay)
  const debouncedMeta = useDebounce(meta, delay)
  const payload = useMemo(
    () => JSON.stringify({ data: debouncedData, meta: debouncedMeta }),
    [debouncedData, debouncedMeta]
  )
  const [state, setState] = useState<PdfPaginationState>({
    status: 'syncing',
    pageCount: null,
    anchors: [],
  })
  const isFirstRender = useRef(true)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, status: 'syncing' }))

    const doFetch = () => {
      if (cancelled) return
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
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    if (isFirstRender.current) {
      isFirstRender.current = false
      timer = setTimeout(doFetch, delay)
    } else {
      doFetch()
    }

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      controller.abort()
    }
  }, [payload, delay])

  // Editor state newer than the debounced value that produced `payload` →
  // anchors are stale (reference inequality is enough: the store hands out
  // a fresh object on every mutation).
  const isStale = data !== debouncedData || meta !== debouncedMeta
  if (isStale && state.status === 'synced') {
    return { ...state, status: 'syncing' }
  }
  return state
}
