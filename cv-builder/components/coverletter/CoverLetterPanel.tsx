'use client'

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, Copy, FileDown, Link2, Loader2, Sparkles, Type } from 'lucide-react'
import { useResumeEditorStore, flushSave } from '@/lib/stores/resume-editor.store'
import { fetchWithTimeout, requestErrorMessage } from '@/lib/fetch-with-timeout'
import { inputClass } from '@/components/editor/forms/field-styles'
import { SegmentedControl } from '@/components/editor/design/SegmentedControl'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/lib/api/client-errors'
import { Button } from '@/components/ui/Button'

type Source = 'paste' | 'link'

const SOURCE_OPTIONS = [
  { id: 'paste', label: 'Paste text' },
  { id: 'link', label: 'From a link' },
]

/** A freshly generated letter that contains claims the user must approve first. */
interface PendingLetter {
  content: string
  approvals: string[]
}

interface ImportedJob {
  text: string
  title?: string
  company?: string
  host: string
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Approvals that still appear in the (possibly edited) letter. */
function openApprovals(text: string, approvals: string[]): string[] {
  const lower = text.toLowerCase()
  return approvals.filter((a) => a.trim() && lower.includes(a.toLowerCase()))
}

/** Text with every occurrence of each phrase wrapped in a <mark>, for the highlight layer. */
function markPhrases(text: string, phrases: string[]): ReactNode {
  const live = phrases.filter((p) => p.trim())
  if (live.length === 0) return text
  const re = new RegExp(`(${live.map(escapeRegExp).join('|')})`, 'gi')
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? <mark key={i} className="rounded-chip bg-surface-attention text-transparent">{part}</mark> : part
  )
}

function wordCount(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

function fileSafe(s: string): string {
  return s.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40)
}

// Shared by the textarea and the highlight layer behind it: any difference in
// font, padding, border or wrapping would let the highlights drift off the words.
const LETTER_TEXT = 'w-full whitespace-pre-wrap break-words border px-4 py-3 text-sm leading-relaxed'

/**
 * The letter is one auto-growing textarea over a layer that paints highlights
 * for unverified claims. A textarea cannot style its own text, so the layer
 * repeats the text invisibly with the claims marked, exactly underneath.
 */
