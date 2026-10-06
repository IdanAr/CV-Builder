'use client'

import { useEffect, useRef, useState } from 'react'
import { useScrapedJobsSync } from '@/lib/stores/scraped-jobs.store'

/**
 * The sidebar lives in a layout, which does not re-render on client
 * navigation, so a server-provided count goes stale. Job lists announce every
 * mutation through the scraped-jobs sync store; each announcement re-reads the
 * count from the existing unread-count endpoint.
 */
export function useWaitingCount(initial: number): number {
  const [waiting, setWaiting] = useState(initial)
  const revision = useScrapedJobsSync((s) => s.revision)
  const lastRevision = useRef(revision)

  useEffect(() => {
    if (revision === lastRevision.current) return
    lastRevision.current = revision
    let cancelled = false
    fetch('/api/jobsearch/notifications/unread-count')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { waiting?: number } | null) => {
        if (!cancelled && body && typeof body.waiting === 'number') setWaiting(body.waiting)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [revision])

  // A fresh server value (after router.refresh) wins over a stale local one.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWaiting(initial)
  }, [initial])

  return waiting
}
