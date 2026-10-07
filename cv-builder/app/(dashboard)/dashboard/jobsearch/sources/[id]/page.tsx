import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getJobSearchProfile } from '@/lib/api/jobsearch-profiles'
import { listRulesForProfile } from '@/lib/api/jobsearch-rules'
import { pipelineHref } from '@/lib/jobsearch/pipeline-url'
import { buttonClasses } from '@/components/ui/Button'
import { ProfileSettings } from '@/components/jobsearch/ProfileSettings'
import { RuleBuilder } from '@/components/jobsearch/RuleBuilder'
import { JobSearchShell, type JobSearchSegment } from '@/components/jobsearch/JobSearchShell'

type Tab = 'rules' | 'settings'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

const TAB_COPY: Record<Tab, string> = {
  rules: 'Decide which of this profile’s findings notify you, get drafted, or are ignored.',
  settings: 'What this profile searches for, and how often.',
}

export default async function SourcesProfilePage({ params, searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')
  const userId = session.user.id
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams])
  // An unknown ?tab= falls back to Rules rather than 404ing.
  const tab: Tab = rawTab === 'settings' ? 'settings' : 'rules'

  const profile = await getJobSearchProfile(userId, id)
  if (!profile) notFound()
  const rules = await listRulesForProfile(userId, id)

  const base = `/dashboard/jobsearch/sources/${id}`
  const segments: JobSearchSegment[] = [
    { key: 'rules', label: 'Rules', href: base, count: rules.length },
    { key: 'settings', label: 'Settings', href: `${base}?tab=settings` },
  ]

  return (
    <JobSearchShell
      segments={segments}
      active={tab}
      backHref="/dashboard/jobsearch/sources"
      backLabel="Sources and rules"
      title={profile.name}
      description={TAB_COPY[tab]}
      action={
        <Link
          href={pipelineHref({ profile: id })}
          className={buttonClasses({ variant: 'secondary', size: 'md' })}
        >
          View jobs
        </Link>
      }
    >
      {tab === 'rules' ? (
        <RuleBuilder profileId={id} />
      ) : (
        <ProfileSettings profileId={id} initialProfile={JSON.parse(JSON.stringify(profile))} />
      )}
    </JobSearchShell>
  )
}
