import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listJobSearchProfiles } from '@/lib/api/jobsearch-profiles'
import { PIPELINE_PATH } from '@/lib/jobsearch/pipeline-url'
import { ProfileList } from '@/components/jobsearch/ProfileList'
import { JobSearchShell } from '@/components/jobsearch/JobSearchShell'

export default async function SourcesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const profiles = await listJobSearchProfiles(session.user.id)

  return (
    <JobSearchShell
      title="Sources and rules"
      description="Profiles watch job boards on a schedule. Rules decide what reaches you."
      backHref={PIPELINE_PATH}
      backLabel="Pipeline"
    >
      <ProfileList initialProfiles={JSON.parse(JSON.stringify(profiles))} />
    </JobSearchShell>
  )
}
