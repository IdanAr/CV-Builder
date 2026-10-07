import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listJobSearchProfiles } from '@/lib/api/jobsearch-profiles'
import { countPipelineStages, listPipelineJobs } from '@/lib/api/scraped-jobs'
import { parsePipelineFilter } from '@/lib/jobsearch/stages'
import { defaultStage } from '@/lib/jobsearch/pipeline-url'
import { PipelineInbox } from '@/components/pipeline/PipelineInbox'

interface PageProps {
  searchParams: Promise<{ stage?: string; profile?: string; q?: string; job?: string }>
}

export default async function JobSearchPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')
  const userId = session.user.id

  const params = await searchParams
  const profile = params.profile || null
  const q = params.q ?? ''

  const [profiles, counts] = await Promise.all([
    listJobSearchProfiles(userId),
    countPipelineStages(userId, { profileId: profile ?? undefined }),
  ])
  const stage = parsePipelineFilter(params.stage) ?? defaultStage(counts)
  const { items, nextCursor } = await listPipelineJobs(userId, {
    stage,
    profileId: profile ?? undefined,
    q,
  })

  return (
    <PipelineInbox
      initial={JSON.parse(JSON.stringify({ view: { stage, profile, q }, items, nextCursor, counts }))}
      profiles={profiles.map(({ _id, name, isActive }) => ({ _id: String(_id), name, isActive }))}
    />
  )
}
