import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { EditorShell } from '@/components/editor/EditorShell'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export default async function ResumePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) notFound()

  const { id } = await params
  const resume = await getResume(session.user.id, id)
  if (!resume) notFound()

  return (
    <EditorShell
      resumeId={String(resume._id)}
      title={resume.title}
      data={(resume.data ?? {}) as ResumeData}
      meta={resume.meta as ResumeMeta}
      user={session.user}
    />
  )
}
