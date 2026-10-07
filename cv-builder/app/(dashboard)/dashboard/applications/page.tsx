import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listApplications } from '@/lib/api/applications'
import { getOrCreateBoardConfig } from '@/lib/api/board-config'
import { listResumeOptions } from '@/lib/api/resumes'
import ApplicationsView from '@/components/applications/ApplicationsView'
import type { ApplicationRow, BoardConfigData } from '@/lib/applications/types'

export default async function ApplicationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const [applications, boardConfig, resumes] = await Promise.all([
    listApplications(session.user.id),
    getOrCreateBoardConfig(session.user.id),
    listResumeOptions(session.user.id),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-fg-heading">Applications</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Every application you&apos;re tracking, in one table or board.
        </p>
      </div>

      <div className="mt-6">
        <ApplicationsView
          initialApplications={JSON.parse(JSON.stringify(applications)) as ApplicationRow[]}
          initialBoardConfig={JSON.parse(JSON.stringify(boardConfig)) as BoardConfigData}
          resumes={resumes}
        />
      </div>
    </div>
  )
}
