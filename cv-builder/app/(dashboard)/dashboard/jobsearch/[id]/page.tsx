import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ScrapedJobsList } from '@/components/jobsearch/ScrapedJobsList'

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
      <ScrapedJobsList profileId={id} />
    </div>
  )
}
