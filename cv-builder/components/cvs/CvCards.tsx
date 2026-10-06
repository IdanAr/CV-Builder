'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { formatAbsoluteDate, formatRelativeTime } from '@/lib/format-relative-time'
import { atsToneClass, type CvRow } from './cv-row'
import { useResumeActions } from './use-resume-actions'
import { CvRowActions } from './CvRowActions'
import { CvThumbnail } from './CvThumbnail'

/**
 * The whole card opens the editor through one stretched link (its `::after`
 * covers the card) rather than by wrapping the card in an anchor: the
 * thumbnail holds the template's own links and the card holds the actions
 * menu button, and neither may sit inside another link.
 */
function CvCard({ row, onDelete }: { row: CvRow; onDelete: (id: string, title: string) => void }) {
  const actions = useResumeActions({ id: row.id, title: row.title })

  return (
    <li>
      <Card padding="sm" className="relative flex h-full flex-col gap-3 transition-colors hover:border-input">
        <CvThumbnail data={row.data} meta={row.meta} />
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/dashboard/resumes/${row.id}`}
              className={cn(
                'block truncate font-medium text-fg-heading hover:underline focus:outline-none',
                "after:absolute after:inset-0 after:rounded-card after:content-['']",
                'focus-visible:after:ring-2 focus-visible:after:ring-ring'
              )}
            >
              {row.title}
            </Link>
            <p className="truncate text-xs text-fg-muted">{row.roleLabel}</p>
          </div>
          <div className="relative z-10 -mr-1 -mt-1 shrink-0">
            <CvRowActions title={row.title} actions={actions} onDelete={() => onDelete(row.id, row.title)} />
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 text-xs">
          <time
            dateTime={row.updatedAt}
            title={formatAbsoluteDate(row.updatedAt)}
            className="truncate text-fg-muted"
            suppressHydrationWarning
          >
            Edited {formatRelativeTime(row.updatedAt)}
          </time>
          {row.pendingClaims > 0 ? (
            <Badge tone="attention">Review claims</Badge>
          ) : (
            <span className={cn('shrink-0 font-medium tabular-nums', atsToneClass(row.formatScore))}>
              ATS {row.formatScore}/25
            </span>
          )}
        </div>
      </Card>
    </li>
  )
}

export function CvCards({ rows, onDelete }: { rows: CvRow[]; onDelete: (id: string, title: string) => void }) {
  return (
    <ul role="list" aria-label="CVs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <CvCard key={row.id} row={row} onDelete={onDelete} />
      ))}
    </ul>
  )
}
