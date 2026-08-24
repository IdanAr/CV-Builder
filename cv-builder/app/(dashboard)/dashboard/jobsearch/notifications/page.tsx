import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { JobMatchesFeed } from '@/components/jobsearch/JobMatchesFeed'

export default async function JobMatchesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Job Matches</h1>
      <JobMatchesFeed />
    </div>
  )
}
