import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listResumes } from '@/lib/api/resumes'
import { listApplications } from '@/lib/api/applications'
import { getOrCreateBoardConfig } from '@/lib/api/board-config'
import { computeResumeApplicationBadges } from '@/lib/applications/resume-status'
import { CVS_VIEW_COOKIE, parseCvsView } from '@/lib/preferences'
import type { BoardColumn } from '@/lib/schemas/application.zod'
import NewResumeButton from '@/components/NewResumeButton'
import UploadCVButton from '@/components/UploadCVButton'
import { CvLibrary } from '@/components/cvs/CvLibrary'
import { toCvRow } from '@/components/cvs/cv-row'

export default async function CvsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const [resumes, applications, boardConfig, jar] = await Promise.all([
    listResumes(session.user.id),
    listApplications(session.user.id),
    getOrCreateBoardConfig(session.user.id),
    cookies(),
  ])
  const statusOptions =
    (boardConfig.columns as BoardColumn[]).find((c) => c.type === 'status')?.options ?? []
  const badges = computeResumeApplicationBadges(applications, statusOptions)
  const rows = resumes.map((r) => toCvRow(r, badges.get(String(r._id)) ?? { kind: 'none' }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium text-fg-heading">CVs</h1>
        {/* The default (compact) variants: the hero ones are full-width,
            built for the empty-state cards. */}
        <div className="flex items-center gap-2">
          <UploadCVButton />
          <NewResumeButton />
        </div>
      </div>
      <CvLibrary rows={rows} initialView={parseCvsView(jar.get(CVS_VIEW_COOKIE)?.value)} />
    </div>
  )
}
