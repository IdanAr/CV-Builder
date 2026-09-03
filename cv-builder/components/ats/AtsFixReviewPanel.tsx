'use client'

import type { AtsFix } from '@/lib/ai/ats-fix-pipeline'
import { diffWords } from '@/lib/text-diff'
import type { ResumeData } from '@/lib/schemas/resume.zod'

interface AtsFixReviewPanelProps {
  fixes: AtsFix[]
  dismissedIds: Set<string>
  onApply: (fix: AtsFix) => void
  onDismiss: (id: string) => void
  onApplyAll: () => void
  /** Used to label each fix with the section/record it targets (e.g. "Work Experience Section - Frontend Engineer at Acme Corp"). Omit to skip labeling. */
  data?: ResumeData
  /** Fix ids currently showing the transient "✓ Applied" confirmation instead of the full edit card. */
  appliedIds?: Set<string>
}

interface FixGroup {
  key: string
  label: string
  fixes: AtsFix[]
}

/**
 * Groups fixes by the section/record they target so multiple edits to the
 * same job (e.g. two rewritten bullets) render under one heading instead of
 * repeating it per fix. Order follows first appearance in `fixes`.
 */
function groupFixesByRecord(fixes: AtsFix[], data: ResumeData | undefined): FixGroup[] {
  const groups: FixGroup[] = []
  const indexByKey = new Map<string, number>()

  for (const fix of fixes) {
    const key = fix.section === 'summary'
      ? 'summary'
      : `work-${fix.workIndex}-${fix.roleIndex ?? 'legacy'}`

    let idx = indexByKey.get(key)
    if (idx === undefined) {
      idx = groups.length
      indexByKey.set(key, idx)
      groups.push({ key, label: getRecordLabel(fix, data), fixes: [] })
    }
    groups[idx].fixes.push(fix)
  }

  return groups
}

function getRecordLabel(fix: AtsFix, data: ResumeData | undefined): string {
  if (fix.section === 'summary') return 'Summary Section'

  const job = fix.workIndex !== undefined ? data?.work?.[fix.workIndex] : undefined
  const position = fix.roleIndex !== undefined ? job?.roles?.[fix.roleIndex]?.position : job?.position
  const company = job?.name

  if (position && company) return `Work Experience Section - ${position} at ${company}`
  if (position) return `Work Experience Section - ${position}`
  if (company) return `Work Experience Section - ${company}`
  return 'Work Experience Section'
}

const EMPTY_APPLIED_IDS: Set<string> = new Set()

export function AtsFixReviewPanel({
  fixes,
  dismissedIds,
  onApply,
  onDismiss,
  onApplyAll,
  data,
  appliedIds,
}: AtsFixReviewPanelProps) {
  const resolvedAppliedIds = appliedIds ?? EMPTY_APPLIED_IDS
  const visible = fixes.filter((f) => !dismissedIds.has(f.id))
  const verifiedCount = visible.filter((f) => f.pendingApprovals.length === 0).length
  const groups = groupFixesByRecord(visible, data)

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-sm text-green-700 font-medium">All fixes applied or dismissed.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-indigo-900">
          {visible.length} suggested {visible.length === 1 ? 'fix' : 'fixes'}
        </p>
        <button
          onClick={onApplyAll}
          disabled={verifiedCount === 0}
          title={
            verifiedCount < visible.length
              ? 'Fixes with unverified figures are skipped - apply those individually after checking them'
              : undefined
          }
          className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          Apply All Verified{verifiedCount < visible.length ? ` (${verifiedCount})` : ''}
        </button>
      </div>

      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
            {group.label}
          </p>
          {group.fixes.map((fix) => (
            resolvedAppliedIds.has(fix.id) ? (
              <div
                key={fix.id}
                className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center justify-between"
              >
                <span className="text-sm text-green-800">{fix.targetKeywords.join(', ') || 'Fix'}</span>
                <span className="text-xs font-semibold text-green-700">✓ Applied</span>
              </div>
            ) : (
            <div
              key={fix.id}
              className="rounded-xl border border-indigo-100 bg-white/80 backdrop-blur-sm p-4 shadow-sm space-y-2"
            >
              {fix.targetKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {fix.targetKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {fix.kind === 'generate' ? (
                <div className="text-sm">
                  <div className="rounded bg-green-50 border border-green-100 px-3 py-2">
                    <p className="text-xs text-green-600 font-medium mb-0.5">New professional summary</p>
                    <p className="text-green-900 leading-relaxed">{fix.suggested}</p>
                  </div>
                </div>
              ) : (
                (() => {
                  const { before, after } = diffWords(fix.original, fix.suggested)
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="rounded bg-red-50 border border-red-100 px-3 py-2">
                        <p className="text-xs text-fg-danger font-medium mb-0.5">Before</p>
                        <p className="text-gray-700 leading-relaxed">
                          {before.map((seg, i) =>
                            seg.changed ? (
                              <span key={i} className="line-through text-red-700 bg-red-100 rounded-sm">{seg.text}</span>
                            ) : (
                              <span key={i}>{seg.text}</span>
                            )
                          )}
                        </p>
                      </div>
                      <div className="rounded bg-green-50 border border-green-100 px-3 py-2">
                        <p className="text-xs text-green-600 font-medium mb-0.5">After</p>
                        <p className="text-gray-700 leading-relaxed">
                          {after.map((seg, i) =>
                            seg.changed ? (
                              <span key={i} className="font-semibold text-green-800 bg-green-100 rounded-sm">{seg.text}</span>
                            ) : (
                              <span key={i}>{seg.text}</span>
                            )
                          )}
                        </p>
                      </div>
                    </div>
                  )
                })()
              )}

              {fix.pendingApprovals.length > 0 && (
                <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="text-xs text-amber-700 font-medium mb-1">
                    Contains figures not in your original text - verify before applying:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {fix.pendingApprovals.map((claim) => (
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

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onApply(fix)}
                  className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={() => onDismiss(fix.id)}
                  className="px-3 py-1 text-xs text-fg-muted hover:text-fg-body transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
            )
          ))}
        </div>
      ))}
    </div>
  )
}
