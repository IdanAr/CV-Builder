'use client'

import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Copy, FileDown, Info, Link2, Loader2, RotateCcw, Sparkles, Type } from 'lucide-react'
import { useResumeEditorStore, flushSave } from '@/lib/stores/resume-editor.store'
import { fetchWithTimeout, requestErrorMessage } from '@/lib/fetch-with-timeout'
import { inputClass } from '@/components/editor/forms/field-styles'
import { SegmentedControl } from '@/components/editor/design/SegmentedControl'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/lib/api/client-errors'
import { detectGaps, type DetectedGap } from '@/lib/ai/cover-letter/gaps'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
// Types only: the values would drag mongoose into the client bundle.
import type { CoverLetterView } from '@/lib/api/cover-letters'
import type { CoverLetterNotes, CreateCoverLetterInput } from '@/lib/schemas/cover-letter.zod'
import { useCoverLetters } from './use-cover-letters'
import { useLetterDeletion } from './use-letter-deletion'
import { resolveDesign, type LetterDesign } from '@/lib/coverletter/design'
import { DesignPicker } from './DesignPicker'
import { LetterList, letterCompany, letterDate, letterTitle } from './LetterList'
import { LetterNotes } from './LetterNotes'
import { LetterProgress } from './LetterProgress'

type Source = 'paste' | 'link'

const SOURCE_OPTIONS = [
  { id: 'paste', label: 'Paste text' },
  { id: 'link', label: 'From a link' },
]

// CreateCoverLetterSchema's caps. The posting cap is MAX_JD_LENGTH, repeated
// here because importing it would bring the AI SDK into the client bundle; a
// longer paste is cut, as the old route did, instead of being refused.
const NAME_MAX = 200
const JOB_TEXT_MAX = 10_000
// UpdateCoverLetterSchema's content cap, so typing stops before the save is refused.
const CONTENT_MAX = 20_000

interface ImportedJob {
  text: string
  title?: string
  company?: string
  host: string
}

/** What the new-letter form starts from: blank, a suggested posting, or a failed letter being tried again. */
interface Draft {
  jobText: string
  company: string
  role: string
  notes: CoverLetterNotes
  scrapedJobId?: string
  applicationId?: string
}

type View =
  | { kind: 'auto' }
  | { kind: 'list' }
  | { kind: 'new'; draft: Draft; key: number }
  | { kind: 'open'; id: string }

function wordCount(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

function fileSafe(s: string): string {
  return s.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40)
}

/** The download name the export route put in Content-Disposition: the UTF-8 `filename*` when there is one, else the ASCII `filename`. */
function dispositionFilename(header: string | null): string | null {
  if (!header) return null
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)?.[1]
  if (encoded) {
    try {
      const name = decodeURIComponent(encoded.trim())
      if (name) return name
    } catch {
      // A malformed escape: fall through to the plain filename.
    }
  }
  const plain = /filename\s*=\s*"([^"]+)"/i.exec(header)?.[1] ?? /filename\s*=\s*([^;]+)/i.exec(header)?.[1]
  return plain?.trim() || null
}

/** Notes with blank fields left out, so an untouched field is not sent as an empty string. */
function filledNotes(notes: CoverLetterNotes): CoverLetterNotes {
  const out: CoverLetterNotes = {}
  for (const key of ['motivation', 'explain', 'hiringManager'] as const) {
    const v = notes[key]?.trim()
    if (v) out[key] = v
  }
  return out
}

function thisMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** "2020-01" as "Jan 2020"; anything else (a CV date written another way) as written. */
function monthLabel(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})$/)
  if (!m) return value
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleDateString('en-US', {
    month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

function situationLine(gap: DetectedGap): string {
  const ask = 'If you want the letter to explain it, add a sentence here.'
  return gap.exactStart
    ? `Your CV shows no role from ${monthLabel(gap.from)} to ${monthLabel(gap.to)}. ${ask}`
    : `Your CV shows no role for at least ${gap.months} months after ${monthLabel(gap.after)}. ${ask}`
}

const LETTER_TEXT = 'w-full whitespace-pre-wrap break-words border px-4 py-3 text-sm leading-relaxed'

/** One auto-growing textarea for the letter, edited where it was written. */
function LetterEditor({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 320)}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={CONTENT_MAX}
      placeholder="Write your letter here."
      spellCheck
      className={cn(
        LETTER_TEXT,
        'block min-h-80 resize-none overflow-hidden rounded-card border-border bg-surface text-fg placeholder:text-fg-subtle',
        'focus-visible:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    />
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="xs" variant="ghost" onClick={onClick} className="-ml-2.5">
      <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
      All letters
    </Button>
  )
}

/**
 * The job in: paste or import the posting, name the company and role, add
 * optional notes. Write hands it to the background job; nothing is sent
 * before that, including for a suggested posting.
 */
function NewLetterForm({
  resumeId,
  initial,
  situation,
  onSubmit,
  submitError,
  onBack,
}: {
  resumeId: string | null
  initial: Draft
  situation: string[]
  /** Resolves false when the letter could not be started. */
  onSubmit: (input: CreateCoverLetterInput) => Promise<boolean>
  /** The panel's error, repeated by the Write button after a failed start. */
  submitError?: string | null
  onBack?: () => void
}) {
  const id = useId()
  const [source, setSource] = useState<Source>('paste')
  const [jobText, setJobText] = useState(initial.jobText)
  const [jobUrl, setJobUrl] = useState('')
  const [imported, setImported] = useState<ImportedJob | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [company, setCompany] = useState(initial.company)
  const [role, setRole] = useState(initial.role)
  const [notes, setNotes] = useState<CoverLetterNotes>(initial.notes)
  const [submitting, setSubmitting] = useState(false)
  const [startFailed, setStartFailed] = useState(false)

  const ready = jobText.trim() !== '' && company.trim() !== '' && role.trim() !== ''

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
      setJobText(job.text)
      if (job.company && !company.trim()) setCompany(job.company.slice(0, NAME_MAX))
      if (job.title && !role.trim()) setRole(job.title.slice(0, NAME_MAX))
      setSource('paste')
    } catch (err) {
      setImportError(requestErrorMessage(err, "Couldn't import that link. Paste the job description instead."))
    } finally {
      setImporting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready || submitting) return
    setSubmitting(true)
    setStartFailed(false)
    try {
      const started = await onSubmit({
        company: company.trim(),
        role: role.trim(),
        jobText: jobText.trim().slice(0, JOB_TEXT_MAX),
        notes: filledNotes(notes),
        ...(initial.scrapedJobId ? { scrapedJobId: initial.scrapedJobId } : {}),
        ...(initial.applicationId ? { applicationId: initial.applicationId } : {}),
      })
      setStartFailed(!started)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-labelledby={`${id}-title`} className="space-y-4">
      {onBack && <BackButton onClick={onBack} />}
      <div>
        <h2 id={`${id}-title`} className="text-base font-medium text-fg-heading">New cover letter</h2>
        <p className="mt-0.5 text-sm text-fg-muted">Add the job, and the AI writes a letter from the facts in your CV.</p>
      </div>

      <div className="space-y-3">
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
              value={jobText}
              onChange={(e) => { setJobText(e.target.value); setImported(null) }}
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
            <label htmlFor={`${id}-company`} className="mb-1 block text-xs text-fg-muted">Company</label>
            <input
              id={`${id}-company`} type="text" required maxLength={NAME_MAX}
              value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-role`} className="mb-1 block text-xs text-fg-muted">Role</label>
            <input
              id={`${id}-role`} type="text" required maxLength={NAME_MAX}
              value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}
            />
          </div>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-fg-heading">Your notes</legend>
        <p className="text-xs text-fg-muted">Optional, in your own words. The letter only says what you write here or what your CV shows.</p>
        <LetterNotes idPrefix={id} value={notes} onChange={setNotes} situation={situation} />
      </fieldset>

      <div>
        <Button type="submit" size="md" disabled={!ready || submitting} className="w-full">
          {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
          Write letter
        </Button>
        {/* The banner at the top already announces it (role="alert"); this copy is for whoever is looking at the button. */}
        {startFailed && submitError && <p className="mt-1.5 text-center text-sm text-fg-danger">{submitError}</p>}
        {!ready && <p className="mt-1.5 text-center text-xs text-fg-muted">Add the job description, company and role to write.</p>}
      </div>
    </form>
  )
}

/** One letter: its progress while writing, its error if it failed, its editor once ready. */
function OpenLetter({
  letter,
  resumeId,
  onSave,
  onFlush,
  onBack,
  onRetry,
}: {
  letter: CoverLetterView
  resumeId: string | null
  onSave: ReturnType<typeof useCoverLetters>['save']
  onFlush: ReturnType<typeof useCoverLetters>['flush']
  onBack: () => void
  onRetry: (letter: CoverLetterView) => void
}) {
  const id = useId()
  const [notes, setNotes] = useState<CoverLetterNotes>(letter.notes ?? {})
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState<'docx' | 'pdf' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const templateId = useResumeEditorStore((s) => s.meta.templateId)
  const design = resolveDesign(letter.design, templateId)

  const approvals = letter.pendingApprovals
  const hasLetter = letter.content.trim().length > 0
  const canExport = hasLetter && approvals.length === 0

  function saveNotes() {
    const saved = letter.notes ?? {}
    const changed = (['motivation', 'explain', 'hiringManager'] as const).some((k) => (notes[k] ?? '') !== (saved[k] ?? ''))
    // The whole object, so the hook's optimistic copy does not lose the untouched fields.
    if (changed) onSave(letter.id, { notes: { ...saved, ...notes } })
  }

  async function handleCopy() {
    if (!canExport) return
    try {
      await navigator.clipboard.writeText(letter.content)
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
      // The server exports the saved letter, so the last keystrokes must land first.
      await onFlush()
      const res = await fetch(`/api/resumes/${resumeId}/cover-letters/${letter.id}/export/${format}`, { method: 'POST' })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Export failed. Please try again.'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const suffix = fileSafe(letterCompany(letter))
      a.download = dispositionFilename(res.headers.get('Content-Disposition')) ?? `Cover-Letter${suffix ? `-${suffix}` : ''}.${format}`
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
    <section aria-labelledby={`${id}-title`} className="space-y-3">
      <BackButton onClick={onBack} />
      <div>
        <h2 id={`${id}-title`} className="text-base font-medium text-fg-heading">{letterTitle(letter)}</h2>
        <p className="mt-0.5 text-xs text-fg-muted">{letterDate(letter.createdAt)}</p>
      </div>

      {letter.status === 'writing' && <LetterProgress progress={letter.progress} />}

      {letter.status === 'failed' && (
        <div className="space-y-3">
          <ErrorBanner>{letter.error || 'This letter could not be written.'}</ErrorBanner>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => onRetry(letter)}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Try again
            </Button>
            <p className="text-xs text-fg-muted">Starts a new letter with the same posting, company, role and notes.</p>
          </div>
        </div>
      )}

      {letter.status === 'ready' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <label htmlFor={`${id}-output`} className="text-sm font-medium text-fg-heading">Cover letter</label>
              {hasLetter && <span className="text-xs text-fg-muted">{wordCount(letter.content)} words</span>}
            </div>
            <div className="flex gap-1" title={approvals.length > 0 ? 'Keep the letter first' : undefined}>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-xs text-fg-muted">Design for PDF and DOCX</span>
            <DesignPicker value={design} onChange={(d: LetterDesign) => onSave(letter.id, { design: d })} />
          </div>

          {approvals.length > 0 && (
            <div role="region" aria-label="Unverified details" className="rounded-card border border-border-attention bg-surface-attention p-3">
              <p className="flex items-start gap-2 text-sm text-fg-attention">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {approvals.length === 1
                  ? '1 detail could not be traced to your CV. Check it, edit the letter if needed, then keep it.'
                  : `${approvals.length} details could not be traced to your CV. Check them, edit the letter if needed, then keep it.`}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-10 text-xs text-fg-attention" aria-label="Details to check">
                {approvals.map((reason, i) => <li key={`${i}-${reason}`}>{reason}</li>)}
              </ul>
              <div className="mt-3 pl-6">
                <Button size="sm" onClick={() => onSave(letter.id, { pendingApprovals: [] })}>Keep this letter</Button>
              </div>
            </div>
          )}

          {letter.notices.length > 0 && (
            <ul className="space-y-1" aria-label="Notes about this letter">
              {letter.notices.map((notice, i) => (
                <li key={`${i}-${notice}`} className="flex items-start gap-1.5 text-xs text-fg-muted">
                  <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {notice}
                </li>
              ))}
            </ul>
          )}

          <LetterEditor id={`${id}-output`} value={letter.content} onChange={(v) => onSave(letter.id, { content: v })} />
          <p className="text-xs text-fg-muted">Saves as you type.</p>
        </>
      )}

      {letter.status !== 'writing' && (
        <details className="rounded-card border border-border bg-surface px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-fg-heading">Your notes for this letter</summary>
          <div className="mt-3 space-y-2">
            <p className="text-xs text-fg-muted">Kept with this letter for next time. Changing them does not rewrite the text.</p>
            <LetterNotes idPrefix={id} value={notes} onChange={setNotes} onBlur={saveNotes} />
          </div>
        </details>
      )}
    </section>
  )
}

/**
 * The CV's cover letters: a list of letters (one per job), a form for a new
 * one, and each letter's own editor. Letters are written by a background job
 * and live in their own collection, so nothing here touches `data.coverLetter`.
 * Text edits autosave to the open letter through `useCoverLetters`.
 */
export function CoverLetterPanel() {
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const data = useResumeEditorStore((s) => s.data)
  const { letters, prefillNotes, suggestedPosting, loading, error, create, save, remove, flush, postingFor } = useCoverLetters(resumeId)

  const [view, setView] = useState<View>({ kind: 'auto' })
  // Deletes wait out an undo window, like deleting a CV.
  const { hidden, requestDelete: requestLetterDelete } = useLetterDeletion(remove)
  const formKey = useRef(0)

  const situation = useMemo(() => detectGaps(data, thisMonth()).map(situationLine), [data])

  const visible = useMemo(
    () =>
      letters
        .filter((l) => !hidden.has(l.id))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [letters, hidden]
  )

  const requestDelete = (letter: CoverLetterView) =>
    requestLetterDelete(letter.id, `Deleted letter for ${letterTitle(letter)}`)

  const blankNotes = (): CoverLetterNotes => (prefillNotes.explain ? { explain: prefillNotes.explain } : {})

  function openForm(draft: Partial<Draft> = {}) {
    formKey.current += 1
    setView({
      kind: 'new',
      key: formKey.current,
      draft: { jobText: '', company: '', role: '', notes: blankNotes(), ...draft },
    })
  }

  function openSuggestion() {
    if (!suggestedPosting) return
    const { company, role, jobText, scrapedJobId } = suggestedPosting
    openForm({ company, role, jobText, scrapedJobId })
  }

  async function retry(letter: CoverLetterView) {
    // Lists never carry the posting; a failed letter's own read does. Failing
    // that, a job-search letter can reuse the suggested posting of its job.
    const own = await postingFor(letter.id)
    const suggested = suggestedPosting && suggestedPosting.scrapedJobId === letter.scrapedJobId ? suggestedPosting.jobText : ''
    const posting = own ?? suggested
    openForm({
      company: letter.company,
      role: letter.role,
      jobText: posting,
      notes: letter.notes ?? {},
      scrapedJobId: letter.scrapedJobId,
      applicationId: letter.applicationId,
    })
  }

  async function submit(input: CreateCoverLetterInput) {
    // The job writes from the saved CV, so recent edits must land first.
    await flushSave().catch(() => {})
    const created = await create(input)
    if (created) setView({ kind: 'open', id: created.id })
    return created !== null
  }

  const hasSomething = visible.length > 0 || suggestedPosting !== null
  const toList = () => setView({ kind: 'list' })

  let body: React.ReactNode
  if (loading) {
    body = (
      <p role="status" className="flex items-center gap-2 py-6 text-sm text-fg-muted">
        <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
        Loading your letters…
      </p>
    )
  } else {
    const openLetter = view.kind === 'open' ? visible.find((l) => l.id === view.id) : undefined
    if (openLetter) {
      body = (
        <OpenLetter key={openLetter.id} letter={openLetter} resumeId={resumeId} onSave={save} onFlush={flush} onBack={toList} onRetry={retry} />
      )
    } else if (view.kind === 'new' || (view.kind === 'auto' && !hasSomething)) {
      const draft = view.kind === 'new' ? view.draft : { jobText: '', company: '', role: '', notes: blankNotes() }
      body = (
        <NewLetterForm
          key={view.kind === 'new' ? view.key : 0}
          resumeId={resumeId}
          initial={draft}
          situation={situation}
          onSubmit={submit}
          submitError={error}
          onBack={hasSomething ? toList : undefined}
        />
      )
    } else {
      body = (
        <LetterList
          letters={visible}
          suggestion={suggestedPosting}
          onOpen={(letterId) => setView({ kind: 'open', id: letterId })}
          onNew={() => openForm()}
          onSuggestion={openSuggestion}
          onDelete={requestDelete}
        />
      )
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-5">
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {body}
    </div>
  )
}
