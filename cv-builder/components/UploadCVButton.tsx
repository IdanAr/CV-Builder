'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const [stage, setStage] = useState<Stage>('idle')
  const [filename, setFilename] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  function reset() {
    setStage('idle')
    setErrorMsg('')
    setFilename('')
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

    try {
      const formData = new FormData()
      formData.append('file', file)
      const parseRes = await fetch('/api/resumes/upload/parse', { method: 'POST', body: formData })
      if (!parseRes.ok) {
        const json = await parseRes.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Could not read the file.')
      }
      const { text } = (await parseRes.json()) as { text: string }

      setStage('extracting')
      const extractRes = await fetch('/api/resumes/upload/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!extractRes.ok) {
        const json = await extractRes.json().catch(() => ({}))
        throw new Error(
          (json as { error?: string }).error ?? 'Could not extract information from this CV.'
        )
      }
      const { resumeId } = (await extractRes.json()) as { resumeId: string }

      setStage('done')
      window.setTimeout(() => router.push(`/dashboard/resumes/${resumeId}`), DONE_DISPLAY_MS)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('error')
    }
  }

  const triggerClassName =
    variant === 'hero'
      ? 'w-full rounded-lg border border-indigo-300 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-50'
      : 'rounded-lg border border-indigo-300 bg-white/80 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-50'

  return (
    <>
      <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
      <button onClick={() => inputRef.current?.click()} className={triggerClassName}>
        ⬆ Upload CV
      </button>
      <UploadProgressModal
        open={stage !== 'idle'}
        filename={filename}
        stage={stage === 'idle' ? 'reading' : stage}
        errorMessage={errorMsg}
        onRetry={reset}
        onClose={reset}
      />
    </>
  )
}
