'use client'

import { useId, useState } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { fetchWithTimeout, requestErrorMessage } from '@/lib/fetch-with-timeout'
import { highlightApprovals } from '@/lib/ai/highlight-approvals'
import { inputClass } from '@/components/editor/forms/field-styles'
import { cn } from '@/lib/utils'

interface CoverLetterDraft {
  content: string
  pendingApprovals: string[]
}

export function CoverLetterPanel() {
  const id = useId()
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const data = useResumeEditorStore((s) => s.data)
  const setData = useResumeEditorStore((s) => s.setData)

  const [jobDescription, setJobDescription] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [roleName, setRoleName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<CoverLetterDraft | null>(null)
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState<'docx' | 'pdf' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!resumeId || !jobDescription.trim()) return
    setLoading(true)
    setError(null)
    setDraft(null)
    try {
      const res = await fetchWithTimeout(`/api/resumes/${resumeId}/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription,
          companyName: companyName.trim() || undefined,
          roleName: roleName.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Could not generate a cover letter. Please try again.')
      }
      const result: { content: string; pendingApprovals: string[] } = await res.json()
      setDraft({ content: result.content, pendingApprovals: result.pendingApprovals ?? [] })
    } catch (err) {
      setError(requestErrorMessage(err, 'Could not generate a cover letter. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  function handleUseDraft() {
    if (!draft) return
    setData({ coverLetter: draft.content })
    setDraft(null)
  }

  async function handleCopy() {
    const text = data.coverLetter ?? ''
    if (!text.trim()) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleExport(format: 'docx' | 'pdf') {
    const text = data.coverLetter ?? ''
    if (!resumeId || !text.trim()) return
    setExporting(format)
    setExportError(null)
    try {
      const res = await fetch(`/api/resumes/${resumeId}/cover-letter/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Export failed. Please try again.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Cover-Letter.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <label htmlFor={`${id}-jd`} className="block text-sm font-medium text-indigo-700 mb-1">
          Paste the job description
        </label>
        <textarea
          id={`${id}-jd`}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the job description here to generate a tailored cover letter…"
          className={cn(inputClass, 'h-40 resize-none py-2')}
        />

        <div className="mt-2 flex gap-2">
          <label htmlFor={`${id}-company`} className="sr-only">Company name</label>
          <input
            id={`${id}-company`}
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company name (optional)"
            className={cn(inputClass, 'w-auto flex-1')}
          />
          <label htmlFor={`${id}-role`} className="sr-only">Role title</label>
          <input
            id={`${id}-role`}
            type="text"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="Role title (optional)"
            className={cn(inputClass, 'w-auto flex-1')}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !jobDescription.trim()}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
        {error && <p className="mt-2 text-sm text-fg-danger">{error}</p>}
      </div>

      {draft && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-indigo-200 bg-white/90 p-3 shadow-sm"
        >
          {draft.pendingApprovals.length > 0 && (
            <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
              Highlighted items were not in your original notes - verify before using this letter.
            </p>
          )}
          <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {highlightApprovals(draft.content, draft.pendingApprovals)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleUseDraft}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Use this letter
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded px-3 py-1.5 text-xs text-fg-muted transition-colors hover:text-fg-body"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor={`${id}-output`} className="block text-sm font-medium text-indigo-700">
            Your cover letter
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!(data.coverLetter ?? '').trim()}
              className="rounded px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => handleExport('docx')}
              disabled={!(data.coverLetter ?? '').trim() || exporting !== null}
              className="rounded px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {exporting === 'docx' ? 'Exporting…' : 'Export DOCX'}
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={!(data.coverLetter ?? '').trim() || exporting !== null}
              className="rounded px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        </div>
        {exportError && <p className="mb-1 text-xs text-fg-danger">{exportError}</p>}
        <textarea
          id={`${id}-output`}
          value={data.coverLetter ?? ''}
          onChange={(e) => setData({ coverLetter: e.target.value })}
          placeholder="Your generated cover letter will appear here - feel free to edit it directly."
          className={cn(inputClass, 'h-80 resize-none py-2')}
        />
      </div>
    </div>
  )
}
