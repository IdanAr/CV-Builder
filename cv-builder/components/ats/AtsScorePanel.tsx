'use client'

import { useState, useCallback, useEffect, useId, useRef } from 'react'
import { Check, ChevronDown, FileText, Loader2, RotateCcw, ScanSearch, Sparkles, X } from 'lucide-react'
import { useResumeEditorStore, flushSave } from '@/lib/stores/resume-editor.store'
import type { AtsScoreResult } from '@/lib/ats/scorer'
import type { AtsFix } from '@/lib/ai/ats-fix-pipeline'
import { applyAtsFixToResumeData } from '@/lib/ai/apply-ats-fix'
import type { KeywordPriority } from '@/lib/ai/jd-extraction-pipeline'
import { AtsFixReviewPanel } from './AtsFixReviewPanel'
import { Button } from '@/components/ui/Button'
import { inputClass } from '@/components/editor/forms/field-styles'
import { cn } from '@/lib/utils'
import { fetchWithTimeout, requestErrorMessage } from '@/lib/fetch-with-timeout'
import { apiErrorMessage } from '@/lib/api/client-errors'

// /ats-score merges keywordPriorities onto AtsScoreResult rather than
// widening that interface (see the route) — this is the richer shape the
// client actually receives.
type KeywordSource = 'ai' | 'basic' | 'cached'
type FallbackReason = 'rate-limited' | 'ai-error' | 'ai-empty'
type AtsScoreResponse = AtsScoreResult & {
  keywordPriorities?: Record<string, KeywordPriority>
  keywordSource?: KeywordSource
  keywordFallbackReason?: FallbackReason
}

const FALLBACK_REASON: Record<FallbackReason, string> = {
  'rate-limited': 'you reached the limit of AI requests for this minute',
  'ai-error': 'the AI service returned an error',
  'ai-empty': 'the AI found no requirements in this text',
}

const VECTORS: { key: keyof AtsScoreResult['breakdown']; label: string; hint: string; max: number }[] = [
  { key: 'keywordDensity', label: 'Keyword coverage', hint: "How many of the job's keywords appear anywhere in your CV", max: 35 },
  { key: 'format', label: 'Structure', hint: 'Contact details, a summary, complete roles and real bullet points', max: 25 },
  { key: 'keywordPlacement', label: 'Keyword placement', hint: 'Keywords in your summary, titles and bullets count the most', max: 25 },
  { key: 'metrics', label: 'Measurable results', hint: 'Bullets that carry a number, a percentage or a team size', max: 15 },
]

type Tone = 'success' | 'warning' | 'danger'

function toneFor(pct: number): Tone {
  return pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'danger'
}

const TONE_TEXT: Record<Tone, string> = { success: 'text-fg-success', warning: 'text-fg-warning', danger: 'text-fg-danger' }
const TONE_FILL: Record<Tone, string> = { success: 'bg-fg-success', warning: 'bg-fg-warning', danger: 'bg-fg-danger' }

function verdict(score: number): { label: string; line: string } {
  if (score >= 70) return { label: 'Good match', line: 'Your CV should pass most keyword screens for this job.' }
  if (score >= 40) return { label: 'Needs work', line: 'A recruiter may see it, but key requirements look missing.' }
  return { label: 'Poor match', line: 'Most screening software would rank this CV low for this job.' }
}

/**
 * Orders `must`/`ambiguous` keywords before `nice-to-have` ones so the most
 * important gaps are visually first, without changing which keywords are
 * shown. Stable: keywords within the same tier keep their original order.
 */
export function sortByPriority(keywords: string[], priorities: Record<string, KeywordPriority>): string[] {
  const rank = (kw: string): number => (priorities[kw] === 'nice-to-have' ? 1 : 0)
  return keywords
    .map((kw, index) => ({ kw, index }))
    .sort((a, b) => {
      const diff = rank(a.kw) - rank(b.kw)
      return diff !== 0 ? diff : a.index - b.index
    })
    .map((entry) => entry.kw)
}

