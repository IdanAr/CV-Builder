import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { countUnreadNotifyMatches } from '@/lib/api/scraped-jobs'
import { JobMatchesFeed } from '@/components/jobsearch/JobMatchesFeed'
import { JobSearchShell, topLevelSegments } from '@/components/jobsearch/JobSearchShell'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { DashboardNavActions } from '@/components/ui/DashboardNavActions'

export default async function JobMatchesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const unreadCount = await countUnreadNotifyMatches(session.user.id)

  return (
    <>
      <AppNavbar actions={<DashboardNavActions user={session.user} current="jobsearch" />} />

      <JobSearchShell
        segments={topLevelSegments(unreadCount)}
        active="matches"
        title="Job Matches"
        description="Every posting your notify rules flagged, across all profiles."
      >
        <JobMatchesFeed />
      </JobSearchShell>
    </>
  )
}
