import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listJobSearchProfiles } from '@/lib/api/jobsearch-profiles'
import { countUnreadNotifyMatches } from '@/lib/api/scraped-jobs'
import { ProfileList } from '@/components/jobsearch/ProfileList'
import { JobSearchShell, topLevelSegments } from '@/components/jobsearch/JobSearchShell'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { DashboardNavActions } from '@/components/ui/DashboardNavActions'

export default async function JobSearchPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const [profiles, unreadCount] = await Promise.all([
    listJobSearchProfiles(session.user.id),
    countUnreadNotifyMatches(session.user.id),
  ])

  const activeCount = profiles.filter((p) => p.isActive).length
  const queuedCount = profiles.reduce((sum, p) => sum + (p.queuedCount ?? 0), 0)

  return (
    <>
      <AppNavbar actions={<DashboardNavActions user={session.user} current="jobsearch" />} />

      <JobSearchShell
        segments={topLevelSegments(unreadCount)}
        active="profiles"
        title="Job Search"
        description="Profiles watch job boards on a schedule. Rules decide what reaches you."
        stats={[
          { value: String(activeCount), label: 'active' },
          { value: String(unreadCount), label: 'new matches' },
          { value: String(queuedCount), label: 'queued drafts' },
        ]}
      >
        <ProfileList
          initialProfiles={JSON.parse(JSON.stringify(profiles))}
        />
      </JobSearchShell>
    </>
  )
}
