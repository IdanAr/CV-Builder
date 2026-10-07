'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
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
      <div className="rounded-card border border-border-success bg-surface-success p-4 text-center">
        <p className="text-sm font-medium text-fg-success">All fixes applied or dismissed.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-fg-heading">
          {visible.length} suggested {visible.length === 1 ? 'fix' : 'fixes'}
        </p>
        <Button
          size="xs"
          onClick={onApplyAll}
          disabled={verifiedCount === 0}
          title={
            verifiedCount < visible.length
              ? 'Fixes with unverified figures are skipped - apply those individually after checking them'
              : undefined
          }
        >
          Apply All Verified{verifiedCount < visible.length ? ` (${verifiedCount})` : ''}
        </Button>
      </div>

      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <p className="text-xs font-medium text-fg-muted uppercase tracking-wide">
            {group.label}
          </p>
          {group.fixes.map((fix) => (
            resolvedAppliedIds.has(fix.id) ? (
              <div
                key={fix.id}
                className="rounded-card border border-border-success bg-surface-success px-4 py-3 flex items-center justify-between"
              >
                <span className="text-sm text-fg-success">{fix.targetKeywords.join(', ') || 'Fix'}</span>
                <span className="text-xs font-medium text-fg-success">✓ Applied</span>
              </div>
            ) : (
            <div
              key={fix.id}
              className="rounded-card border border-border bg-surface p-4 space-y-2"
            >
              {fix.targetKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {fix.targetKeywords.map((kw) => (
                    <Badge key={kw} className="rounded-full">
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}

              {fix.kind === 'generate' ? (
                <div className="text-sm">
                  <div className="rounded-card border border-border bg-surface-success px-3 py-2">
                    <p className="mb-0.5 text-xs font-medium text-fg-success">New professional summary</p>
                    <p className="text-fg-heading leading-relaxed">{fix.suggested}</p>
                  </div>
                </div>
              ) : (
                (() => {
                  const { before, after } = diffWords(fix.original, fix.suggested)
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="rounded-card border border-border bg-surface-danger px-3 py-2">
                        <p className="text-xs text-fg-danger font-medium mb-0.5">Before</p>
                        <p className="text-fg-body leading-relaxed">
                          {before.map((seg, i) =>
                            seg.changed ? (
                              <span key={i} className="line-through text-fg-danger bg-surface rounded-chip px-0.5">{seg.text}</span>
                            ) : (
                              <span key={i}>{seg.text}</span>
                            )
                          )}
                        </p>
                      </div>
                      <div className="rounded-card border border-border bg-surface-success px-3 py-2">
                        <p className="mb-0.5 text-xs font-medium text-fg-success">After</p>
                        <p className="text-fg-body leading-relaxed">
                          {after.map((seg, i) =>
                            seg.changed ? (
                              <span key={i} className="font-medium underline text-fg-success bg-surface rounded-chip px-0.5">{seg.text}</span>
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
                <div className="rounded-card border border-border-warning bg-surface-warning px-3 py-2">
                  <p className="mb-1 text-xs font-medium text-fg-warning">
                    Contains figures not in your original text - verify before applying:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {fix.pendingApprovals.map((claim) => (
                      <Badge key={claim} tone="attention" className="rounded-full border border-border-attention">
                        {claim}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button size="xs" onClick={() => onApply(fix)}>
                  Apply
                </Button>
                <Button size="xs" variant="ghost" onClick={() => onDismiss(fix.id)}>
                  Dismiss
                </Button>
              </div>
            </div>
            )
          ))}
        </div>
      ))}
    </div>
  )
}
