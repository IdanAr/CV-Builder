'use client'

import { useEffect, useRef } from 'react'
import { useToastStore, type Toast } from '@/lib/stores/toast.store'

const VARIANT_STYLES: Record<Toast['variant'], string> = {
  success: 'border-green-200 bg-green-50/95 text-green-800',
  error: 'border-red-200 bg-red-50/95 text-red-800',
  info: 'border-indigo-200 bg-white/95 text-indigo-900',
}

type ToastTimerListener = (id: number) => void
const pauseListeners = new Set<ToastTimerListener>()
const resumeListeners = new Set<ToastTimerListener>()

/**
 * Lets other components that own side effects tied to a toast's lifetime
 * (e.g. the resume card's undo-delete countdown) react when this toast's
 * own dismiss timer is paused/resumed on hover or focus, so both stay in sync.
 */
export function onToastPause(cb: ToastTimerListener): () => void {
  pauseListeners.add(cb)
  return () => pauseListeners.delete(cb)
}

export function onToastResume(cb: ToastTimerListener): () => void {
  resumeListeners.add(cb)
  return () => resumeListeners.delete(cb)
}

function ToastItem({ toast: t }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const timerRef = useRef<number | null>(null)
  const remainingRef = useRef(t.duration)
  const startedAtRef = useRef(0)
  // Tracks which kinds of interaction are currently keeping the timer paused,
  // so leaving hover while still focused (or vice versa) doesn't resume early.
  const activeInteractionsRef = useRef<Set<'hover' | 'focus'>>(new Set())

  function start(ms: number) {
    startedAtRef.current = Date.now()
    remainingRef.current = ms
    timerRef.current = window.setTimeout(() => dismiss(t.id), ms)
  }

  function clear() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    start(t.duration)
    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.id, t.duration, dismiss])

  function pause(kind: 'hover' | 'focus') {
    const wasEmpty = activeInteractionsRef.current.size === 0
    activeInteractionsRef.current.add(kind)
    if (!wasEmpty) return
    const elapsed = Date.now() - startedAtRef.current
    remainingRef.current = Math.max(0, remainingRef.current - elapsed)
    clear()
    pauseListeners.forEach((cb) => cb(t.id))
  }

  function resume(kind: 'hover' | 'focus') {
    activeInteractionsRef.current.delete(kind)
    if (activeInteractionsRef.current.size > 0) return
    start(remainingRef.current)
    resumeListeners.forEach((cb) => cb(t.id))
  }

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-xl ${VARIANT_STYLES[t.variant]}`}
      onMouseEnter={() => pause('hover')}
      onMouseLeave={() => resume('hover')}
      onFocus={() => pause('focus')}
      onBlur={() => resume('focus')}
    >
      <p className="text-sm font-medium">{t.message}</p>
      {t.actionLabel && (
        <button
          onClick={() => { t.onAction?.(); dismiss(t.id) }}
          className="rounded-md border border-current px-2 py-1 text-xs font-semibold hover:opacity-80"
        >
          {t.actionLabel}
        </button>
      )}
      <button
        aria-label="Dismiss notification"
        onClick={() => dismiss(t.id)}
        className="text-xs opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
