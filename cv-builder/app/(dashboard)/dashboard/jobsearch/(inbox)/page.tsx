import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listJobSearchProfiles } from '@/lib/api/jobsearch-profiles'
import { countPipelineStages, listPipelineJobs } from '@/lib/api/scraped-jobs'
import { parsePipelineFilter } from '@/lib/jobsearch/stages'
import { defaultStage } from '@/lib/jobsearch/pipeline-url'
import { PipelineInbox } from '@/components/pipeline/PipelineInbox'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function JobSearchPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')
  const userId = session.user.id

  const params = await searchParams
  // A repeated key (?q=a&q=b) arrives as an array; treat anything but a string as absent.
  const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)
  const profile = str(params.profile) || null
  const q = str(params.q) ?? ''

  const [profiles, counts] = await Promise.all([
    listJobSearchProfiles(userId),
    countPipelineStages(userId, { profileId: profile ?? undefined }),
  ])
  const stage = parsePipelineFilter(str(params.stage) ?? null) ?? defaultStage(counts)
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
