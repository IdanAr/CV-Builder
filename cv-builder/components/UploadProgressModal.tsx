'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Progress } from '@/components/ui/progress'

export type UploadStage = 'reading' | 'extracting' | 'done' | 'error'

interface PhaseConfig {
  start: number
  cap: number
  decayRate: number
  swapAfterMs: number
  label2: string
}

const TICK_MS = 100

const READING_PHASE: PhaseConfig = {
  start: 0,
  cap: 45,
  decayRate: 0.35,
  swapAfterMs: 900,
  label2: 'Parsing document…',
}

const EXTRACTING_PHASE: PhaseConfig = {
  start: 45,
  cap: 95,
  decayRate: 0.35,
  swapAfterMs: 1500,
  label2: 'Finalizing…',
}

interface UploadProgressModalProps {
  open: boolean
  filename: string
  stage: UploadStage
  errorMessage?: string
  onRetry: () => void
  onClose: () => void
  /** Aborts the in-flight upload request. When provided, a Cancel affordance
   * (button, Escape, backdrop-click) is available during "reading"/"extracting"
   * instead of trapping the user until the request finishes or errors. */
  onCancel?: () => void
}

export default function UploadProgressModal({
  open,
  filename,
  stage,
  errorMessage,
  onRetry,
  onClose,
  onCancel,
}: UploadProgressModalProps) {
  const [percent, setPercent] = useState(0)
  const [label, setLabel] = useState('')
  const intervalRef = useRef<number | null>(null)
  const swapTimerRef = useRef<number | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function clearTimers() {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
      if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current)
      intervalRef.current = null
      swapTimerRef.current = null
    }

    function runPhase(phase: PhaseConfig) {
      const phaseStart = Date.now()
      swapTimerRef.current = window.setTimeout(() => setLabel(phase.label2), phase.swapAfterMs)
      intervalRef.current = window.setInterval(() => {
        const elapsedSeconds = (Date.now() - phaseStart) / 1000
        setPercent(phase.cap - (phase.cap - phase.start) * Math.pow(phase.decayRate, elapsedSeconds))
      }, TICK_MS)
    }

    clearTimers()

    if (!open) return clearTimers

    if (stage === 'reading') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPercent(READING_PHASE.start)
      setLabel(`Reading ${filename}…`)
      runPhase(READING_PHASE)
    } else if (stage === 'extracting') {
      setPercent(READING_PHASE.cap)
      setLabel('Extracting information…')
      runPhase(EXTRACTING_PHASE)
    } else if (stage === 'done') {
      setPercent(100)
      setLabel('Done — opening your CV…')
    }

    return clearTimers
  }, [open, stage, filename])

  // Cancel is offered while an upload is actively running (not once it has
  // finished or already failed — those states have their own dedicated
  // affordances), and only when the caller wired up an abort path.
  const canCancel = (stage === 'reading' || stage === 'extracting') && !!onCancel
  const dismissible = stage === 'error' || canCancel

  const handleDismiss = useCallback(() => {
    if (stage === 'error') {
      onClose()
    } else if (canCancel) {
      onCancel?.()
    }
  }, [stage, canCancel, onClose, onCancel])

  // Remember what had focus before the dialog opened, so it can be restored
  // on close; move focus into the dialog once there's an action to take.
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
    } else {
      previousFocusRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (open && dismissible) closeButtonRef.current?.focus()
  }, [open, dismissible])

  useEffect(() => {
    if (!open || !dismissible) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleDismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, dismissible, handleDismiss])

  if (!open) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Uploading CV"
      className="fixed inset-0 z-40 flex items-center justify-center bg-indigo-950/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) handleDismiss()
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-indigo-100 bg-white p-6 shadow-xl">
        {stage === 'error' ? (
          <>
            <h2 className="mb-2 text-sm font-semibold text-indigo-900">Upload failed</h2>
            <p className="mb-4 text-sm text-red-600">{errorMessage}</p>
            <div className="flex justify-end gap-2">
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
              >
                Close
              </button>
              <button
                onClick={onRetry}
                className="rounded-lg border border-indigo-300 bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Try another file
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-1 truncate text-sm font-semibold text-indigo-900">{filename}</h2>
            <p className="mb-4 text-sm text-indigo-600">{label}</p>
            <Progress value={percent} className="bg-indigo-100" indicatorClassName="bg-indigo-600" />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs font-medium text-indigo-500">{Math.round(percent)}%</p>
              {canCancel && (
                <button
                  ref={closeButtonRef}
                  onClick={handleDismiss}
                  className="text-xs font-medium text-indigo-500 hover:text-indigo-700 hover:underline"
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
