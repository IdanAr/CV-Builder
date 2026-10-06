import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listResumes } from '@/lib/api/resumes'
import { countPipelineStages } from '@/lib/api/scraped-jobs'
import { listJobSearchProfiles } from '@/lib/api/jobsearch-profiles'
import { Badge } from '@/components/ui/Badge'
import { PipelineStrip } from '@/components/overview/PipelineStrip'
import { NeedsYou } from '@/components/overview/NeedsYou'
import { RecentCvs } from '@/components/overview/RecentCvs'
import { FirstRun } from '@/components/overview/FirstRun'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')
  const userId = session.user.id
  // A time-of-day greeting would use the server's clock, not the user's.
  const firstName = session.user.name?.trim().split(/\s+/)[0]

  const [resumes, counts, profiles] = await Promise.all([
    listResumes(userId),
    countPipelineStages(userId),
    listJobSearchProfiles(userId),
  ])

  const hasCvs = resumes.length > 0
  const hasProfiles = profiles.length > 0
  const isFirstRun = !hasCvs && !hasProfiles

  const recent = [...resumes]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 3)
    .map((r) => ({
      id: String(r._id),
      title: r.title,
      updatedAt: r.updatedAt.toISOString(),
      formatScore: r.formatScore ?? 0,
    }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-medium text-fg-heading">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>
        {counts.waiting > 0 && (
          <Badge tone="attention">
            {counts.waiting} {counts.waiting === 1 ? 'item' : 'items'} waiting on you
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {isFirstRun ? (
          <FirstRun hasCvs={hasCvs} hasProfiles={hasProfiles} />
        ) : (
          <>
            <PipelineStrip counts={counts} />
            <NeedsYou counts={counts} />
            <RecentCvs cvs={recent} />
          </>
        )}
      </div>
    </div>
  )
}
