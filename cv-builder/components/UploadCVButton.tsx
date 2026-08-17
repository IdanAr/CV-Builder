'use client'

import { useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import UploadProgressModal, { type UploadStage } from './UploadProgressModal'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB_LABEL } from '@/lib/upload/limits'

type Stage = 'idle' | UploadStage

const DONE_DISPLAY_MS = 400

interface UploadCVButtonProps {
  variant?: 'navbar' | 'hero'
}

export default function UploadCVButton({ variant = 'navbar' }: UploadCVButtonProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [filename, setFilename] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const requirementsId = useId()

  function showTooltipAtCursor(e: React.MouseEvent) {
    setTooltipPos({ x: e.clientX, y: e.clientY })
  }

  function showTooltipAtButton() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) setTooltipPos({ x: rect.left + rect.width / 2, y: rect.bottom })
  }

  function hideTooltip() {
    setTooltipPos(null)
  }
  // Owns the lifecycle of the in-flight upload request(s) so Cancel can abort
  // whichever fetch (parse or extract) is currently running, and so a
  // response that arrives after cancel is ignored instead of resurrecting
  // stale progress/success UI.
  const abortControllerRef = useRef<AbortController | null>(null)

  function reset() {
    setStage('idle')
    setErrorMsg('')
    setFilename('')
  }

  function handleCancel() {
    abortControllerRef.current?.abort()
    reset()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return

    if (file.size > MAX_UPLOAD_BYTES) {
      setFilename(file.name)
      setErrorMsg(`File must be ${MAX_UPLOAD_MB_LABEL} or smaller.`)
      setStage('error')
      return
    }

    setFilename(file.name)
    setStage('reading')
    setErrorMsg('')

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const formData = new FormData()
      formData.append('file', file)
      const parseRes = await fetch('/api/resumes/upload/parse', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      if (!parseRes.ok) {
        const json = await parseRes.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Could not read the file.')
      }
      const { text } = (await parseRes.json()) as { text: string }

      // The user may have canceled while the parse response was in flight;
      // don't advance to "extracting" for a request they already dismissed.
      if (controller.signal.aborted) return

      setStage('extracting')
      const extractRes = await fetch('/api/resumes/upload/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
      if (!extractRes.ok) {
        const json = await extractRes.json().catch(() => ({}))
        throw new Error(
          (json as { error?: string }).error ?? 'Could not extract information from this CV.'
        )
      }
      const { resumeId } = (await extractRes.json()) as { resumeId: string }

      // The user may have canceled while the extract response was in flight;
      // don't resurrect success UI for a request they already dismissed.
      if (controller.signal.aborted) return

      setStage('done')
      window.setTimeout(() => router.push(`/dashboard/resumes/${resumeId}`), DONE_DISPLAY_MS)
    } catch (err) {
      if (controller.signal.aborted) return
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('error')
    }
  }

  const triggerClassName =
    variant === 'hero'
      ? 'w-full rounded-lg border border-indigo-300 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-50'
      : 'rounded-lg border border-indigo-300 bg-white/80 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-50'

  const requirementsText = `PDF or DOCX, up to ${MAX_UPLOAD_MB_LABEL}`

  return (
    <>
      <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
      {variant === 'hero' ? (
        <span className="block w-full">
          <button onClick={() => inputRef.current?.click()} className={triggerClassName}>
            <span className="inline-flex items-center gap-1.5">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload CV
            </span>
          </button>
          <span className="mt-1.5 block text-center text-xs text-indigo-400">{requirementsText}</span>
        </span>
      ) : (
        <>
          <button
            ref={buttonRef}
            onClick={() => inputRef.current?.click()}
            className={triggerClassName}
            aria-describedby={requirementsId}
            onMouseEnter={showTooltipAtCursor}
            onMouseMove={showTooltipAtCursor}
            onMouseLeave={hideTooltip}
            onFocus={showTooltipAtButton}
            onBlur={hideTooltip}
          >
            <span className="inline-flex items-center gap-1.5">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload CV
            </span>
          </button>
          {/* Always in the DOM so screen readers announce it via aria-describedby
              regardless of hover/focus; visually it only appears in the tooltip
              below, since an always-visible caption here breaks the navbar row's
              vertical alignment with sibling buttons that have no caption. */}
          <span id={requirementsId} className="sr-only">{requirementsText}</span>
          {tooltipPos && (
            <span
              role="tooltip"
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
              className="pointer-events-none fixed z-50 -translate-x-1/2 translate-y-3 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs text-white shadow-lg"
            >
              {requirementsText}
            </span>
          )}
        </>
      )}
      <UploadProgressModal
        open={stage !== 'idle'}
        filename={filename}
        stage={stage === 'idle' ? 'reading' : stage}
        errorMessage={errorMsg}
        onRetry={reset}
        onClose={reset}
        onCancel={handleCancel}
      />
    </>
  )
}
