import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listResumes } from '@/lib/api/resumes'
import ResumeCard from '@/components/ResumeCard'
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
        containerClassName="mx-auto w-full max-w-4xl px-4"
        actions={
          // CV actions sit on the left; ml-auto on the Applications link pushes
          // the navigation/profile cluster to the right edge.
          <div className="flex items-center gap-3 flex-1">
            <NewResumeButton />
            <UploadCVButton />
            <Link
              href="/dashboard/applications"
              className="ml-auto rounded-md border border-indigo-200 bg-white/50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
            >
              Applications
            </Link>
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
