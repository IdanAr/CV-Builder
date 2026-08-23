import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ProfileList } from '@/components/jobsearch/ProfileList'

export default async function JobSearchPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Job Search Profiles</h1>
      <ProfileList />
    </div>
  )
}
