import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { countPipelineStages } from '@/lib/api/scraped-jobs'
import { SIDEBAR_COOKIE, parseSidebarPref } from '@/lib/preferences'
import { AppShell } from '@/components/shell/AppShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const jar = await cookies()
  const collapsed = parseSidebarPref(jar.get(SIDEBAR_COOKIE)?.value) === 'collapsed'
  const { waiting } = await countPipelineStages(session.user.id)

  return (
    <AppShell user={session.user} waiting={waiting} initialCollapsed={collapsed}>
      {children}
    </AppShell>
  )
}
