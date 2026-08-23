'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import type { AtsScoreResult } from '@/lib/ats/scorer'
import type { AtsFix } from '@/lib/ai/ats-fix-pipeline'
import { applyAtsFixToResumeData } from '@/lib/ai/apply-ats-fix'
import type { KeywordPriority } from '@/lib/ai/jd-extraction-pipeline'
import { AtsFixReviewPanel } from './AtsFixReviewPanel'
import { Popover } from '@/components/ui/Popover'
import { StepsBar, type WizardStep } from './StepsBar'

// /ats-score merges keywordPriorities onto AtsScoreResult rather than
// widening that interface (see the route) — this is the richer shape the
// client actually receives.
type AtsScoreResponse = AtsScoreResult & { keywordPriorities?: Record<string, KeywordPriority> }

const VECTOR_LABELS: { key: keyof AtsScoreResult['breakdown']; label: string; max: number }[] = [
  { key: 'format', label: 'Format & Structure', max: 25 },
  { key: 'keywordDensity', label: 'Keyword Coverage', max: 35 },
  { key: 'keywordPlacement', label: 'Keyword Placement', max: 25 },
  { key: 'metrics', label: 'Metric Presence', max: 15 },
]

function getScoreStatusLabel(score: number): { colorClass: string; pillClass: string; label: string } {
  if (score >= 70) {
    return { colorClass: 'text-green-600', pillClass: 'bg-green-100 text-green-700', label: 'Good match' }
  } else if (score >= 40) {
    return { colorClass: 'text-yellow-500', pillClass: 'bg-yellow-100 text-yellow-800', label: 'Needs work' }
  } else {
    return { colorClass: 'text-red-500', pillClass: 'bg-red-100 text-red-700', label: 'Poor match' }
  }
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

function ScoreBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="h-2 w-full rounded-full bg-indigo-100">
      <div
        className={`h-2 rounded-full transition-all duration-300 ${
          pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

type FixStatus = 'idle' | 'loading' | 'ready' | 'error'

const EMPTY_EXCLUDED_KEYWORDS: string[] = []

export function AtsScorePanel() {
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const data = useResumeEditorStore((s) => s.data)
  const setData = useResumeEditorStore((s) => s.setData)
  const excludedKeywords = useResumeEditorStore((s) => s.meta.excludedAtsKeywords ?? EMPTY_EXCLUDED_KEYWORDS)
  const setMeta = useResumeEditorStore((s) => s.setMeta)

  const [jobDescription, setJobDescription] = useState('')
  const [result, setResult] = useState<AtsScoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fixes, setFixes] = useState<AtsFix[]>([])
  const [fixStatus, setFixStatus] = useState<FixStatus>('idle')
  const [fixError, setFixError] = useState<string | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())

  const [semanticMatches, setSemanticMatches] = useState<string[]>([])
  const [semanticStatus, setSemanticStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [semanticError, setSemanticError] = useState<string | null>(null)
  const [hasTriedSemanticThisAnalysis, setHasTriedSemanticThisAnalysis] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  // The JD keyword list an /ats-score response actually used (AI-extracted
  // or regex-fallback) — re-sent on subsequent re-scores of the SAME job
  // description (exclude toggles, semantic-match re-analyze) so the server
  // reuses it instead of paying for another AI extraction. Cleared on every
  // fresh Analyze click so an edited job description gets fresh extraction.
  const [jdKeywords, setJdKeywords] = useState<string[]>([])

  // Which missing keywords are must-have vs nice-to-have, per the JD's own
  // wording (Claude reads qualifiers like "Must", "Nice to have" directly).
  // Cached and re-sent alongside jdKeywords for the same caching reason —
  // an absent entry is treated as "ambiguous" (colored the same as
  // must-have, per the product decision to err toward not hiding a
  // possibly-important requirement).
  const [keywordPriorities, setKeywordPriorities] = useState<Record<string, KeywordPriority>>({})

  // Wizard navigation. `currentStep` is which step is visible; `maxUnlockedStep`
  // only ever increases and gates which StepsBar segments are clickable —
  // going Back never re-locks a step, only a fresh Analyze can produce a
  // smaller result set, and even then already-unlocked steps stay reachable.
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [maxUnlockedStep, setMaxUnlockedStep] = useState<WizardStep>(1)

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

  async function handleAnalyze(
    excludedOverride?: string[],
    semanticOverride?: string[],
    jdKeywordsOverride?: string[],
    keywordPrioritiesOverride?: Record<string, KeywordPriority>
  ) {
    if (!resumeId || !jobDescription.trim()) return
    setLoading(true)
    setError(null)
    setFixes([])
    setFixStatus('idle')
    setDismissedIds(new Set())
    const semantic = semanticOverride ?? []
    setSemanticMatches(semantic)
    if (semanticOverride === undefined) {
      setSemanticStatus('idle')
      setSemanticError(null)
      setHasTriedSemanticThisAnalysis(false)
    }
    const cachedJdKeywords = jdKeywordsOverride ?? []
    const cachedKeywordPriorities = keywordPrioritiesOverride ?? {}
    try {
      const res = await fetch(`/api/resumes/${resumeId}/ats-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription,
          excludedKeywords: excludedOverride ?? excludedKeywords,
          semanticMatches: semantic,
          jdKeywords: cachedJdKeywords,
          keywordPriorities: cachedKeywordPriorities,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Analysis failed. Please try again.')
      }
      const json: AtsScoreResponse = await res.json()
      setResult(json)
      setJdKeywords(json.jdKeywords)
      setKeywordPriorities(json.keywordPriorities ?? {})
      setMaxUnlockedStep((prev) => {
        const reached: WizardStep = json.missingKeywords.length === 0 ? 3 : 2
        return reached > prev ? reached : prev
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function toggleExcluded(kw: string) {
    const next = excludedKeywords.includes(kw)
      ? excludedKeywords.filter((k) => k !== kw)
      : [...excludedKeywords, kw]
    setMeta({ excludedAtsKeywords: next })
    if (jobDescription.trim()) {
      handleAnalyze(next, semanticMatches, jdKeywords, keywordPriorities)
    }
  }

  async function handleFixAll() {
    if (!resumeId || !result || result.missingKeywords.length === 0) return
    setFixStatus('loading')
    setFixError(null)
    setDismissedIds(new Set())
    try {
      const res = await fetch(`/api/resumes/${resumeId}/ats-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missingKeywords: result.missingKeywords }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Could not generate fixes. Please try again.')
      }
      const fetchedFixes: AtsFix[] = await res.json()
      setFixes(fetchedFixes)
      setFixStatus('ready')
      setMaxUnlockedStep((prev) => (prev < 3 ? 3 : prev))
    } catch (err) {
      setFixError(err instanceof Error ? err.message : 'Could not generate fixes. Please try again.')
      setFixStatus('error')
    }
  }

  async function handleSemanticMatch() {
    if (!resumeId || !result || result.missingKeywords.length === 0) return
    setSemanticStatus('loading')
    setSemanticError(null)
    setHasTriedSemanticThisAnalysis(true)
    try {
      const res = await fetch(`/api/resumes/${resumeId}/ats-semantic-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missingKeywords: result.missingKeywords }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Semantic match failed. Please try again.')
      }
      const { confirmedMatches } = await res.json()
      await handleAnalyze(excludedKeywords, confirmedMatches, jdKeywords, keywordPriorities)
      setSemanticStatus('ready')
    } catch (err) {
      setSemanticError(err instanceof Error ? err.message : 'Semantic match failed. Please try again.')
      setSemanticStatus('error')
    }
  }

  const applyFix = useCallback((fix: AtsFix) => {
    setData(applyAtsFixToResumeData(data, fix))
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
  }, [data, setData])

  const dismissFix = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id))
  }, [])

  // Bulk-apply only fixes with no unverified claims — anything flagged by the
  // hallucination guard still requires an individual, deliberate "Apply".
  const applyAll = useCallback(() => {
    const visible = fixes.filter((f) => !dismissedIds.has(f.id) && f.pendingApprovals.length === 0)
    for (const fix of visible) {
      applyFix(fix)
    }
  }, [fixes, dismissedIds, applyFix])

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <StepsBar current={currentStep} maxUnlocked={maxUnlockedStep} onStepClick={setCurrentStep} />

      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-indigo-700 mb-1">
              Paste job description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here to see how well your CV matches…"
              className="w-full h-[312px] rounded-lg border border-indigo-200 bg-white/70 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => handleAnalyze()}
              disabled={loading || !jobDescription.trim()}
              className="mt-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>

          {result && (
            <>
              <div className="rounded-xl border border-white/30 bg-white/60 backdrop-blur-xl p-6 text-center shadow-lg">
                <p className="text-sm text-indigo-600 mb-1">ATS Score</p>
                {(() => {
                  const { colorClass, pillClass, label } = getScoreStatusLabel(result.total)
                  return (
                    <div className="flex items-baseline justify-center gap-3">
                      <p className={`text-6xl font-bold ${colorClass}`}>
                        {result.total}
                        <span className="text-2xl font-medium text-indigo-300">/100</span>
                      </p>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${pillClass}`}>
                        {label}
                      </span>
                    </div>
                  )
                })()}
              </div>

              <div className="rounded-xl border border-white/30 bg-white/60 backdrop-blur-xl p-4 shadow-lg space-y-3">
                <p className="text-sm font-semibold text-indigo-900">Score Breakdown</p>
                {VECTOR_LABELS.map(({ key, label, max }) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-indigo-600 mb-1">
                      <span>{label}</span>
                      <span className="font-medium">{result.breakdown[key]} / {max}</span>
                    </div>
                    <ScoreBar value={result.breakdown[key]} max={max} />
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setCurrentStep(2)}
                  disabled={maxUnlockedStep < 2}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  Next: Close the Gap →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {currentStep === 2 && result && (
        <div className="space-y-4">
          <p className="text-xs font-medium text-indigo-500">
            ✅ {result.matchedKeywords.length + result.excludedMatchedKeywords.length} matched
            &nbsp;·&nbsp; ⚠️ {result.missingKeywords.length} missing
          </p>

          {(result.missingKeywords.length > 0 || result.excludedMissingKeywords.length > 0) && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-red-700">
                  Missing Keywords ({result.missingKeywords.length})
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {semanticStatus !== 'ready' && (
                    <button
                      onClick={handleSemanticMatch}
                      disabled={semanticStatus === 'loading'}
                      className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {semanticStatus === 'loading' ? (
                        <>
                          <span className="animate-spin inline-block">⟳</span>
                          Checking…
                        </>
                      ) : (
                        <>🔎 Semantic Match</>
                      )}
                    </button>
                  )}
                  {fixStatus !== 'ready' && (
                    <button
                      onClick={handleFixAll}
                      disabled={fixStatus === 'loading'}
                      className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {fixStatus === 'loading' ? (
                        <>
                          <span className="animate-spin inline-block">⟳</span>
                          Generating…
                        </>
                      ) : (
                        <>✨ Tailor with AI</>
                      )}
                    </button>
                  )}
                  <Popover
                    open={helpOpen}
                    onOpenChange={setHelpOpen}
                    trigger={
                      <button
                        type="button"
                        onClick={() => setHelpOpen((o) => !o)}
                        aria-expanded={helpOpen}
                        aria-haspopup="dialog"
                        aria-label="What do Semantic Match and Tailor with AI do?"
                        className="flex items-center justify-center h-11 w-11 shrink-0 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold hover:bg-indigo-200 transition-colors"
                      >
                        ?
                      </button>
                    }
                  >
                    <div
                      role="dialog"
                      aria-label="About Semantic Match and Tailor with AI"
                      className="w-72 rounded-xl border border-white/40 bg-white/95 p-4 shadow-xl backdrop-blur-xl space-y-3 text-left"
                    >
                      <div>
                        <p className="text-xs font-semibold text-teal-700 mb-0.5">🔎 Semantic Match</p>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          AI checks whether your resume already covers a missing keyword through a synonym or related term (e.g. &quot;k8s&quot; counts for &quot;Kubernetes&quot;) — it doesn&apos;t rewrite anything.
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-indigo-700 mb-0.5">✨ Tailor with AI</p>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          AI rewrites your summary and bullet points to naturally work in the missing keywords — you review and approve each suggested change before it&apos;s applied.
                        </p>
                      </div>
                    </div>
                  </Popover>
                </div>
              </div>

              {!hasTriedSemanticThisAnalysis && semanticStatus !== 'ready' && (
                <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-800">
                    💡 Try Semantic Match first — it can clear keywords you already cover before spending an AI rewrite on them.
                  </p>
                </div>
              )}

              {semanticError && (
                <p className="mb-2 text-xs text-red-700">{semanticError}</p>
              )}

              <p className="mb-1 text-xs text-red-700">
                Click a keyword you don&apos;t have to ignore it — the AI tools above will skip it too.
              </p>
              <p className="mb-2 text-xs text-indigo-600">
                <span className="text-red-700">●</span> must-have / unclear&nbsp;&nbsp;
                <span className="text-yellow-800">●</span> nice-to-have
              </p>

              <div className="flex flex-wrap gap-1">
                {[
                  ...sortByPriority(result.missingKeywords, keywordPriorities).map((kw) => ({ kw, excluded: false })),
                  ...result.excludedMissingKeywords.map((kw) => ({ kw, excluded: true })),
                ].slice(0, 40).map(({ kw, excluded }) => {
                  const priority = keywordPriorities[kw] ?? 'ambiguous'
                  const isNiceToHave = priority === 'nice-to-have'
                  return (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => toggleExcluded(kw)}
                    aria-label={excluded ? `Include "${kw}" in scoring` : `Exclude "${kw}" from scoring`}
                    title={
                      excluded
                        ? undefined
                        : priority === 'must'
                        ? 'Must-have requirement'
                        : priority === 'nice-to-have'
                        ? 'Nice-to-have requirement'
                        : 'Requirement level unclear from the job description'
                    }
                    className={
                      excluded
                        ? 'inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-400 line-through hover:bg-gray-200 transition-colors'
                        : isNiceToHave
                        ? 'inline-block rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800 hover:bg-yellow-200 transition-colors'
                        : 'inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 hover:bg-red-200 transition-colors'
                    }
                  >
                    {kw}
                  </button>
                  )
                })}
                {result.missingKeywords.length + result.excludedMissingKeywords.length > 40 && (
                  <span className="text-xs text-red-700 self-center">
                    +{result.missingKeywords.length + result.excludedMissingKeywords.length - 40} more
                  </span>
                )}
              </div>

              {fixError && (
                <p className="mt-2 text-xs text-red-700">{fixError}</p>
              )}
            </div>
          )}

          {(result.matchedKeywords.length > 0 || result.excludedMatchedKeywords.length > 0) && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
              <p className="text-sm font-semibold text-green-700 mb-2">
                Matched Keywords ({result.matchedKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {[
                  ...result.matchedKeywords.map((kw) => ({ kw, excluded: false, semantic: semanticMatches.includes(kw) })),
                  ...result.excludedMatchedKeywords.map((kw) => ({ kw, excluded: true, semantic: false })),
                ].slice(0, 40).map(({ kw, excluded, semantic }) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => toggleExcluded(kw)}
                    aria-label={excluded ? `Include "${kw}" in scoring` : `Exclude "${kw}" from scoring`}
                    title={semantic ? 'Matched via AI semantic analysis (not an exact keyword match)' : undefined}
                    className={
                      excluded
                        ? 'inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-400 line-through hover:bg-gray-200 transition-colors'
                        : semantic
                        ? 'inline-block rounded bg-teal-100 px-2 py-0.5 text-xs text-teal-700 hover:bg-teal-200 transition-colors'
                        : 'inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 hover:bg-green-200 transition-colors'
                    }
                  >
                    {kw}
                  </button>
                ))}
                {result.matchedKeywords.length + result.excludedMatchedKeywords.length > 40 && (
                  <span className="text-xs text-green-500 self-center">
                    +{result.matchedKeywords.length + result.excludedMatchedKeywords.length - 40} more
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 text-sm rounded-lg hover:bg-indigo-200 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              disabled={maxUnlockedStep < 3}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Next: Review &amp; Apply →
            </button>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-4">
          {result && result.missingKeywords.length === 0 && result.excludedMissingKeywords.length === 0 ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
              <p className="text-sm text-green-700 font-medium">Nothing to fix — great match!</p>
            </div>
          ) : fixStatus === 'idle' ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-6 text-center">
              <p className="text-sm text-indigo-600">
                Head back to Close the Gap and run Tailor with AI to see suggestions here.
              </p>
            </div>
          ) : fixStatus === 'loading' ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-6 text-center">
              <p className="text-sm text-indigo-600">
                <span className="animate-spin inline-block mr-1">⟳</span>
                Generating fixes…
              </p>
            </div>
          ) : fixStatus === 'error' ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center space-y-2">
              <p className="text-sm text-red-700">{fixError}</p>
              <button
                onClick={handleFixAll}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 text-sm rounded-lg hover:bg-indigo-200 transition-colors"
              >
                ↻ Try again
              </button>
            </div>
          ) : (
            <>
              {fixes.length > 0 ? (
                <AtsFixReviewPanel
                  fixes={fixes}
                  dismissedIds={dismissedIds}
                  appliedIds={appliedIds}
                  onApply={applyFix}
                  onDismiss={dismissFix}
                  onApplyAll={applyAll}
                  data={data}
                />
              ) : (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-center">
                  <p className="text-sm text-indigo-600">
                    No specific fixes found — try re-analyzing after updating your highlights.
                  </p>
                </div>
              )}
              {(fixes.length === 0 || fixes.every((f) => dismissedIds.has(f.id))) && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-center mt-4">
                  <p className="text-sm text-indigo-600 mb-2">Want another pass?</p>
                  <button
                    onClick={handleFixAll}
                    className="px-4 py-2 bg-indigo-100 text-indigo-700 text-sm rounded-lg hover:bg-indigo-200 transition-colors"
                  >
                    ↻ Regenerate fixes
                  </button>
                </div>
              )}
            </>
          )}

          <div className="flex justify-start">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 text-sm rounded-lg hover:bg-indigo-200 transition-colors"
            >
              ← Back to Close the Gap
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
