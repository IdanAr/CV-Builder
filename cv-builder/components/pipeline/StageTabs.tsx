'use client'
import { Fragment } from 'react'
import { handleTablistKeyDown, tabIndexFor } from '@/lib/tablist-keys'
import { PIPELINE_FILTERS, FILTER_LABELS, type PipelineFilter } from '@/lib/jobsearch/stages'
import type { PipelineCountsDto } from '@/lib/jobsearch/pipeline-types'
import { cn } from '@/lib/utils'

interface StageTabsProps {
  active: PipelineFilter
  counts: PipelineCountsDto | null
  onSelect(stage: PipelineFilter): void
}

/** Count shown on the tab, and how many of them are waiting on the user. */
function tabCounts(filter: PipelineFilter, counts: PipelineCountsDto | null) {
  if (!counts) return { shown: 0, waiting: 0 }
  const shown = counts[filter]
  if (filter === 'matched') return { shown, waiting: counts.matchedUnread }
  if (filter === 'drafted' || filter === 'ready') return { shown, waiting: shown }
  return { shown, waiting: 0 }
}

export function StageTabs({ active, counts, onSelect }: StageTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Pipeline stage"
      onKeyDown={handleTablistKeyDown}
      className="flex items-center gap-1 overflow-x-auto"
    >
      {PIPELINE_FILTERS.map((filter) => {
        const selected = filter === active
        const { shown, waiting } = tabCounts(filter, counts)
        return (
          <Fragment key={filter}>
            {filter === 'archive' && (
              <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />
            )}
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={tabIndexFor(selected)}
              onClick={() => onSelect(filter)}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium sm:min-h-8',
                'motion-safe:transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'bg-surface-selected text-fg-body'
                  : 'text-fg-muted hover:bg-surface-subtle hover:text-fg-body'
              )}
            >
              {FILTER_LABELS[filter]}
              {shown > 0 && (
                <span
                  className={cn(
                    'rounded-chip px-1.5 text-xs tabular-nums',
                    waiting > 0 ? 'bg-surface-attention text-fg-attention' : 'bg-surface-subtle text-fg-subtle'
                  )}
                >
                  {shown}
                  {waiting > 0 && <span className="sr-only">{` ${waiting}`} waiting</span>}
                </span>
              )}
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}
