import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { EditorShell } from '@/components/editor/EditorShell'
import { UnverifiedClaimsBanner } from '@/components/editor/UnverifiedClaimsBanner'
import { parseEditorTab } from '@/lib/editor/tabs'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export default async function ResumePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const session = await auth()
  if (!session?.user?.id) notFound()

  const { id } = await params
  const { tab } = await searchParams
  const resume = await getResume(session.user.id, id)
  if (!resume) notFound()

  // Read straight off the loaded document rather than threaded through the
  // editor store, which holds only data/meta/title. This is provenance shown
  // once on open, not editor state.
  const pendingApprovals = (resume.pendingApprovals ?? []) as string[]

  return (
    <>
      <UnverifiedClaimsBanner resumeId={String(resume._id)} claims={pendingApprovals} />
      <EditorShell
      resumeId={String(resume._id)}
      title={resume.title}
      data={(resume.data ?? {}) as ResumeData}
      meta={resume.meta as ResumeMeta}
      initialTab={parseEditorTab(tab)}
      />
    </>
  )
}
