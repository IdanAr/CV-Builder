import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { RuleBuilder } from '@/components/jobsearch/RuleBuilder'
import { ScrapedJobsList } from '@/components/jobsearch/ScrapedJobsList'
import { QueuedApplicationsPanel } from '@/components/jobsearch/QueuedApplicationsPanel'

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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Scraped Jobs</h1>
      <div className="mb-8">
        <RuleBuilder profileId={id} />
      </div>
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Queued applications</h2>
        <QueuedApplicationsPanel profileId={id} />
      </div>
      <ScrapedJobsList profileId={id} />
    </div>
  )
}