function LetterEditor({
  id, value, onChange, highlights, busy, placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  highlights: string[]
  busy: boolean
  placeholder: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 320)}px`
  }, [value])

  return (
    <div className="relative rounded-card bg-surface">
      {highlights.length > 0 && (
        <div aria-hidden="true" className={cn(LETTER_TEXT, 'pointer-events-none absolute inset-0 overflow-hidden rounded-card border-transparent text-transparent')}>
          {markPhrases(value, highlights)}
          {'\n '}
        </div>
      )}
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={busy}
        aria-busy={busy}
        placeholder={placeholder}
        spellCheck
        className={cn(
          LETTER_TEXT,
          'relative block min-h-80 resize-none overflow-hidden rounded-card border-border bg-transparent text-fg placeholder:text-fg-subtle',
          'focus-visible:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          busy && 'opacity-40'
        )}
      />
      {busy && (
        <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-card bg-surface/70">
          <Loader2 aria-hidden="true" className="h-5 w-5 text-primary motion-safe:animate-spin" />
          <p className="text-sm text-fg-body">Writing your letter…</p>
          <p className="text-xs text-fg-muted">Draft, critique, refine. About 20 seconds.</p>
        </div>
      )}
    </div>
  )
}

/**
 * Job in, letter out, in one place: paste a job description or import it from
 * a link, generate, and edit the letter in the same box it was written into.
 * A letter whose facts all trace back to the CV is written straight to the
 * document (Undo in the top bar brings the old one back); one with claims the
 * hallucination guard could not trace is held in the box, highlighted, until
 * the user keeps or discards it.
 */
export function CoverLetterPanel() {
  const id = useId()
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const coverLetter = useResumeEditorStore((s) => s.data.coverLetter ?? '')
  const setData = useResumeEditorStore((s) => s.setData)

  const [source, setSource] = useState<Source>('paste')
  const [jobDescription, setJobDescription] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [imported, setImported] = useState<ImportedJob | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [roleName, setRoleName] = useState('')

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingLetter | null>(null)
  const [justWritten, setJustWritten] = useState(false)

  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState<'docx' | 'pdf' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const letter = pending ? pending.content : coverLetter
  const open = pending ? openApprovals(pending.content, pending.approvals) : []
  const hasLetter = letter.trim().length > 0
  const canExport = hasLetter && !pending && !generating

  async function handleImport() {
    if (!resumeId || !jobUrl.trim()) return
    setImporting(true)
    setImportError(null)
    try {
      const res = await fetchWithTimeout(`/api/resumes/${resumeId}/job-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl.trim() }),
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Couldn't import that link. Paste the job description instead."))
      const job: ImportedJob = await res.json()
      setImported(job)
      setJobDescription(job.text)
      if (job.company && !companyName.trim()) setCompanyName(job.company)
      if (job.title && !roleName.trim()) setRoleName(job.title)
      setSource('paste')
    } catch (err) {
      setImportError(requestErrorMessage(err, "Couldn't import that link. Paste the job description instead."))
    } finally {
      setImporting(false)
    }
  }

  async function handleGenerate() {
    if (!resumeId || !jobDescription.trim()) return
    setGenerating(true)
    setError(null)
    setJustWritten(false)
    try {
      // The route writes from the saved CV, so recent edits must land first.
      await flushSave().catch(() => {})
      const res = await fetchWithTimeout(`/api/resumes/${resumeId}/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription,
          companyName: companyName.trim() || undefined,
          roleName: roleName.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Could not write a cover letter. Please try again.'))
      const result: { content: string; pendingApprovals?: string[] } = await res.json()
      const approvals = result.pendingApprovals ?? []
      if (approvals.length > 0) {
        setPending({ content: result.content, approvals })
      } else {
        setPending(null)
        setData({ coverLetter: result.content })
        setJustWritten(true)
      }
    } catch (err) {
      setError(requestErrorMessage(err, 'Could not write a cover letter. Please try again.'))
    } finally {
      setGenerating(false)
    }
  }

  function handleEdit(value: string) {
    setJustWritten(false)
    if (pending) setPending({ ...pending, content: value })
    else setData({ coverLetter: value })
  }

  function keepPending() {
    if (!pending) return
    setData({ coverLetter: pending.content })
    setPending(null)
    setJustWritten(true)
  }

  async function handleCopy() {
    if (!canExport) return
    try {
      await navigator.clipboard.writeText(letter)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setExportError("Couldn't copy. Select the text and copy it yourself.")
    }
  }

  async function handleExport(format: 'docx' | 'pdf') {
    if (!resumeId || !canExport) return
    setExporting(format)
    setExportError(null)
    try {
      const res = await fetch(`/api/resumes/${resumeId}/cover-letter/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: letter }),
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Export failed. Please try again.'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const suffix = fileSafe(companyName)
      a.download = `Cover-Letter${suffix ? `-${suffix}` : ''}.${format}`
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
    <div className="mx-auto max-w-xl space-y-5 px-4 py-5">
      {/* 1. The job */}
      <section aria-labelledby={`${id}-job`} className="space-y-3">
        <div>
          <h2 id={`${id}-job`} className="text-base font-medium text-fg-heading">Write a cover letter</h2>
          <p className="mt-0.5 text-sm text-fg-muted">Add the job, and the AI writes a letter from the facts in your CV.</p>
        </div>

        <SegmentedControl
          label="Job description source"
          options={SOURCE_OPTIONS}
          value={source}
          onChange={(v) => setSource(v as Source)}
        />

        {source === 'link' ? (
          <div className="space-y-2">
            <label htmlFor={`${id}-url`} className="sr-only">Job posting link</label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Link2 aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
                <input
                  id={`${id}-url`}
                  type="url"
                  inputMode="url"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleImport() } }}
                  placeholder="https://company.com/careers/job"
                  className={cn(inputClass, 'pl-9')}
                />
              </div>
              <Button size="md" variant="secondary" onClick={handleImport} disabled={importing || !jobUrl.trim()}>
                {importing && <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />}
                {importing ? 'Importing…' : 'Import'}
              </Button>
            </div>
            {importError ? (
              <p role="alert" className="text-sm text-fg-danger">{importError}</p>
            ) : (
              <p className="text-xs text-fg-muted">Works with most public job pages. Pages behind a sign-in, like LinkedIn, need pasting.</p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor={`${id}-jd`} className="sr-only">Job description</label>
            <textarea
              id={`${id}-jd`}
              value={jobDescription}
              onChange={(e) => { setJobDescription(e.target.value); setImported(null) }}
              placeholder="Paste the job description here…"
              className={cn(inputClass, 'h-36 resize-y py-2 leading-relaxed')}
            />
            {imported && (
              <p className="flex items-center gap-1.5 text-xs text-fg-success">
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
                Imported from {imported.host}. Check it, then write.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${id}-company`} className="mb-1 block text-xs text-fg-muted">Company <span className="text-fg-subtle">(optional)</span></label>
            <input id={`${id}-company`} type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${id}-role`} className="mb-1 block text-xs text-fg-muted">Role <span className="text-fg-subtle">(optional)</span></label>
            <input id={`${id}-role`} type="text" value={roleName} onChange={(e) => setRoleName(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <Button size="md" onClick={handleGenerate} disabled={generating || !jobDescription.trim()} className="w-full">
            {generating ? <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
            {generating ? 'Writing…' : hasLetter ? 'Rewrite cover letter' : 'Write cover letter'}
          </Button>
          {hasLetter && !generating && (
            <p className="mt-1.5 text-center text-xs text-fg-muted">Replaces the letter below. Undo in the top bar brings it back.</p>
          )}
          {error && <p role="alert" className="mt-2 text-sm text-fg-danger">{error}</p>}
        </div>
      </section>

      {/* 2. The letter, edited where it was written */}
      <section aria-labelledby={`${id}-letter`} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 id={`${id}-letter`} className="text-sm font-medium text-fg-heading">
              <label htmlFor={`${id}-output`}>Cover letter</label>
            </h2>
            {hasLetter && <span className="text-xs text-fg-muted">{wordCount(letter)} words</span>}
          </div>
          <div className="flex gap-1" title={pending ? 'Keep or discard the new letter first' : undefined}>
            <Button size="xs" variant="ghost" onClick={handleCopy} disabled={!canExport}>
              {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => handleExport('pdf')} disabled={!canExport || exporting !== null}>
              <FileDown aria-hidden="true" className="h-3.5 w-3.5" />
              {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => handleExport('docx')} disabled={!canExport || exporting !== null}>
              <Type aria-hidden="true" className="h-3.5 w-3.5" />
              {exporting === 'docx' ? 'Exporting…' : 'DOCX'}
            </Button>
          </div>
        </div>
        {exportError && <p role="alert" className="text-xs text-fg-danger">{exportError}</p>}

        {pending && (
          <div role="region" aria-label="Unverified details" className="rounded-card border border-border-attention bg-surface-attention p-3">
            <p className="flex items-start gap-2 text-sm text-fg-attention">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {open.length > 0
                ? `${open.length} ${open.length === 1 ? 'detail is' : 'details are'} not in your CV. Check the highlighted text, edit or remove it, then keep the letter.`
                : 'Every unverified detail has been edited out. Keep the letter to save it.'}
            </p>
            {open.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5 pl-6" aria-label="Details to check">
                {open.map((a) => (
                  <li key={a} className="rounded-full border border-border-attention bg-surface px-2 py-0.5 text-xs text-fg-attention">{a}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2 pl-6">
              <Button size="sm" onClick={keepPending}>Keep letter</Button>
              <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Discard</Button>
            </div>
          </div>
        )}

        <LetterEditor
          id={`${id}-output`}
          value={letter}
          onChange={handleEdit}
          highlights={open}
          busy={generating}
          placeholder="Your letter appears here, ready to edit. You can also write it yourself."
        />
        {justWritten && !pending && (
          <p role="status" className="flex items-center gap-1.5 text-xs text-fg-success">
            <Check aria-hidden="true" className="h-3.5 w-3.5" />
            Letter written. Edit it right here, it saves as you type.
          </p>
        )}
      </section>
    </div>
  )
}
