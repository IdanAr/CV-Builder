'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, ExternalLink, MoreVertical } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonClasses, type ButtonVariant } from '@/components/ui/Button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu'
import { planActions, type JobActionId } from '@/lib/jobsearch/job-actions'
import type { PipelineJob } from '@/lib/jobsearch/pipeline-types'
import { FILTER_LABELS } from '@/lib/jobsearch/stages'
import { FitScore } from './FitScore'

export const ACTION_LABELS: Record<JobActionId, string> = {
  'open-posting': 'Open posting',
  track: 'Track',
  dismiss: 'Dismiss',
  approve: 'Approve flagged claims',
  'open-cv': 'Open tailored CV',
  'mark-applied': 'Mark as applied',
  'open-applications': 'Open in Applications',
  restore: 'Restore',
  'find-again': 'Find again',
  delete: 'Delete',
}

interface JobDetailProps {
  job: PipelineJob | null
  busy: boolean
  onAction(action: JobActionId, job: PipelineJob): void
  /** Shown below lg only. */
  onBack(): void
}

/** open-posting / open-cv / open-applications are real destinations, so they are anchors. */
function hrefFor(action: JobActionId, job: PipelineJob): { href: string; external: boolean } | null {
  switch (action) {
    case 'open-posting':
      return job.url ? { href: job.url, external: true } : null
    case 'open-cv':
      return job.draftResumeId ? { href: `/dashboard/resumes/${job.draftResumeId}`, external: false } : null
    case 'open-applications':
      return { href: '/dashboard/applications', external: false }
    default:
      return null
  }
}

function ActionControl({
  action, job, variant, busy, onAction,
}: {
  action: JobActionId
  job: PipelineJob
  variant: ButtonVariant
  busy: boolean
  onAction: JobDetailProps['onAction']
}) {
  const label = ACTION_LABELS[action]
  const target = hrefFor(action, job)
  if (target) {
    // Opening a link does not conflict with an in-flight request, so links stay live while busy.
    const className = buttonClasses({ variant, size: 'md', className: 'sm:min-h-8' })
    if (target.external) {
      return (
        <a
          href={target.href}
          target="_blank"
          rel="noreferrer"
          className={className}
        >
          {label}
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      )
    }
    return (
      <Link href={target.href} className={className}>
        {label}
      </Link>
    )
  }
  return (
    <Button variant={variant} size="md" className="sm:min-h-8" disabled={busy} onClick={() => onAction(action, job)}>
      {label}
    </Button>
  )
}

export function JobDetail({ job, busy, onAction, onBack }: JobDetailProps) {
  if (!job) {
    return (
      <p className="rounded-card border border-dashed border-border px-4 py-8 text-center text-sm text-fg-subtle">
        Select a job to see its details.
      </p>
    )
  }

  const plan = planActions(job)
  const meta = [job.company, job.location, job.profileName].filter(Boolean).join(' · ')
  const showTailored = job.postTailorScore !== undefined && job.postTailorScore !== job.atsScore

  return (
    <section aria-label="Job details" className="space-y-4 rounded-card border border-border bg-surface p-4">
      <Button variant="ghost" size="md" className="-ml-2 sm:min-h-8 lg:hidden" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to list
      </Button>

      <header className="space-y-2">
        <h2
          tabIndex={-1}
          data-job-detail-heading=""
          className="text-lg font-semibold text-fg-body focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {job.title}
        </h2>
        <p className="text-sm text-fg-muted">{meta}</p>
        <div className="flex flex-wrap items-center gap-2">
          <FitScore score={job.atsScore} />
          {showTailored && (
            <span className="text-xs text-fg-subtle">after tailoring {job.postTailorScore}</span>
          )}
          <Badge tone="neutral">
            {job.deletedAt ? 'Deleted' : FILTER_LABELS[job.stage]}
          </Badge>
        </div>
      </header>

      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Why it matched</h3>
        {job.matchedRules.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {job.matchedRules.map((rule) => (
              <li key={rule}>
                <Badge tone="accent">{rule}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted">No rule matched this posting directly.</p>
        )}
      </div>

      {(job.url || job.draftResumeId) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-1 text-fg-body underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6"
            >
              View original posting
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          )}
          {job.draftResumeId && (
            <Link
              href={`/dashboard/resumes/${job.draftResumeId}`}
              className="inline-flex min-h-10 items-center text-fg-body underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6"
            >
              Tailored CV
            </Link>
          )}
        </div>
      )}

      {job.pendingApprovals.length > 0 && (
        <div className="rounded-control bg-surface-attention p-3 text-fg-attention">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
            Flagged claims need your approval
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
            {job.pendingApprovals.map((claim) => (
              <li key={claim}>{claim}</li>
            ))}
          </ul>
        </div>
      )}

      {job.deletedAt && (
        <p className="text-sm text-fg-muted">
          The old draft and description are gone. Find again lets the next scan pick this posting up fresh.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {plan.primary && (
          <ActionControl action={plan.primary} job={job} variant="primary" busy={busy} onAction={onAction} />
        )}
        {plan.secondary.map((action) => (
          <ActionControl key={action} action={action} job={job} variant="secondary" busy={busy} onAction={onAction} />
        ))}
        {plan.overflow.length > 0 && (
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon" className="min-h-10 min-w-10 sm:min-h-8 sm:min-w-8" aria-label="More actions" disabled={busy}>
                <MoreVertical aria-hidden="true" className="h-4 w-4" />
              </Button>
            </MenuTrigger>
            <MenuContent className="w-40 p-1.5">
              {plan.overflow.map((action) => (
                <MenuItem
                  key={action}
                  className={action === 'delete' ? 'text-fg-danger hover:bg-surface-danger data-[highlighted]:bg-surface-danger' : undefined}
                  onSelect={() => onAction(action, job)}
                >
                  {ACTION_LABELS[action]}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}
      </div>
    </section>
  )
}
