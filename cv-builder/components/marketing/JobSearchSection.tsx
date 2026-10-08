import Link from 'next/link'
import { buttonClasses } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Radar, Gauge, SlidersHorizontal, ShieldCheck } from 'lucide-react'

const CAPABILITIES = [
  {
    icon: Radar,
    title: 'Automated Scanning',
    description:
      "Set your target roles, locations, seniority, and the companies you're watching once. We continuously scan job boards and those companies for new postings.",
  },
  {
    icon: Gauge,
    title: 'Instant Fit Score',
    description:
      'Every match is scored against your résumé, so you can tell at a glance which postings are actually worth your time.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Smart Rules',
    description:
      'Set rules to automatically ignore noise, or to auto-draft a tailored résumé and cover letter for postings that fit your criteria.',
  },
  {
    icon: ShieldCheck,
    title: 'You Stay in Control',
    description:
      "Every AI-drafted résumé and cover letter waits in your review queue. Nothing is sent or submitted until you approve it.",
  },
] as const

const MOCK_MATCHES = [
  { title: 'Senior Data Analyst', company: 'Acme Corp', score: 92, tag: 'Auto-drafted' },
  { title: 'Product Analyst', company: 'Globex', score: 81, tag: 'New match' },
  { title: 'Data Scientist', company: 'Initech', score: 68, tag: 'New match' },
] as const

function scoreTone(score: number): 'success' | 'warning' {
  return score >= 80 ? 'success' : 'warning'
}

export function JobSearchSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <h2 className="text-center text-3xl font-medium tracking-tight text-fg-heading">
        Let Job Search Find Your Next Role
      </h2>
      <p className="mt-2 text-center text-sm text-fg-body max-w-2xl mx-auto">
        Set your criteria once. We scan job boards and the companies you&apos;re watching, score every
        match against your résumé, and draft tailored applications for the ones worth your time.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-center">
        <div className="grid gap-6 sm:grid-cols-2">
          {CAPABILITIES.map(({ icon: Icon, title, description }) => (
            <div key={title}>
              <h3 className="flex items-center gap-2 text-base font-medium text-fg-heading">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-selected text-fg-body">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {title}
              </h3>
              <p className="mt-2 text-sm text-fg-body">{description}</p>
            </div>
          ))}
        </div>

        <div
          data-jobsearch-mock
          aria-hidden="true"
          className="rounded-card border border-border bg-surface p-6"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Matches</p>
          <ul className="mt-3 flex flex-col gap-3">
            {MOCK_MATCHES.map(({ title, company, score, tag }) => (
              <li
                key={title}
                className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-subtle px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg-heading">{title}</p>
                  <p className="truncate text-xs text-fg-muted">{company}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className="bg-surface-muted text-xs">{tag}</Badge>
                  <Badge tone={scoreTone(score)} className="rounded-full">
                    {score}%
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/signin"
          className={buttonClasses({ variant: 'primary', size: 'md', className: 'px-6 text-base' })}
        >
          Sign In to Set Up Job Search
        </Link>
      </div>
    </section>
  )
}