function ScoreRing({ score }: { score: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  const tone = toneFor(score)
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" className="stroke-surface-muted" />
        <circle
          cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)}
          className={cn('transition-[stroke-dashoffset] duration-700', TONE_TEXT[tone])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-medium leading-none', TONE_TEXT[tone])}>{score}</span>
        <span className="mt-0.5 text-xs text-fg-subtle">of 100</span>
      </div>
    </div>
  )
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-muted">
      <div className={cn('h-1.5 rounded-full transition-[width] duration-500', TONE_FILL[toneFor(pct)])} style={{ width: `${pct}%` }} />
    </div>
  )
}

const CHIP = 'inline-flex items-center gap-1 rounded-full border py-0.5 text-xs max-sm:min-h-10'

function MissingChip({ kw, priority, onIgnore }: { kw: string; priority: KeywordPriority; onIgnore: () => void }) {
  return (
    <span
      className={cn(CHIP, 'pl-2.5 pr-0.5', priority === 'nice-to-have'
        ? 'border-border-warning bg-surface-warning text-fg-warning'
        : 'border-border-danger bg-surface-danger text-fg-danger')}
      title={priority === 'must' ? 'Must-have requirement' : priority === 'nice-to-have' ? 'Nice-to-have requirement' : 'Requirement level unclear from the job description'}
    >
      {kw}
      <button
        type="button"
        onClick={onIgnore}
        aria-label={`Ignore "${kw}"`}
        title="I don't have this. Stop counting it."
        className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:h-9 max-sm:w-9"
      >
        <X aria-hidden="true" className="h-3 w-3" />
      </button>
    </span>
  )
}

type FixStatus = 'idle' | 'loading' | 'ready' | 'error'
type SemanticStatus = 'idle' | 'loading' | 'ready' | 'error'

const EMPTY_EXCLUDED_KEYWORDS: string[] = []

/**
 * One page, top to bottom: paste a job description, get a score and the
 * keyword gaps, then let the AI work the missing keywords in and approve the
 * edits in place. Synonym checking runs by itself after the first score, so
 * the user never has to know it exists to benefit from it.
 */
