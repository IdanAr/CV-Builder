'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useScrapedJobsSync, notifyScrapedJobsChanged } from '@/lib/stores/scraped-jobs.store'
import type { PipelineCountsDto, PipelineJob, PipelinePageDto } from '@/lib/jobsearch/pipeline-types'
import type { PipelineView } from '@/lib/jobsearch/pipeline-url'

type ViewKey = Pick<PipelineView, 'stage' | 'profile' | 'q'>

export interface PipelineInitial {
  view: ViewKey
  items: PipelineJob[]
  nextCursor: string | null
  counts: PipelineCountsDto
}

export interface UsePipelineJobs {
  items: PipelineJob[]
  counts: PipelineCountsDto | null
  nextCursor: string | null
  status: 'loading' | 'ready' | 'error'
  loadingMore: boolean
  error: string | null
  /** Ids that were unread (status 'new') when this view was opened. */
  unreadIds: ReadonlySet<string>
  loadMore(): Promise<void>
  reload(): Promise<void>
  /** Hides a row at once (optimistic dismiss/delete). */
  removeLocal(id: string): void
}

const LOAD_ERROR = 'Failed to load jobs.'
const EMPTY_SET: ReadonlySet<string> = new Set()

function buildUrl(view: ViewKey, cursor?: string): string {
  const p = new URLSearchParams({ stage: view.stage })
  if (view.profile) p.set('profileId', view.profile)
  if (view.q.trim()) p.set('q', view.q.trim())
  if (cursor) p.set('cursor', cursor)
  return `/api/jobsearch/scraped-jobs?${p.toString()}`
}

const keyOf = (v: ViewKey) => `${v.stage}|${v.profile ?? ''}|${v.q}`

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/**
 * Reads the pipeline inbox for one view: page 1, cursor pagination, a reload
 * whenever any scraped job mutates, and the unread snapshot for the Matched stage.
 */
