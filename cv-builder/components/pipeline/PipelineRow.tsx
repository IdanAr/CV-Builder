'use client'
import { Sparkles, FileCheck, Send } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatRelativeTime } from '@/lib/format-relative-time'
import type { PipelineJob } from '@/lib/jobsearch/pipeline-types'
import { cn } from '@/lib/utils'
import { FitScore } from './FitScore'

interface PipelineRowProps {
  job: PipelineJob
  selected: boolean
  isNew: boolean
  onSelect(): void
  /** Roving tabindex: the list passes 0 for the selected (or first) row. Defaults to -1. */
  tabIndex?: 0 | -1
}

function AttentionChip({ job, isNew }: { job: PipelineJob; isNew: boolean }) {
  let Icon = Sparkles
  let label: string
  if (job.stage === 'drafted' && job.pendingApprovals.length > 0) {
    Icon = FileCheck
    label = 'Needs review'
  } else if (job.stage === 'ready') {
    Icon = Send
    label = 'Ready to apply'
  } else if (isNew) {
    label = 'New'
  } else {
    return null
  }
  return (
    <Badge tone="attention">
      <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
      {label}
    </Badge>
  )
}

export function PipelineRow({ job, selected, isNew, onSelect, tabIndex = -1 }: PipelineRowProps) {
  const meta = [job.company, job.location].filter(Boolean).join(' · ')
  return (
    <li
      role="option"
      aria-selected={selected}
      className={cn(
        'border-b border-border last:border-b-0',
        selected ? 'bg-surface-selected' : 'bg-surface motion-safe:transition-colors hover:bg-surface-subtle'
      )}
    >
      <button
        type="button"
        tabIndex={tabIndex}
        onClick={onSelect}
        className="flex min-h-10 w-full items-start gap-3 px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg-body">{job.title}</span>
          <span className="block truncate text-xs text-fg-subtle">{meta}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <AttentionChip job={job} isNew={isNew} />
            {job.stage === 'archive' && (
              <Badge tone="neutral">{job.deletedAt ? 'Deleted' : 'Archived'}</Badge>
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <FitScore score={job.atsScore} />
          <span className="text-xs text-fg-subtle">{formatRelativeTime(job.createdAt)}</span>
        </span>
      </button>
    </li>
  )
}
