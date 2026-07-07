'use client'

import { useState } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'

export function CoverLetterPanel() {
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const data = useResumeEditorStore((s) => s.data)
  const setData = useResumeEditorStore((s) => s.setData)

  const [jobDescription, setJobDescription] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [roleName, setRoleName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState<string[]>([])

  async function handleGenerate() {
    if (!resumeId || !jobDescription.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/resumes/${resumeId}/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription,
          companyName: companyName.trim() || undefined,
          roleName: roleName.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const result: { content: string; pendingApprovals: string[] } = await res.json()
      setData({ coverLetter: result.content })
      setPendingApprovals(result.pendingApprovals ?? [])
    } catch {
      setError('Could not generate a cover letter. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <label className="block text-sm font-medium text-indigo-700 mb-1">
          Paste the job description
        </label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the job description here to generate a tailored cover letter…"
          className="w-full h-40 rounded-lg border border-indigo-200 bg-white/70 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company name (optional)"
            className="flex-1 rounded-lg border border-indigo-200 bg-white/70 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="Role title (optional)"
            className="flex-1 rounded-lg border border-indigo-200 bg-white/70 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !jobDescription.trim()}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      {pendingApprovals.length > 0 && (
        <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-xs text-amber-700 font-medium mb-1">
            Double-check these before using this letter:
          </p>
          <div className="flex flex-wrap gap-1">
            {pendingApprovals.map((claim) => (
              <span
                key={claim}
                className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
              >
                {claim}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-indigo-700 mb-1">
          Your cover letter
        </label>
        <textarea
          value={data.coverLetter ?? ''}
          onChange={(e) => setData({ coverLetter: e.target.value })}
          placeholder="Your generated cover letter will appear here — feel free to edit it directly."
          className="w-full h-80 rounded-lg border border-indigo-200 bg-white/70 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  )
}
