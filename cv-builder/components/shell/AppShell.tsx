'use client'

import { useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Menu as MenuIcon } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { cn } from '@/lib/utils'
import { SIDEBAR_COOKIE, writePreference } from '@/lib/preferences'
import { SidebarNav, type ShellUser } from './SidebarNav'

interface AppShellProps {
  user: ShellUser
  waiting: number
  initialCollapsed: boolean
  children: ReactNode
}

export function AppShell({ user, waiting, initialCollapsed, children }: AppShellProps) {
  const pathname = usePathname() ?? ''
  const isEditor = pathname.startsWith('/dashboard/resumes/')
  const [collapsedPref, setCollapsedPref] = useState(initialCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // The editor needs the width: it is always a rail there, and the saved
  // preference is left alone.
  const railOnly = isEditor || collapsedPref

  function toggleDesktop() {
    if (isEditor) {
      setDrawerOpen(true)
      return
    }
    const next = !collapsedPref
    setCollapsedPref(next)
    writePreference(SIDEBAR_COOKIE, next ? 'collapsed' : 'expanded')
  }

  return (
    <div className="flex min-h-screen bg-surface-page">
      <aside
        data-testid="sidebar-desktop"
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 border-r border-border bg-surface md:block',
          'transition-[width] duration-200 motion-reduce:transition-none',
          railOnly ? 'w-14' : 'w-[232px]'
        )}
      >
        <SidebarNav user={user} waiting={waiting} collapsed={railOnly} onToggle={toggleDesktop} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {!isEditor && (
          <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2 md:hidden">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
              className="rounded-control p-2 text-fg-body hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MenuIcon aria-hidden="true" strokeWidth={1.75} className="h-5 w-5" />
            </button>
            <span className="text-base font-medium text-fg-heading">CV Builder</span>
          </div>
        )}
        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-fg-heading/40" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-[260px] border-r border-border bg-surface shadow-popover focus:outline-none"
          >
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <SidebarNav
              user={user}
              waiting={waiting}
              collapsed={false}
              showToggle={false}
              onToggle={() => setDrawerOpen(false)}
              onNavigate={() => setDrawerOpen(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
