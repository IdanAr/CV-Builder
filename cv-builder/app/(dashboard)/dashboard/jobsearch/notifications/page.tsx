import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { pipelineHref } from '@/lib/jobsearch/pipeline-url'

/** Legacy URL: matches now live in the pipeline's Matched stage. */
export default async function JobMatchesRedirectPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')
  redirect(pipelineHref({ stage: 'matched' }))
}
