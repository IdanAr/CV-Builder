import { ProfileList } from '@/components/jobsearch/ProfileList'

export default function JobSearchPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Job Search Profiles</h1>
      <ProfileList />
    </div>
  )
}
