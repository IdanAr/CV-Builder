'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast, useToastStore } from '@/lib/stores/toast.store'
import { onToastPause, onToastResume } from '@/components/ui/Toaster'

export const UNDO_DELETE_DURATION = 6000

interface PendingDelete {
  title: string
  toastId: number | null
  timer: number | null
  /** Time left in the undo window, so a hover/focus pause resumes rather than resets. */
  remaining: number
  startedAt: number
}

/**
 * Library-level optimistic delete with an undo window. It lives in CvLibrary,
 * not in a row, so a pending delete survives the row unmounting: switching
 * between table and cards, re-sorting, or the row otherwise leaving the list.
 *
 * A requested delete hides the CV at once and shows a "Deleted" toast with
 * Undo. After 6s (paused while the toast is hovered or focused, via the
 * Toaster's pause/resume bus) it sends `DELETE /api/resumes/:id` and refreshes
 * the route; a failure restores the CV with an error toast. When the library
 * itself unmounts (the user navigates away), every pending delete is sent
 * immediately, since nothing would be left to run its timer.
 */
export function useCvDeletion() {
  const router = useRouter()
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set())
  const pendingRef = useRef(new Map<string, PendingDelete>())

  const setHidden = useCallback((id: string, hidden: boolean) => {
    setHiddenIds((prev) => {
      if (prev.has(id) === hidden) return prev
      const next = new Set(prev)
      if (hidden) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const commitDelete = useCallback(
    async (id: string, title: string) => {
      try {
        const res = await fetch(`/api/resumes/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Delete failed')
        router.refresh()
      } catch (err) {
        console.error(err)
        setHidden(id, false)
        toast.error(`Could not delete "${title}". It has been restored.`)
      }
    },
    [router, setHidden]
  )

  const startTimer = useCallback(
    (id: string, ms: number) => {
      const entry = pendingRef.current.get(id)
      if (!entry) return
      entry.startedAt = Date.now()
      entry.remaining = ms
      entry.timer = window.setTimeout(() => {
        pendingRef.current.delete(id)
        if (entry.toastId !== null) useToastStore.getState().dismiss(entry.toastId)
        void commitDelete(id, entry.title)
      }, ms)
    },
    [commitDelete]
  )

  const requestDelete = useCallback(
    (id: string, title: string) => {
      if (pendingRef.current.has(id)) return
      const entry: PendingDelete = { title, toastId: null, timer: null, remaining: UNDO_DELETE_DURATION, startedAt: 0 }
      pendingRef.current.set(id, entry)
      setHidden(id, true)
      entry.toastId = toast.withAction(`Deleted "${title}"`, 'Undo', () => {
        // A no-op once the delete has been sent: the entry is gone by then.
        if (pendingRef.current.get(id) !== entry) return
        if (entry.timer !== null) window.clearTimeout(entry.timer)
        pendingRef.current.delete(id)
        setHidden(id, false)
      })
      startTimer(id, UNDO_DELETE_DURATION)
    },
    [setHidden, startTimer]
  )

  // Keep the undo countdowns in lockstep with the toasts' own dismiss timers,
  // which Toaster.tsx pauses on hover or focus.
  useEffect(() => {
    function findByToast(toastId: number): [string, PendingDelete] | undefined {
      for (const pair of pendingRef.current) if (pair[1].toastId === toastId) return pair
      return undefined
    }
    const unsubPause = onToastPause((toastId) => {
      const found = findByToast(toastId)
      if (!found || found[1].timer === null) return
      const entry = found[1]
      entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt))
      window.clearTimeout(entry.timer!)
      entry.timer = null
    })
    const unsubResume = onToastResume((toastId) => {
      const found = findByToast(toastId)
      if (!found || found[1].timer !== null) return
      startTimer(found[0], found[1].remaining)
    })
    return () => {
      unsubPause()
      unsubResume()
    }
  }, [startTimer])

  // Leaving the library page: send every pending delete now (paused ones too)
  // and drop their toasts, whose Undo could no longer restore anything.
  useEffect(() => {
    const pending = pendingRef.current
    return () => {
      for (const [id, entry] of pending) {
        if (entry.timer !== null) window.clearTimeout(entry.timer)
        if (entry.toastId !== null) useToastStore.getState().dismiss(entry.toastId)
        void fetch(`/api/resumes/${id}`, { method: 'DELETE' })
      }
      pending.clear()
    }
  }, [])

  const isHidden = useCallback((id: string) => hiddenIds.has(id), [hiddenIds])

  return { isHidden, requestDelete }
}
