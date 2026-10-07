import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { pipelineHref } from '@/lib/jobsearch/pipeline-url'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

/**
 * Legacy URL. The job and match views moved into the pipeline; rules and
 * settings moved under /sources.
 */
export default async function LegacyProfileRedirectPage({ params, searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')
  const [{ id }, { tab }] = await Promise.all([params, searchParams])
  if (tab === 'jobs' || tab === 'matches') redirect(pipelineHref({ profile: id }))
  redirect(`/dashboard/jobsearch/sources/${id}`)
}
