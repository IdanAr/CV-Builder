import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getJobSearchProfile } from '@/lib/api/jobsearch-profiles'
import { listRulesForProfile } from '@/lib/api/jobsearch-rules'
import { countUnreadNotifyMatches, listScrapedJobs } from '@/lib/api/scraped-jobs'
import { ProfileSettings } from '@/components/jobsearch/ProfileSettings'
import { RuleBuilder } from '@/components/jobsearch/RuleBuilder'
import { ScrapedJobsList } from '@/components/jobsearch/ScrapedJobsList'
import { QueuedApplicationsPanel } from '@/components/jobsearch/QueuedApplicationsPanel'
import { JobMatchesFeed } from '@/components/jobsearch/JobMatchesFeed'
import { JobSearchShell, type JobSearchSegment } from '@/components/jobsearch/JobSearchShell'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { DashboardNavActions } from '@/components/ui/DashboardNavActions'

const TABS = ['jobs', 'matches', 'rules'] as const
type Tab = (typeof TABS)[number]

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

const TAB_COPY: Record<Tab, string> = {
  jobs: 'Everything this profile has found, plus any drafts waiting on you.',
  matches: 'Postings this profile flagged through a notify rule.',
  rules: 'Decide which of this profile’s findings notify you, get drafted, or are ignored.',
}

export default async function JobSearchProfilePage({ params, searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/signin')
  }
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams])
  // An unknown ?tab= falls back rather than 404s — a mistyped tab should still
  // show you the profile.
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'jobs'

  const [profile, unreadCount] = await Promise.all([
    getJobSearchProfile(session.user.id, id),
    countUnreadNotifyMatches(session.user.id, id),
  ])
  // The page used to render its panels regardless, leaving four components to
  // each discover the 404 on their own and show four error banners.
  if (!profile) notFound()

  const [jobs, rules] = await Promise.all([
    listScrapedJobs(session.user.id, id),
    listRulesForProfile(session.user.id, id),
  ])

  const queuedCount = jobs.filter(
    (job) => job.status === 'queued' || job.status === 'needs_review'
  ).length
  const dismissedCount = jobs.filter((job) => job.status === 'dismissed').length
  const matchCount = jobs.filter(
    (job) =>
      (job.resolvedActions as string[])?.includes('notify') &&
      (job.status === 'new' || job.status === 'notified')
  ).length

  const href = (t: Tab) => (t === 'jobs' ? `/dashboard/jobsearch/${id}` : `/dashboard/jobsearch/${id}?tab=${t}`)
  const segments: JobSearchSegment[] = [
    { key: 'jobs', label: 'Jobs', href: href('jobs'), count: jobs.length },
    { key: 'matches', label: 'Matches', href: href('matches'), count: matchCount, tone: unreadCount > 0 ? 'alert' : 'neutral' },
    { key: 'rules', label: 'Rules', href: href('rules'), count: rules.length },
  ]

  const stats =
    tab === 'jobs'
      ? [
          { value: String(jobs.length), label: 'found' },
          { value: String(queuedCount), label: 'queued' },
          { value: String(dismissedCount), label: 'dismissed' },
        ]
      : undefined

  return (
    <>
      <AppNavbar actions={<DashboardNavActions user={session.user} current="jobsearch" />} />

      <JobSearchShell
        segments={segments}
        active={tab}
        backHref="/dashboard/jobsearch"
        backLabel="All profiles"
        title={profile.name}
        description={TAB_COPY[tab]}
        stats={stats}
        // The preferences bar sits above every tab: it is the profile's
        // identity, not one of its views, and it answers "why did this turn
        // up?" wherever you are.
        banner={
          <ProfileSettings
            profileId={id}
            initialProfile={JSON.parse(JSON.stringify(profile))}
          />
        }
      >
        {tab === 'jobs' && (
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-semibold text-fg-heading">Queued applications</h2>
                <p className="text-xs text-fg-subtle">
                  Drafts a rule prepared for you, waiting to be reviewed or submitted.
                </p>
              </div>
              <QueuedApplicationsPanel profileId={id} />
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-semibold text-fg-heading">Scraped jobs</h2>
                <p className="text-xs text-fg-subtle">
                  Everything this profile has found, newest first.
                </p>
              </div>
              <ScrapedJobsList profileId={id} />
            </section>
          </div>
        )}

        {tab === 'matches' && <JobMatchesFeed profileId={id} />}

        {tab === 'rules' && <RuleBuilder profileId={id} />}
      </JobSearchShell>
    </>
  )
}
