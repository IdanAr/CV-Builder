import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { JobMatchesFeed } from '@/components/jobsearch/JobMatchesFeed'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { UserProfileButton } from '@/components/ui/UserProfileButton'
import { JobSearchNav } from '@/components/jobsearch/JobSearchNav'

export default async function JobMatchesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  return (
    <>
      <AppNavbar
        actions={
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-md border border-indigo-200 bg-white/50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
            >
              My CVs
            </Link>
            <Link
              href="/dashboard/applications"
              className="rounded-md border border-indigo-200 bg-white/50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
            >
              Applications
            </Link>
            <div className="h-4 w-px bg-indigo-200" />
            <JobSearchNav />
            <UserProfileButton user={session.user} />
          </div>
        }
      />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-xl font-semibold">Job Matches</h1>
        <JobMatchesFeed />
      </div>
    </>
  )
}
