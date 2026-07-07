import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listResumes } from '@/lib/api/resumes'
import ResumeCard from '@/components/ResumeCard'
import type { ApplicationStatus } from '@/lib/schemas/resume.zod'
import NewResumeButton from '@/components/NewResumeButton'
import UploadCVButton from '@/components/UploadCVButton'
import { EmptyDashboardState } from '@/components/EmptyDashboardState'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { UserProfileButton } from '@/components/ui/UserProfileButton'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const resumes = await listResumes(session.user.id)

  return (
    <>
 <AppNavbar
        actions={
          // FIX: Replaced the <> fragment with this styling div
          <div className="flex items-center gap-3 ml-auto">
            <NewResumeButton />
            <UploadCVButton />
            <div className="w-px h-4 bg-indigo-200" />
            <UserProfileButton user={session.user} />
          </div>
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
                  applicationStatus: (resume.applicationStatus ?? 'draft') as ApplicationStatus,
                  targetCompany: resume.targetCompany,
                  targetRole: resume.targetRole,
                  parentResumeTitle: resume.parentResumeTitle,
                  createdAt: resume.createdAt.toISOString(),
                  updatedAt: resume.updatedAt.toISOString(),
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