export function AtsScorePanel() {
  const ids = useId()
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const data = useResumeEditorStore((s) => s.data)
  const setData = useResumeEditorStore((s) => s.setData)
  const excludedKeywords = useResumeEditorStore((s) => s.meta.excludedAtsKeywords ?? EMPTY_EXCLUDED_KEYWORDS)
  const setMeta = useResumeEditorStore((s) => s.setMeta)

  const [jobDescription, setJobDescription] = useState('')
  const [editingJd, setEditingJd] = useState(true)
  const [result, setResult] = useState<AtsScoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fixes, setFixes] = useState<AtsFix[]>([])
  const [fixStatus, setFixStatus] = useState<FixStatus>('idle')
  const [fixError, setFixError] = useState<string | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [appliedCount, setAppliedCount] = useState(0)

  const [semanticMatches, setSemanticMatches] = useState<string[]>([])
  const [semanticStatus, setSemanticStatus] = useState<SemanticStatus>('idle')
  const [matchedOpen, setMatchedOpen] = useState(false)

  // The JD keyword list and must/nice priorities an /ats-score response used,
  // re-sent on re-scores of the SAME job description (ignore toggles, synonym
  // check, re-check after edits) so the server skips another AI extraction.
  // Cleared on every fresh check so an edited job description is re-read.
  const [jdKeywords, setJdKeywords] = useState<string[]>([])
  const [keywordPriorities, setKeywordPriorities] = useState<Record<string, KeywordPriority>>({})
  // Which extractor read the job on the last fresh check. The basic (regex)
  // fallback is noisy, so the user is told when it was used and why.
  const [keywordSource, setKeywordSource] = useState<{ source: KeywordSource; reason?: FallbackReason }>({ source: 'ai' })

  // Pending applied->dismissed timeouts, keyed by fix id, so they can be
  // cleared on unmount instead of firing setState after unmount.
  const appliedTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  useEffect(() => {
    const timeouts = appliedTimeoutsRef.current
    return () => {
      timeouts.forEach((t) => clearTimeout(t))
      timeouts.clear()
    }
  }, [])

  interface ScoreOptions {
    excluded?: string[]
    semantic?: string[]
    cachedJdKeywords?: string[]
    cachedPriorities?: Record<string, KeywordPriority>
    /** Keep the generated fixes on screen (a re-score that is not a new job). */
    keepFixes?: boolean
  }

  async function score(opts: ScoreOptions = {}): Promise<AtsScoreResponse | null> {
    if (!resumeId || !jobDescription.trim()) return null
    setLoading(true)
    setError(null)
    if (!opts.keepFixes) {
      setFixes([])
      setFixStatus('idle')
      setDismissedIds(new Set())
      setAppliedCount(0)
    }
    const semantic = opts.semantic ?? []
    setSemanticMatches(semantic)
    try {
      // Every ATS route re-reads the CV from the database, so edits still in
      // the autosave debounce (an applied fix, a quick tweak in Edit) would be
      // scored as if they had never happened.
      await flushSave().catch(() => {})
      const res = await fetchWithTimeout(`/api/resumes/${resumeId}/ats-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription,
          excludedKeywords: opts.excluded ?? excludedKeywords,
          semanticMatches: semantic,
          jdKeywords: opts.cachedJdKeywords ?? [],
          keywordPriorities: opts.cachedPriorities ?? {},
        }),
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Analysis failed. Please try again.'))
      const json: AtsScoreResponse = await res.json()
      setResult(json)
      setJdKeywords(json.jdKeywords)
      setKeywordPriorities(json.keywordPriorities ?? {})
      if (json.keywordSource && json.keywordSource !== 'cached') {
        setKeywordSource({ source: json.keywordSource, reason: json.keywordFallbackReason })
      }
      return json
    } catch (err) {
      setError(requestErrorMessage(err, 'Analysis failed. Please try again.'))
      return null
    } finally {
      setLoading(false)
    }
  }

  async function runSynonymCheck(base: AtsScoreResponse) {
    if (!resumeId || base.missingKeywords.length === 0) return
    setSemanticStatus('loading')
    try {
      const res = await fetchWithTimeout(`/api/resumes/${resumeId}/ats-semantic-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missingKeywords: base.missingKeywords }),
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Synonym check failed.'))
      const { confirmedMatches } = (await res.json()) as { confirmedMatches: string[] }
      if (confirmedMatches.length > 0) {
        await score({
          semantic: confirmedMatches,
          cachedJdKeywords: base.jdKeywords,
          cachedPriorities: base.keywordPriorities ?? {},
        })
      }
      setSemanticMatches(confirmedMatches)
      setSemanticStatus('ready')
    } catch {
      setSemanticStatus('error')
    }
  }

  async function handleCheck() {
    setSemanticStatus('idle')
    setMatchedOpen(false)
    const json = await score()
    if (!json) return
    setEditingJd(false)
    await runSynonymCheck(json)
  }

  /** Same job, CV changed (fixes applied): re-score without re-reading the JD. */
  async function handleRecheck() {
    await score({ semantic: semanticMatches, cachedJdKeywords: jdKeywords, cachedPriorities: keywordPriorities })
  }

  function setIgnored(kw: string, ignored: boolean) {
    const next = ignored ? [...excludedKeywords, kw] : excludedKeywords.filter((k) => k !== kw)
    setMeta({ excludedAtsKeywords: next })
    if (jobDescription.trim()) {
      score({ excluded: next, semantic: semanticMatches, cachedJdKeywords: jdKeywords, cachedPriorities: keywordPriorities, keepFixes: true })
    }
  }

  async function handleGenerateFixes() {
    if (!resumeId || !result || result.missingKeywords.length === 0) return
    setFixStatus('loading')
    setFixError(null)
    setDismissedIds(new Set())
    setAppliedCount(0)
    try {
      await flushSave().catch(() => {})
      const res = await fetchWithTimeout(`/api/resumes/${resumeId}/ats-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missingKeywords: result.missingKeywords }),
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Could not generate suggestions. Please try again.'))
      setFixes(await res.json())
      setFixStatus('ready')
    } catch (err) {
      setFixError(requestErrorMessage(err, 'Could not generate suggestions. Please try again.'))
      setFixStatus('error')
    }
  }

  const applyFix = useCallback((fix: AtsFix) => {
    // Read the latest data, not the render's: Apply all runs several in a row.
    setData(applyAtsFixToResumeData(useResumeEditorStore.getState().data, fix))
    setAppliedCount((n) => n + 1)
    setAppliedIds((prev) => new Set(prev).add(fix.id))
    const timeoutId = setTimeout(() => {
      setDismissedIds((prev) => new Set(prev).add(fix.id))
      setAppliedIds((prev) => {
        const next = new Set(prev)
        next.delete(fix.id)
        return next
      })
      appliedTimeoutsRef.current.delete(fix.id)
    }, 1200)
    appliedTimeoutsRef.current.set(fix.id, timeoutId)
  }, [setData])

  const dismissFix = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id))
  }, [])

  // Bulk-apply only fixes with no unverified claims — anything flagged by the
  // hallucination guard still requires an individual, deliberate "Apply".
  const applyAll = useCallback(() => {
    const verified = fixes.filter((f) => !dismissedIds.has(f.id) && !appliedIds.has(f.id) && f.pendingApprovals.length === 0)
    for (const fix of verified) applyFix(fix)
  }, [fixes, dismissedIds, appliedIds, applyFix])

  const jdChars = jobDescription.trim().length
  const ignored = result ? [...result.excludedMissingKeywords, ...result.excludedMatchedKeywords] : []
  const missing = result ? sortByPriority(result.missingKeywords, keywordPriorities) : []
  const mustHave = missing.filter((k) => keywordPriorities[k] !== 'nice-to-have')
  const niceToHave = missing.filter((k) => keywordPriorities[k] === 'nice-to-have')
  const allFixesHandled = fixStatus === 'ready' && fixes.every((f) => dismissedIds.has(f.id))

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-5">
      {/* 1. Job description */}
      {editingJd || !result ? (
        <section aria-labelledby={`${ids}-jd`} className="space-y-3">
          <div>
            <h2 id={`${ids}-jd`} className="text-base font-medium text-fg-heading">Match your CV to a job</h2>
            <p className="mt-0.5 text-sm text-fg-muted">
              Paste the job description. You get a score based on how screening software reads your CV, and a list of what is missing.
            </p>
          </div>
          <label htmlFor={`${ids}-jd-input`} className="sr-only">Job description</label>
          <textarea
            id={`${ids}-jd-input`}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here, including requirements…"
            className={cn(inputClass, 'h-56 resize-y py-2 leading-relaxed')}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="md" onClick={handleCheck} disabled={loading || !jobDescription.trim()}>
              {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" /> : <ScanSearch aria-hidden="true" className="h-4 w-4" />}
              {loading ? 'Checking…' : 'Check match'}
            </Button>
            {result && (
              <Button size="md" variant="ghost" onClick={() => setEditingJd(false)} disabled={loading}>Cancel</Button>
            )}
            {!result && <span className="text-xs text-fg-subtle">Takes about 10 seconds</span>}
          </div>
          {error && <p role="alert" className="text-sm text-fg-danger">{error}</p>}
        </section>
      ) : (
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2">
          <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-fg-subtle" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-fg-heading">Job description</p>
            <p className="truncate text-xs text-fg-muted">{jdChars.toLocaleString()} characters · {result.jdKeywords.length} keywords found</p>
          </div>
          <Button size="xs" variant="ghost" onClick={() => setEditingJd(true)}>Change job</Button>
        </div>
      )}

      {result && !editingJd && (
        <>
          {/* 2. Score */}
          <section aria-label="ATS score" aria-busy={loading} className={cn('rounded-card border border-border bg-surface p-4 transition-opacity', loading && 'opacity-60')}>
            <div className="flex items-center gap-4">
              <ScoreRing score={result.total} />
              <div className="min-w-0">
                <p className={cn('text-base font-medium', TONE_TEXT[toneFor(result.total)])}>{verdict(result.total).label}</p>
                <p className="mt-0.5 text-sm text-fg-body">{verdict(result.total).line}</p>
                <Button size="xs" variant="ghost" onClick={handleRecheck} disabled={loading} className="-ml-2.5 mt-1">
                  <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                  {loading ? 'Re-checking…' : 'Re-check'}
                </Button>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border-subtle pt-4 sm:grid-cols-2">
              {VECTORS.map(({ key, label, hint, max }) => (
                <div key={key} title={hint}>
                  <div className="mb-1 flex justify-between text-xs">
                    <dt className="text-fg-body">{label}</dt>
                    <dd className="font-mono text-fg-muted">{result.breakdown[key]}/{max}</dd>
                  </div>
                  <Bar value={result.breakdown[key]} max={max} />
                </div>
              ))}
            </dl>
          </section>

          {semanticStatus === 'loading' && (
            <p role="status" className="flex items-center gap-2 px-1 text-xs text-fg-muted">
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-spin" />
              Checking whether your CV already covers missing keywords in other words…
            </p>
          )}
          {semanticStatus === 'ready' && semanticMatches.length > 0 && (
            <p role="status" className="flex items-center gap-2 px-1 text-xs text-fg-success">
              <Check aria-hidden="true" className="h-3.5 w-3.5" />
              {semanticMatches.length} {semanticMatches.length === 1 ? 'keyword is' : 'keywords are'} already covered in other words, and counted.
            </p>
          )}
          {semanticStatus === 'error' && (
            <p className="px-1 text-xs text-fg-muted">
              Couldn&apos;t check for synonyms.{' '}
              <button type="button" onClick={() => runSynonymCheck(result)} className="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Try again
              </button>
            </p>
          )}

          {/* 3. Gaps */}
          {missing.length > 0 ? (
            <section aria-labelledby={`${ids}-gaps`} className="rounded-card border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <h2 id={`${ids}-gaps`} className="text-sm font-medium text-fg-heading">Missing from your CV</h2>
                <span className="text-xs text-fg-muted">{missing.length} of {missing.length + result.matchedKeywords.length}</span>
              </div>
              {keywordSource.source === 'basic' && (
                <div role="note" className="mt-3 rounded-control border border-border-attention bg-surface-attention px-3 py-2 text-xs text-fg-attention">
                  <p>
                    Basic word matching was used because {FALLBACK_REASON[keywordSource.reason ?? 'ai-error']}. This list can include
                    generic words that are not real requirements. Ignore those with ×, or{' '}
                    <button
                      type="button"
                      onClick={() => { setEditingJd(false); handleCheck() }}
                      disabled={loading}
                      className="underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      check again
                    </button>
                    {' '}for an AI reading.
                  </p>
                </div>
              )}
              {mustHave.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs text-fg-muted">{keywordSource.source === 'basic' ? 'From the job description' : 'Required'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mustHave.map((kw) => (
                      <MissingChip key={kw} kw={kw} priority={keywordPriorities[kw] ?? 'ambiguous'} onIgnore={() => setIgnored(kw, true)} />
                    ))}
                  </div>
                </div>
              )}
              {niceToHave.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs text-fg-muted">Nice to have</p>
                  <div className="flex flex-wrap gap-1.5">
                    {niceToHave.map((kw) => (
                      <MissingChip key={kw} kw={kw} priority="nice-to-have" onIgnore={() => setIgnored(kw, true)} />
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs text-fg-muted">
                Don&apos;t have one of these? Press <X aria-label="the cross" className="inline h-3 w-3 align-[-2px]" /> on it. It stops counting against you and the AI won&apos;t add it.
              </p>

              {fixStatus === 'idle' || fixStatus === 'error' ? (
                <div className="mt-4 border-t border-border-subtle pt-4">
                  <Button size="md" onClick={handleGenerateFixes} className="w-full">
                    <Sparkles aria-hidden="true" className="h-4 w-4" />
                    Add missing keywords with AI
                  </Button>
                  <p className="mt-1.5 text-center text-xs text-fg-muted">
                    Suggests edits to your summary and bullets. Nothing changes until you apply it.
                  </p>
                  {fixError && <p role="alert" className="mt-2 text-center text-sm text-fg-danger">{fixError}</p>}
                </div>
              ) : null}
            </section>
          ) : (
            <section className="flex items-center gap-3 rounded-card border border-border-success bg-surface-success p-4">
              <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-fg-success" />
              <p className="text-sm text-fg-success">Your CV covers every keyword this job asks for.</p>
            </section>
          )}

          {/* 4. AI suggestions, reviewed in place */}
          {fixStatus === 'loading' && (
            <section aria-busy="true" className="space-y-2 rounded-card border border-border bg-surface p-4">
              <p className="flex items-center gap-2 text-sm text-fg-body">
                <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin text-primary" />
                Writing suggestions…
              </p>
              <div className="h-16 rounded-control bg-surface-subtle motion-safe:animate-pulse" />
              <div className="h-16 rounded-control bg-surface-subtle motion-safe:animate-pulse" />
            </section>
          )}
          {fixStatus === 'ready' && (
            <section aria-label="AI suggestions" className="space-y-3">
              {fixes.length > 0 && !allFixesHandled && (
                <AtsFixReviewPanel
                  fixes={fixes}
                  dismissedIds={dismissedIds}
                  appliedIds={appliedIds}
                  onApply={applyFix}
                  onDismiss={dismissFix}
                  onApplyAll={applyAll}
                  data={data}
                />
              )}
              {(fixes.length === 0 || allFixesHandled) && (
                <div className="rounded-card border border-border bg-surface p-4 text-center">
                  <p className="text-sm text-fg-body">
                    {fixes.length === 0
                      ? 'No safe edits found for these keywords. Add them to your experience yourself if they apply.'
                      : appliedCount > 0
                        ? `${appliedCount} ${appliedCount === 1 ? 'edit' : 'edits'} applied. Re-check to see your new score.`
                        : 'All suggestions skipped.'}
                  </p>
                  <div className="mt-3 flex justify-center gap-2">
                    {appliedCount > 0 && (
                      <Button size="sm" onClick={handleRecheck} disabled={loading}>
                        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                        Re-check score
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={handleGenerateFixes}>
                      <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                      Suggest again
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 5. Already covered, and anything the user chose to ignore */}
          {result.matchedKeywords.length > 0 && (
            <section className="rounded-card border border-border bg-surface">
              <button
                type="button"
                aria-expanded={matchedOpen}
                onClick={() => setMatchedOpen((v) => !v)}
                className="flex min-h-11 w-full items-center gap-2 rounded-card px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Check aria-hidden="true" className="h-4 w-4 text-fg-success" />
                <span className="flex-1 text-sm text-fg-heading">Already in your CV</span>
                <span className="text-xs text-fg-muted">{result.matchedKeywords.length}</span>
                <ChevronDown aria-hidden="true" className={cn('h-4 w-4 text-fg-subtle transition-transform', matchedOpen && 'rotate-180')} />
              </button>
              {matchedOpen && (
                <div className="flex flex-wrap gap-1.5 border-t border-border-subtle px-4 py-3">
                  {result.matchedKeywords.map((kw) => {
                    const semantic = semanticMatches.includes(kw)
                    return (
                      <span
                        key={kw}
                        title={semantic ? 'Covered by a synonym or related term in your CV' : undefined}
                        className={cn(CHIP, 'px-2.5', semantic ? 'border-border bg-surface-selected text-fg-body' : 'border-border-success bg-surface text-fg-success')}
                      >
                        {semantic && <span aria-hidden="true">≈</span>}
                        {kw}
                        {semantic && <span className="sr-only">(synonym match)</span>}
                      </span>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {ignored.length > 0 && (
            <section aria-labelledby={`${ids}-ignored`} className="px-1">
              <h2 id={`${ids}-ignored`} className="mb-1.5 text-xs text-fg-muted">Ignored ({ignored.length})</h2>
              <div className="flex flex-wrap gap-1.5">
                {ignored.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => setIgnored(kw, false)}
                    aria-label={`Count "${kw}" again`}
                    title="Count this keyword again"
                    className={cn(CHIP, 'border-border bg-surface-subtle px-2.5 text-fg-muted line-through hover:text-fg-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
