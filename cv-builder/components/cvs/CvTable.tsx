'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { formatAbsoluteDate, formatRelativeTime } from '@/lib/format-relative-time'
import type { ResumeApplicationBadge } from '@/lib/applications/resume-status'
import { atsToneClass, type CvRow, type CvSortDir, type CvSortKey } from './cv-row'
import { useResumeActions } from './use-resume-actions'
import { CvRowActions } from './CvRowActions'

export interface CvSort {
  key: CvSortKey
  dir: CvSortDir
}

/**
 * One DOM structure for every width. Below `md` the grid has two tracks (the
 * name cell, which carries a "<template>, ATS n/25, <edited>" subline, and the
 * actions menu); the Template, ATS and Edited cells drop out and the status
 * wraps under the name. From `md` up it is the full six-track table. No row is
 * rendered twice, so each CV mounts `useResumeActions` exactly once.
 */
const GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 md:grid-cols-[minmax(0,2.4fr)_1fr_0.7fr_1fr_1.3fr_auto]'

// Pinned beside the name on small screens; back in its own track from md up.
const ACTIONS_CELL = 'col-start-2 row-start-1 md:col-start-auto md:row-start-auto'

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function ariaSort(sort: CvSort, key: CvSortKey): 'ascending' | 'descending' | 'none' {
  if (sort.key !== key) return 'none'
  return sort.dir === 'asc' ? 'ascending' : 'descending'
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  sortKey: CvSortKey
  sort: CvSort
  onSort: (key: CvSortKey) => void
  className?: string
}) {
  const state = ariaSort(sort, sortKey)
  const Icon = state === 'ascending' ? ArrowUp : state === 'descending' ? ArrowDown : ChevronsUpDown
  return (
    <div role="columnheader" aria-sort={state} className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 rounded-control text-xs font-medium transition-colors',
          state === 'none' ? 'text-fg-muted hover:text-fg-heading' : 'text-fg-heading',
          FOCUS_RING
        )}
      >
        {label}
        <Icon aria-hidden="true" className={cn('h-3.5 w-3.5', state === 'none' && 'opacity-60')} />
      </button>
    </div>
  )
}

function StatusBadge({ badge }: { badge: ResumeApplicationBadge }) {
  if (badge.kind === 'single') {
    return (
      <Badge tone="neutral">
        {/* The board's own status colour, as a dot beside the label. */}
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: badge.color }} />
        <span className="truncate">{badge.label}</span>
      </Badge>
    )
  }
  return <Badge tone="neutral">{badge.kind === 'multiple' ? `${badge.count} applications` : 'Draft'}</Badge>
}

function sectionsLabel(count: number): string {
  return `${count} ${count === 1 ? 'section' : 'sections'} filled`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function CvTableRow({ row }: { row: CvRow }) {
  const router = useRouter()
  const actions = useResumeActions({ id: row.id, title: row.title })
  if (actions.hidden) return null

  const href = `/dashboard/resumes/${row.id}`
  const edited = formatRelativeTime(row.updatedAt)

  // The whole row opens the editor, except where the click landed on one of
  // its own controls. The `contains` check matters: the actions menu renders
  // in a portal, and React still bubbles its clicks through this row.
  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as Element
    if (!event.currentTarget.contains(target)) return
    if (target.closest('a, button, [role="menu"], [role="menuitem"]')) return
    router.push(href)
  }

  return (
    <div
      role="row"
      onClick={handleClick}
      className={cn(GRID, 'cursor-pointer border-t border-border-subtle py-3 transition-colors hover:bg-surface-subtle')}
    >
      <div role="cell" className="min-w-0">
        <Link href={href} className={cn('block truncate rounded-control font-medium text-fg-heading hover:underline', FOCUS_RING)}>
          {row.title}
        </Link>
        <p className="truncate text-xs text-fg-muted">{row.roleLabel}</p>
        {row.parentResumeId && row.parentResumeTitle && (
          <Link
            href={`/dashboard/resumes/${row.parentResumeId}`}
            className={cn('block truncate rounded-control text-xs text-fg-muted hover:text-fg-body hover:underline', FOCUS_RING)}
          >
            Tailored from {row.parentResumeTitle}
          </Link>
        )}
        <p className="truncate text-xs text-fg-muted md:hidden" suppressHydrationWarning>
          {row.templateLabel}, ATS {row.formatScore}/25, {edited}
        </p>
      </div>
      <div role="cell" className="hidden min-w-0 md:block">
        <p className="truncate text-sm text-fg-body">{row.templateLabel}</p>
        <p className="truncate text-xs text-fg-muted">
          {capitalize(row.layout)}, {sectionsLabel(row.sectionsFilledCount)}
        </p>
      </div>
      <div role="cell" className="hidden md:block">
        <span className={cn('text-sm font-medium tabular-nums', atsToneClass(row.formatScore))}>
          {row.formatScore}/25
        </span>
      </div>
      <div role="cell" className="hidden min-w-0 md:block">
        <time
          dateTime={row.updatedAt}
          title={formatAbsoluteDate(row.updatedAt)}
          className="block truncate text-sm text-fg-body"
          suppressHydrationWarning
        >
          {edited}
        </time>
        <p className="truncate text-xs text-fg-muted">Created {formatAbsoluteDate(row.createdAt)}</p>
      </div>
      <div role="cell" className="flex min-w-0 flex-wrap items-center gap-1.5">
        <StatusBadge badge={row.badge} />
        {row.pendingClaims > 0 && <Badge tone="attention">Review claims</Badge>}
      </div>
      <div role="cell" className={ACTIONS_CELL}>
        <CvRowActions title={row.title} actions={actions} />
      </div>
    </div>
  )
}

export function CvTable({
  rows,
  sort,
  onSort,
}: {
  rows: CvRow[]
  sort: CvSort
  onSort: (key: CvSortKey) => void
}) {
  return (
    <Card padding="none" role="table" aria-label="CVs">
      <div role="rowgroup">
        <div role="row" className={cn(GRID, 'py-2.5')}>
          <SortHeader label="Name" sortKey="name" sort={sort} onSort={onSort} />
          <div role="columnheader" className="hidden text-xs font-medium text-fg-muted md:block">
            Template
          </div>
          <SortHeader label="ATS" sortKey="ats" sort={sort} onSort={onSort} className="hidden md:block" />
          <SortHeader label="Edited" sortKey="edited" sort={sort} onSort={onSort} className="hidden md:block" />
          <div role="columnheader" className="hidden text-xs font-medium text-fg-muted md:block">
            Status
          </div>
          <div role="columnheader" className={ACTIONS_CELL}>
            <span className="sr-only">Actions</span>
          </div>
        </div>
      </div>
      <div role="rowgroup">
        {rows.map((row) => (
          <CvTableRow key={row.id} row={row} />
        ))}
      </div>
    </Card>
  )
}
