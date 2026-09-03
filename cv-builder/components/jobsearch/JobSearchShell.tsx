import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * The job-search section's page frame: title, purpose, primary action, and a
 * segmented tab row.
 *
 * The row is caller-supplied rather than fixed, because the section has two
 * of them: a top-level pair (Profiles / Matches) and, inside a profile
 * record, a profile-scoped trio (Jobs / Matches / Rules). Both are pairs of
 * real links, not buttons, so any view stays openable in a new tab.
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
  /**
   * `alert` is the unread treatment — it means "this many things are waiting
   * for you". `neutral` just sizes the tab's contents.
   */
  tone?: 'alert' | 'neutral'
}

export interface JobSearchShellProps {
  segments: JobSearchSegment[]
  /** The `key` of the segment being viewed. */
  active: string
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

/** The section's top-level tab row, shared by the two list pages. */
export function topLevelSegments(unreadCount: number): JobSearchSegment[] {
  return [
    { key: 'profiles', label: 'Profiles', href: '/dashboard/jobsearch' },
    {
      key: 'matches',
      label: 'Matches',
      href: '/dashboard/jobsearch/notifications',
      count: unreadCount,
      tone: 'alert',
    },
  ]
}

function SegmentBadge({
  count,
  tone,
  isActive,
}: {
  count: number
  tone: 'alert' | 'neutral'
  isActive: boolean
}) {
  const label = count > 99 ? '99+' : String(count)
  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1',
        'text-[10px] font-bold tabular-nums',
        isActive
          ? 'bg-white/25 text-primary-fg'
          : tone === 'alert'
          ? 'bg-danger-600 text-white'
          : 'bg-secondary text-secondary-fg'
      )}
    >
      {label}
      {tone === 'alert' && <span className="sr-only"> unread matches</span>}
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
            <h1 className="text-2xl font-bold text-fg-heading">{title}</h1>
            <p className="text-sm text-fg-subtle">{description}</p>
          </div>
          {action}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav
            aria-label="Job search views"
            className="inline-flex gap-0.5 rounded-control border border-border-subtle bg-surface/60 p-0.5"
          >
            {segments.map((segment) => {
              const isActive = segment.key === active
              return (
                <Link
                  key={segment.key}
                  href={segment.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-[0.375rem] px-3 py-1.5 text-sm font-medium transition',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-primary text-primary-fg shadow-sm'
                      : 'text-fg-subtle hover:bg-surface-subtle hover:text-fg-body'
                  )}
                >
                  {segment.label}
                  {segment.count !== undefined && segment.count > 0 && (
                    <SegmentBadge
                      count={segment.count}
                      tone={segment.tone ?? 'neutral'}
                      isActive={isActive}
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {stats && stats.length > 0 && (
            <dl className="flex flex-wrap items-center text-xs text-fg-subtle">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="mr-3.5 flex items-baseline gap-1.5 border-r border-border-subtle pr-3.5 last:mr-0 last:border-r-0 last:pr-0"
                >
                  <dd className="text-sm font-bold tabular-nums text-fg-heading">{stat.value}</dd>
                  <dt>{stat.label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>

        {banner}
      </div>

      {children}
    </div>
  )
}
