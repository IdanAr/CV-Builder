import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listResumes } from '@/lib/api/resumes'
import { listApplications } from '@/lib/api/applications'
import { getOrCreateBoardConfig } from '@/lib/api/board-config'
import { computeResumeApplicationBadges } from '@/lib/applications/resume-status'
import type { BoardColumn } from '@/lib/schemas/application.zod'
import ResumeCard from '@/components/ResumeCard'
import NewResumeButton from '@/components/NewResumeButton'
import UploadCVButton from '@/components/UploadCVButton'
import { EmptyDashboardState } from '@/components/EmptyDashboardState'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { DashboardNavActions } from '@/components/ui/DashboardNavActions'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const [resumes, applications, boardConfig] = await Promise.all([
    listResumes(session.user.id),
    listApplications(session.user.id),
    getOrCreateBoardConfig(session.user.id),
  ])

  const statusOptions =
    (boardConfig.columns as BoardColumn[]).find((c) => c.type === 'status')?.options ?? []
  const badgeMap = computeResumeApplicationBadges(applications, statusOptions)

  return (
    <>
 <AppNavbar
        actions={
          <DashboardNavActions
            user={session.user}
            current="resumes"
            showHomepage
            leading={
              <>
                <NewResumeButton />
                <UploadCVButton />
              </>
            }
          />
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-indigo-700">My CVs</h1>
        </div>

        {resumes.length === 0 ? (
          <EmptyDashboardState />
        ) : (
          <div className="flex flex-col gap-4">
            {resumes.map((resume) => (
              <ResumeCard
                key={String(resume._id)}
                resume={{
                  _id: String(resume._id),
                  title: resume.title,
                  data: (resume.data ?? {}) as { basics?: { label?: string } },
                  meta: resume.meta as { templateId?: string; layout?: string },
                  sectionsFilledCount: resume.sectionsFilledCount,
                  formatScore: resume.formatScore ?? 0,
                  createdAt: resume.createdAt.toISOString(),
                  updatedAt: resume.updatedAt.toISOString(),
                  parentResumeId: resume.parentResumeId ? String(resume.parentResumeId) : undefined,
                  parentResumeTitle: resume.parentResumeTitle,
                }}
                applicationBadge={badgeMap.get(String(resume._id)) ?? { kind: 'none' }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
