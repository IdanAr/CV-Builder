import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ProfileSettings } from '@/components/jobsearch/ProfileSettings'
import { RuleBuilder } from '@/components/jobsearch/RuleBuilder'
import { ScrapedJobsList } from '@/components/jobsearch/ScrapedJobsList'
import { QueuedApplicationsPanel } from '@/components/jobsearch/QueuedApplicationsPanel'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { UserProfileButton } from '@/components/ui/UserProfileButton'
import { JobSearchNav } from '@/components/jobsearch/JobSearchNav'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function JobSearchProfileScanPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/signin')
  }
  const { id } = await params

  return (
    <>
      <AppNavbar
        actions={
          <div className="ml-auto flex flex-wrap items-center gap-3">
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
        <h1 className="mb-6 text-xl font-semibold">Scraped Jobs</h1>
        <div className="mb-8">
          <ProfileSettings profileId={id} />
        </div>
        <div className="mb-8">
          <RuleBuilder profileId={id} />
        </div>
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Queued applications</h2>
          <QueuedApplicationsPanel profileId={id} />
        </div>
        <ScrapedJobsList profileId={id} />
      </div>
    </>
  )
}
