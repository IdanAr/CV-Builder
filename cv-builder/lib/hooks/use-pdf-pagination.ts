'use client'

// Debounced ground-truth pagination: after the user stops editing, POST the
// current editor state to the pagination endpoint (which renders the real
// export PDF server-side) and report the true page count + page-start
// anchors. Never fires on a keystroke — the debounce guarantees at most one
// render per pause, per the project rule against per-keystroke PDF renders.
//
// The résumé tree is only ever serialized inside the debounce timer's own
// callback (once, when it actually fires) — not eagerly on every render.
// The editor store hands this hook a new `data`/`meta` reference on every
// keystroke, and JSON.stringify-ing the full tree on each one is wasted
// work when only the value settled at the end of a pause is ever sent.
import { useEffect, useState } from 'react'
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
  // Used only to detect staleness for the UI below — not to trigger the
  // fetch (the effect's own setTimeout/cleanup below handles that debounce).
  const debouncedData = useDebounce(data, delay)
  const debouncedMeta = useDebounce(meta, delay)
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

    // Debounce-via-effect-reset: this effect re-runs (cancelling the prior
    // timer via cleanup) on every `data`/`meta` change, i.e. every
    // keystroke — so only the LAST keystroke's timer ever survives long
    // enough to fire. The tree is serialized here, lazily, only once the
    // timer actually elapses.
    const timer = setTimeout(() => {
      const payload = JSON.stringify({ data, meta })
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
  }, [data, meta, delay])

  // Editor state newer than the debounced snapshot → anchors are stale
  // (reference inequality is enough: the store hands out a fresh object on
  // every mutation).
  const isStale = data !== debouncedData || meta !== debouncedMeta
  if (isStale && state.status === 'synced') {
    return { ...state, status: 'syncing' }
  }
  return state
}
