'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Check, CheckCheck } from 'lucide-react'
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
  if (fix.section === 'summary') return 'Summary'

  const job = fix.workIndex !== undefined ? data?.work?.[fix.workIndex] : undefined
  const position = fix.roleIndex !== undefined ? job?.roles?.[fix.roleIndex]?.position : job?.position
  const company = job?.name

  if (position && company) return `${position} at ${company}`
  if (position) return position
  if (company) return company
  return 'Work experience'
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
  const applyAllDisabled = verifiedCount === 0
  const groups = groupFixesByRecord(visible, data)

  if (visible.length === 0) {
    return (
      <div className="rounded-card border border-border-success bg-surface-success p-4 text-center">
        <p className="text-sm font-medium text-fg-success">All suggestions applied or skipped.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fg-heading">
            {visible.length} suggested {visible.length === 1 ? 'edit' : 'edits'}
          </p>
          <p className="text-xs text-fg-muted">Added words are highlighted. Review, then apply.</p>
        </div>
        <Button
          size="sm"
          onClick={onApplyAll}
          disabled={applyAllDisabled}
          aria-describedby={applyAllDisabled ? 'apply-all-reason' : undefined}
          title={
            verifiedCount < visible.length
              ? 'Edits with unverified figures are skipped - apply those individually after checking them'
              : undefined
          }
        >
          <CheckCheck aria-hidden="true" className="h-4 w-4" />
          Apply All Verified{verifiedCount < visible.length ? ` (${verifiedCount})` : ''}
        </Button>
      </div>
      {/* A disabled Button has pointer-events-none, so its title never shows; say it in text. */}
      {applyAllDisabled && (
        <p id="apply-all-reason" className="text-xs text-fg-muted">
          No edit is verified yet. Check the unverified figures and apply those edits individually.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <p className="text-xs text-fg-muted">{group.label}</p>
          {group.fixes.map((fix) => (
            resolvedAppliedIds.has(fix.id) ? (
              <div
                key={fix.id}
                role="status"
                className="flex items-center justify-between rounded-card border border-border-success bg-surface-success px-4 py-3"
              >
                <span className="text-sm text-fg-success">{fix.targetKeywords.join(', ') || 'Edit'}</span>
                <span className="flex items-center gap-1 text-xs font-medium text-fg-success">
                  <Check aria-hidden="true" className="h-3.5 w-3.5" /> Applied
                </span>
              </div>
            ) : (
            <article
              key={fix.id}
              className="space-y-3 rounded-card border border-border bg-surface p-4"
            >
              {fix.targetKeywords.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-xs text-fg-subtle">Adds</span>
                  {fix.targetKeywords.map((kw) => (
                    <Badge key={kw} className="rounded-full">
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}

              {fix.kind === 'generate' ? (
                <div>
                  <p className="mb-1 text-xs text-fg-muted">New professional summary</p>
                  <p className="text-sm leading-relaxed text-fg-heading">{fix.suggested}</p>
                </div>
              ) : (
                (() => {
                  const { before, after } = diffWords(fix.original, fix.suggested)
                  return (
                    <div className="space-y-2 text-sm">
                      <p className="leading-relaxed text-fg-heading">
                        <span className="sr-only">After: </span>
                        {after.map((seg, i) =>
                          seg.changed ? (
                            <mark key={i} className="rounded-chip bg-surface-success px-0.5 text-fg-success">{seg.text}</mark>
                          ) : (
                            <span key={i}>{seg.text}</span>
                          )
                        )}
                      </p>
                      <p className="border-l-2 border-border pl-2 text-xs leading-relaxed text-fg-muted">
                        <span className="mr-1 text-fg-subtle">Was:</span>
                        {before.map((seg, i) =>
                          seg.changed ? (
                            <del key={i} className="text-fg-danger">{seg.text}</del>
                          ) : (
                            <span key={i}>{seg.text}</span>
                          )
                        )}
                      </p>
                    </div>
                  )
                })()
              )}

              {fix.pendingApprovals.length > 0 && (
                <div className="rounded-control border border-border-attention bg-surface-attention px-3 py-2">
                  <p className="mb-1 text-xs font-medium text-fg-attention">
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

              <div className="flex gap-2">
                <Button size="xs" onClick={() => onApply(fix)}>
                  Apply
                </Button>
                <Button size="xs" variant="ghost" onClick={() => onDismiss(fix.id)}>
                  Skip
                </Button>
              </div>
            </article>
            )
          ))}
        </div>
      ))}
    </div>
  )
}
