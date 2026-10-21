'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast, useToastStore } from '@/lib/stores/toast.store'
import { onToastPause, onToastResume } from '@/components/ui/Toaster'
import { UNDO_DELETE_DURATION } from '@/components/cvs/use-cv-deletion'

interface PendingDelete {
  toastId: number | null
  timer: number | null
  /** Time left in the undo window, so a hover/focus pause resumes rather than resets. */
  remaining: number
  startedAt: number
}

/**
 * Optimistic letter delete with an undo window, the CV library's treatment
 * (components/cvs/use-cv-deletion.ts) applied to one CV's cover letters.
 *
 * A requested delete hides the letter at once and shows a "Deleted" toast
 * with Undo. After 6 s it calls `remove`, the countdown pausing while the
 * toast is hovered or focused (so a keyboard user reaching Undo late still
 * makes it). Once `remove` is called, Undo does nothing. When the panel
 * unmounts, every pending delete is sent at once and its toast dismissed,
 * since nothing would be left to run the timer or honour the Undo.
 */
export function useLetterDeletion(remove: (id: string) => Promise<void>) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const pendingRef = useRef(new Map<string, PendingDelete>())
  const removeRef = useRef(remove)
  useEffect(() => {
    removeRef.current = remove
  }, [remove])

  const setHiddenFor = useCallback((id: string, on: boolean) => {
    setHidden((prev) => {
      if (prev.has(id) === on) return prev
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const startTimer = useCallback(
    (id: string, ms: number) => {
      const entry = pendingRef.current.get(id)
      if (!entry) return
      entry.startedAt = Date.now()
      entry.remaining = ms
      entry.timer = window.setTimeout(async () => {
        pendingRef.current.delete(id)
        if (entry.toastId !== null) useToastStore.getState().dismiss(entry.toastId)
        await removeRef.current(id)
        // Gone from the list on success; a failed delete shows the hook's error and the letter again.
        setHiddenFor(id, false)
      }, ms)
    },
    [setHiddenFor]
  )

  const requestDelete = useCallback(
    (id: string, message: string) => {
      if (pendingRef.current.has(id)) return
      const entry: PendingDelete = { toastId: null, timer: null, remaining: UNDO_DELETE_DURATION, startedAt: 0 }
      pendingRef.current.set(id, entry)
      setHiddenFor(id, true)
      entry.toastId = toast.withAction(message, 'Undo', () => {
        // A no-op once the delete has been sent: the entry is gone by then.
        if (pendingRef.current.get(id) !== entry) return
        if (entry.timer !== null) window.clearTimeout(entry.timer)
        pendingRef.current.delete(id)
        setHiddenFor(id, false)
      }, UNDO_DELETE_DURATION)
      startTimer(id, UNDO_DELETE_DURATION)
    },
    [setHiddenFor, startTimer]
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

  // Leaving the panel: send every pending delete now (paused ones too) and
  // drop their toasts, whose Undo could no longer restore anything.
  useEffect(() => {
    const pending = pendingRef.current
    return () => {
      for (const [id, entry] of pending) {
        if (entry.timer !== null) window.clearTimeout(entry.timer)
        if (entry.toastId !== null) useToastStore.getState().dismiss(entry.toastId)
        void removeRef.current(id)
      }
      pending.clear()
    }
  }, [])

  return { hidden, requestDelete }
}
