'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Phase = 'idle' | 'parsing' | 'extracting' | 'error'

const MAX_BYTES = 5 * 1024 * 1024

interface UploadCVButtonProps {
  variant?: 'navbar' | 'hero'
}

export default function UploadCVButton({ variant = 'navbar' }: UploadCVButtonProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [filename, setFilename] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return

    if (file.size > MAX_BYTES) {
      setErrorMsg('File must be 5 MB or smaller.')
      setPhase('error')
      return
    }

    setFilename(file.name)
    setPhase('parsing')
    setErrorMsg('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      const parseRes = await fetch('/api/resumes/upload/parse', { method: 'POST', body: formData })
      if (!parseRes.ok) {
        const json = await parseRes.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Could not read the file.')
      }
      const { text } = await parseRes.json() as { text: string }

      setPhase('extracting')
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
      const { resumeId } = await extractRes.json() as { resumeId: string }
      router.push(`/dashboard/resumes/${resumeId}`)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPhase('error')
    }
  }

  if (phase === 'error') {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-red-600">{errorMsg}</span>
        <button
          onClick={() => { setPhase('idle'); setErrorMsg(''); setFilename('') }}
          className="rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
        >
          Try another file
        </button>
      </div>
    )
  }

  if (phase === 'parsing' || phase === 'extracting') {
    return (
      <div className="flex items-center gap-3">
        <svg className="h-4 w-4 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm text-indigo-600">
          {phase === 'parsing' ? `Reading ${filename}…` : 'Extracting information…'}
        </span>
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-indigo-600" />
          <span className={`h-2 w-2 rounded-full ${phase === 'extracting' ? 'bg-indigo-600' : 'bg-indigo-100'}`} />
        </div>
      </div>
    )
  }

  const triggerClassName =
    variant === 'hero'
      ? 'w-full rounded-lg border border-indigo-300 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-50'
      : 'rounded-lg border border-indigo-300 bg-white/80 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-50'

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={handleFileChange}
      />
      <button onClick={() => inputRef.current?.click()} className={triggerClassName}>
        ⬆ Upload CV
      </button>
    </>
  )
}
