import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listApplications } from '@/lib/api/applications'
import { getOrCreateBoardConfig } from '@/lib/api/board-config'
import { listResumeOptions } from '@/lib/api/resumes'
import ApplicationsView from '@/components/applications/ApplicationsView'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { UserProfileButton } from '@/components/ui/UserProfileButton'
import { JobSearchNav } from '@/components/jobsearch/JobSearchNav'
import type { ApplicationRow, BoardConfigData } from '@/lib/applications/types'

export default async function ApplicationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const [applications, boardConfig, resumes] = await Promise.all([
    listApplications(session.user.id),
    getOrCreateBoardConfig(session.user.id),
    listResumeOptions(session.user.id),
  ])

  return (
    <>
      <AppNavbar
        containerClassName="mx-auto w-full max-w-7xl px-4"
        actions={
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-md border border-indigo-200 bg-white/50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
            >
              My CVs
            </Link>
            <div className="h-4 w-px bg-indigo-200" />
            <JobSearchNav />
            <UserProfileButton user={session.user} />
          </div>
        }
      />

<div className="mx-auto max-w-7xl px-4 py-8">
  <div className="mb-6">
    <h1 className="text-3xl font-bold text-indigo-700">Applications</h1>
    <p className="mt-1 text-base text-fg-muted">
      Every application you&apos;re tracking, in one customizable table.
    </p>
    <p className="mt-1 text-xs text-fg-muted">
      Create, edit, and manage your applications to keep your job search focused.
    </p>
  </div>

  <div className="mt-6">
    <ApplicationsView
      initialApplications={JSON.parse(JSON.stringify(applications)) as ApplicationRow[]}
      initialBoardConfig={JSON.parse(JSON.stringify(boardConfig)) as BoardConfigData}
      resumes={resumes}
    />
  </div>
</div>
    </>
  )
}
