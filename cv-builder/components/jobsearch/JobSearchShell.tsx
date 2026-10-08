import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * The job-search section's page frame: title, purpose, primary action, and a
 * segmented tab row.
 *
 * The row is caller-supplied and optional: the sources list has none, a
 * profile record has Rules / Settings. They are real links, not buttons, so
 * any view stays openable in a new tab.
 */

export interface JobSearchStat {
  label: string
  value: string
}

export interface JobSearchSegment {
  key: string
  label: string
  href: string
  /** Rendered as a badge beside the label. Omitted at zero. */
  count?: number
}

export interface JobSearchShellProps {
  /** Omit for a page with no tab row. */
  segments?: JobSearchSegment[]
  /** The `key` of the segment being viewed. */
  active?: string
  title: string
  description: string
  /** The page's primary action, rendered opposite the title. */
  action?: ReactNode
  /** A thin figure line summarising the view. Omitted when empty. */
  stats?: JobSearchStat[]
  /** Renders a way back up the hierarchy, for pages nested under a segment. */
  backHref?: string
  backLabel?: string
  /** Sits between the tab row and the content — the profile preferences bar. */
  banner?: ReactNode
  children: ReactNode
}

function SegmentBadge({ count, isActive }: { count: number; isActive: boolean }) {
  const label = count > 99 ? '99+' : String(count)
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1',
        'text-xs font-medium tabular-nums',
        isActive ? 'bg-primary-fg/25 text-primary-fg' : 'bg-secondary text-secondary-fg'
      )}
    >
      {label}
    </span>
  )
}

export function JobSearchShell({
  segments,
  active,
  title,
  description,
  action,
  stats,
  backHref,
  backLabel,
  banner,
  children,
}: JobSearchShellProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex w-fit items-center gap-1 text-xs font-medium text-fg-muted transition hover:text-fg-body hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden="true">&larr;</span>
                {backLabel ?? 'Back'}
              </Link>
            )}
            <h1 className="text-xl font-medium text-fg-heading">{title}</h1>
            <p className="text-sm text-fg-subtle">{description}</p>
          </div>
          {action}
        </div>

        {(segments?.length || (stats && stats.length > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {segments?.length ? <nav
            aria-label="Job search views"
            className="inline-flex gap-0.5 rounded-control border border-border bg-surface p-0.5"
          >
            {segments.map((segment) => {
              const isActive = segment.key === active
              return (
                <Link
                  key={segment.key}
                  href={segment.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-chip px-3 py-1.5 text-sm font-medium transition',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-primary text-primary-fg'
                      : 'text-fg-subtle hover:bg-surface-subtle hover:text-fg-body'
                  )}
                >
                  {segment.label}
                  {segment.count !== undefined && segment.count > 0 && (
                    <SegmentBadge count={segment.count} isActive={isActive} />
                  )}
                </Link>
              )
            })}
          </nav> : null}

          {stats && stats.length > 0 && (
            <dl className="ml-auto flex flex-wrap items-center text-xs text-fg-subtle">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="mr-3.5 flex items-baseline gap-1.5 border-r border-border-subtle pr-3.5 last:mr-0 last:border-r-0 last:pr-0"
                >
                  <dd className="text-sm font-medium tabular-nums text-fg-heading">{stat.value}</dd>
                  <dt>{stat.label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
        )}

        {banner}
      </div>

      {children}
    </div>
  )
}
