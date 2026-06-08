import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listResumes } from '@/lib/api/resumes'
import ResumeCard from '@/components/ResumeCard'
import NewResumeButton from '@/components/NewResumeButton'
import UploadCVButton from '@/components/UploadCVButton'
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
          <>
            <UploadCVButton />
            <NewResumeButton />
            <div className="w-px h-4 bg-indigo-200" />
            <UserProfileButton user={session.user} />
          </>
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-indigo-900">My CVs</h1>
        </div>

        {resumes.length === 0 ? (
          <div className="rounded-xl border border-indigo-100 bg-white/50 backdrop-blur-sm py-16 text-center">
            <p className="text-sm text-indigo-400">No CVs yet.</p>
            <p className="mt-1 text-sm text-indigo-300">Click &quot;+ New CV&quot; to get started.</p>
          </div>
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
