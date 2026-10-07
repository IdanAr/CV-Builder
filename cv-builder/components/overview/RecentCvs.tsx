import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { formatRelativeTime } from '@/lib/format-relative-time'

export interface RecentCv {
  id: string
  title: string
  updatedAt: string
  formatScore: number
}

export function RecentCvs({ cvs }: { cvs: RecentCv[] }) {
  if (cvs.length === 0) return null
  return (
    <section aria-labelledby="overview-recent-cvs">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="overview-recent-cvs" className="text-base font-medium text-fg-heading">
          Recent CVs
        </h2>
        <Link href="/dashboard/cvs" className="text-sm text-fg-body underline underline-offset-4">
          View all CVs
        </Link>
      </div>
      <Card padding="none">
        <ul className="divide-y divide-border">
          {cvs.map((cv) => (
            <li key={cv.id}>
              <Link
                href={`/dashboard/resumes/${cv.id}`}
                className="flex items-center justify-between gap-3 p-4 text-sm"
              >
                <span className="min-w-0 truncate font-medium text-fg-heading">{cv.title}</span>
                <span className="flex shrink-0 gap-3 text-xs text-fg-muted">
                  <span>Edited {formatRelativeTime(cv.updatedAt)}</span>
                  <span className="tabular-nums">ATS {cv.formatScore}/25</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}
