'use client'

import { useEffect, useRef } from 'react'
import { useToastStore, type Toast } from '@/lib/stores/toast.store'

const VARIANT_STYLES: Record<Toast['variant'], string> = {
  success: 'border-green-200 bg-green-50/95 text-green-800',
  error: 'border-red-200 bg-red-50/95 text-red-800',
  info: 'border-indigo-200 bg-white/95 text-indigo-900',
}

function ToastItem({ toast: t }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    timerRef.current = window.setTimeout(() => dismiss(t.id), t.duration)
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current) }
  }, [t.id, t.duration, dismiss])

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-xl ${VARIANT_STYLES[t.variant]}`}
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
