import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { PipelineCounts } from '@/lib/api/scraped-jobs'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function NeedsYou({ counts }: { counts: PipelineCounts }) {
  const rows = [
    { stage: 'matched', n: counts.matched, text: plural(counts.matched, 'match to triage', 'matches to triage') },
    { stage: 'drafted', n: counts.drafted, text: plural(counts.drafted, 'draft to review', 'drafts to review') },
    { stage: 'ready', n: counts.ready, text: plural(counts.ready, 'application ready', 'applications ready') },
  ].filter((r) => r.n > 0)

  return (
    <section aria-labelledby="overview-needs-you">
      <h2 id="overview-needs-you" className="mb-3 text-base font-medium text-fg-heading">
        Needs you today
      </h2>
      <Card padding="none">
        {rows.length === 0 ? (
          <div className="p-4 text-sm text-fg-muted">
            <p className="font-medium text-fg-heading">You&apos;re caught up.</p>
            <p className="mt-1">
              Nothing needs your attention.{' '}
              <Link href="/dashboard/jobsearch" className="text-accent-700 underline">
                Run a scan
              </Link>{' '}
              to look for new roles.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.stage}>
                <Link
                  href={`/dashboard/jobsearch?stage=${r.stage}`}
                  className="flex items-center justify-between gap-3 p-4 text-sm"
                >
                  <span className="text-fg-body">{r.text}</span>
                  <Badge tone="attention">Review</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}
