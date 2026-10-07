'use client'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Skeleton } from '@/components/ui/Skeleton'
import type { PipelineJob } from '@/lib/jobsearch/pipeline-types'
import type { PipelineFilter } from '@/lib/jobsearch/stages'
import { PipelineRow } from './PipelineRow'

const EMPTY_COPY: Record<PipelineFilter, string> = {
  found: 'Nothing found yet. Run a scan to look for new postings.',
  matched: 'No matches to review. Matches appear here when a rule flags a posting.',
  drafted: 'No drafts to review. Drafts appear here when a rule prepares an application.',
  ready: 'Nothing ready to apply. Approved drafts wait here until you mark them applied.',
  applied: 'No applications yet. Jobs you mark as applied are tracked here.',
  archive: 'Nothing in the archive. Dismissed and deleted postings land here.',
}

interface PipelineListProps {
  stage: PipelineFilter
  status: 'loading' | 'ready' | 'error'
  items: PipelineJob[]
  selectedId: string | null
  unreadIds: ReadonlySet<string>
  nextCursor: string | null
  loadingMore: boolean
  hasFilters: boolean
  onSelect(id: string): void
  onLoadMore(): void
  onRetry(): void
  error: string | null
}

export function PipelineList({
  stage, status, items, selectedId, unreadIds, nextCursor, loadingMore, hasFilters,
  onSelect, onLoadMore, onRetry, error,
}: PipelineListProps) {
  if (status === 'loading') {
    return (
      <div role="status" className="rounded-card border border-border bg-surface">
        <span className="sr-only">Loading jobs</span>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex min-h-[4.25rem] items-start gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className="space-y-3">
        <ErrorBanner>{error}</ErrorBanner>
        <Button variant="secondary" size="md" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border px-4 py-8 text-center text-sm text-fg-subtle">
        {hasFilters ? 'No jobs match these filters.' : EMPTY_COPY[stage]}
      </p>
    )
  }

  const hasTombstones = stage === 'archive' && items.some((j) => j.deletedAt)

  return (
    <div className="space-y-3">
      {hasTombstones && (
        <p className="text-xs text-fg-subtle">Scans skip these, so they are never tailored again.</p>
      )}
      <ul
        aria-label="Jobs"
        className="overflow-hidden rounded-card border border-border bg-surface"
      >
        {items.map((job) => (
          <PipelineRow
            key={job._id}
            job={job}
            selected={job._id === selectedId}
            isNew={unreadIds.has(job._id)}
            onSelect={() => onSelect(job._id)}
          />
        ))}
      </ul>
      {nextCursor && (
        <Button variant="secondary" size="md" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