export function usePipelineJobs(view: ViewKey, initial?: PipelineInitial): UsePipelineJobs {
  const viewKey = keyOf(view)
  const viewRef = useRef<ViewKey>(view)

  const seeded = initial && keyOf(initial.view) === viewKey ? initial : undefined
  const [items, setItems] = useState<PipelineJob[]>(seeded?.items ?? [])
  const [counts, setCounts] = useState<PipelineCountsDto | null>(seeded?.counts ?? null)
  const [nextCursor, setNextCursor] = useState<string | null>(seeded?.nextCursor ?? null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(seeded ? 'ready' : 'loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreadIds, setUnreadIds] = useState<ReadonlySet<string>>(() =>
    seeded && view.stage === 'matched'
      ? new Set(seeded.items.filter((j) => j.status === 'new').map((j) => j._id))
      : EMPTY_SET
  )

  // Mirrors of state the callbacks need without re-creating themselves.
  const itemsRef = useRef(items)
  const cursorRef = useRef(nextCursor)
  const loadingMoreRef = useRef(false)
  // Bumped by every page-1 load, view change and loadMore so out-of-order
  // responses are dropped.
  const requestIdRef = useRef(0)
  // Refreshes (revision reloads) have their own id so they never invalidate a
  // pending view load; a view load does invalidate refreshes.
  const refreshIdRef = useRef(0)
  const viewPendingRef = useRef(false)
  const controllerRef = useRef<AbortController | null>(null)
  // The view whose data `items` currently holds; lets a seeded first render skip the fetch.
  const loadedKeyRef = useRef<string | null>(seeded ? viewKey : null)
  const initialMarkedRef = useRef(false)

  // Declared before the effects below so they always see current values.
  useEffect(() => {
    viewRef.current = view
    itemsRef.current = items
    cursorRef.current = nextCursor
  })

  const invalidateInFlight = useCallback(() => {
    requestIdRef.current++
  }, [])

  const revision = useScrapedJobsSync((state) => state.revision)
  const lastRevisionRef = useRef(revision)

  const markRead = useCallback((profile: string | null) => {
    // Fire-and-forget and deliberately not tied to the abort signal: a real
    // unread count shouldn't be undone because the view changed meanwhile.
    fetch('/api/jobsearch/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile ? { profileId: profile } : {}),
    })
      .then(() => notifyScrapedJobsChanged())
      .catch(() => {})
  }, [])

  /** Page 1. `fromView` is true when the view itself changed (vs. a background refresh). */
  const loadFirstPage = useCallback(
    async (target: ViewKey, fromView: boolean, signal?: AbortSignal) => {
      // A refresh while a view load is pending would only fetch the same page.
      if (!fromView && viewPendingRef.current) return
      const viewId = fromView ? ++requestIdRef.current : requestIdRef.current
      const refreshId = ++refreshIdRef.current
      if (fromView) viewPendingRef.current = true
      const stale = () =>
        requestIdRef.current !== viewId || (!fromView && refreshIdRef.current !== refreshId)
      try {
        const res = await fetch(buildUrl(target), { signal })
        if (stale()) return
        if (!res.ok) {
          if (fromView) viewPendingRef.current = false
          setError(LOAD_ERROR)
          if (fromView || itemsRef.current.length === 0) setStatus('error')
          return
        }
        const body = (await res.json()) as PipelinePageDto
        if (stale()) return
        if (fromView) viewPendingRef.current = false
        setItems(body.items)
        setNextCursor(body.nextCursor)
        setCounts(body.counts)
        setError(null)
        setStatus('ready')
        loadedKeyRef.current = keyOf(target)
        if (fromView) {
          // The mark-read POST clears 'new' server-side, so remember which rows
          // were unread when the view opened — that is what the badge counted.
          const unread =
            target.stage === 'matched'
              ? body.items.filter((j) => j.status === 'new').map((j) => j._id)
              : []
          setUnreadIds(unread.length ? new Set(unread) : EMPTY_SET)
          if (unread.length) markRead(target.profile)
        }
      } catch (err) {
        if (isAbort(err) || stale()) return
        if (fromView) viewPendingRef.current = false
        setError(LOAD_ERROR)
        if (fromView || itemsRef.current.length === 0) setStatus('error')
      }
    },
    [markRead]
  )

  useEffect(() => {
    // Seeded first render: the server already read this view.
    if (loadedKeyRef.current === viewKey) {
      if (!initialMarkedRef.current && seeded && view.stage === 'matched') {
        initialMarkedRef.current = true
        if (seeded.items.some((j) => j.status === 'new')) markRead(view.profile)
      }
      return
    }
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setItems([])
    setNextCursor(null)
    setError(null)
    setLoadingMore(false)
    loadingMoreRef.current = false
    setUnreadIds(EMPTY_SET)
    loadedKeyRef.current = null
    viewPendingRef.current = false
    setStatus('loading')
    void loadFirstPage(viewRef.current, true, controller.signal)
    return () => {
      controller.abort()
      // A view change or unmount invalidates anything still in flight.
      invalidateInFlight()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, loadFirstPage, markRead])

  useEffect(() => {
    // Seeded from the revision at mount, so this never duplicates the mount fetch.
    if (revision === lastRevisionRef.current) return
    lastRevisionRef.current = revision
    void loadFirstPage(viewRef.current, false)
  }, [revision, loadFirstPage])

  const reload = useCallback(() => loadFirstPage(viewRef.current, false), [loadFirstPage])

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current
    if (!cursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    const requestId = ++requestIdRef.current
    try {
      const res = await fetch(buildUrl(viewRef.current, cursor))
      if (requestId !== requestIdRef.current) return
      if (!res.ok) {
        setError(LOAD_ERROR)
        return
      }
      const body = (await res.json()) as PipelinePageDto
      if (requestId !== requestIdRef.current) return
      setItems((prev) => {
        const seen = new Set(prev.map((j) => j._id))
        return [...prev, ...body.items.filter((j) => !seen.has(j._id))]
      })
      setNextCursor(body.nextCursor)
      setCounts(body.counts)
      setError(null)
    } catch {
      if (requestId === requestIdRef.current) setError(LOAD_ERROR)
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [])

  const removeLocal = useCallback((id: string) => {
    setItems((prev) => prev.filter((j) => j._id !== id))
  }, [])

  return { items, counts, nextCursor, status, loadingMore, error, unreadIds, loadMore, reload, removeLocal }
}
