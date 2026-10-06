'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Briefcase, Columns3, FileText, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import { SidebarUserMenu } from './SidebarUserMenu'
import { waitingLabel } from './waiting-label'

export interface ShellUser {
  name?: string | null
  email?: string | null
  image?: string | null
}

interface Item {
  href: string
  label: string
  icon: LucideIcon
  isActive: (pathname: string) => boolean
  showWaiting?: boolean
}

const ITEMS: Item[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, isActive: (p) => p === '/dashboard' },
  {
    href: '/dashboard/cvs',
    label: 'CVs',
    icon: FileText,
    isActive: (p) => p.startsWith('/dashboard/cvs') || p.startsWith('/dashboard/resumes'),
  },
  {
    href: '/dashboard/jobsearch',
    label: 'Job search',
    icon: Briefcase,
    isActive: (p) => p.startsWith('/dashboard/jobsearch'),
    showWaiting: true,
  },
  {
    href: '/dashboard/applications',
    label: 'Applications',
    icon: Columns3,
    isActive: (p) => p.startsWith('/dashboard/applications'),
  },
]

const SETTINGS: Item = {
  href: '/dashboard/settings',
  label: 'Settings',
  icon: Settings,
  isActive: (p) => p.startsWith('/dashboard/settings'),
}

function WaitingChip({ count, collapsed }: { count: number; collapsed: boolean }) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'rounded-chip bg-surface-attention px-1.5 text-xs font-medium tabular-nums text-fg-attention',
        collapsed ? 'absolute right-0.5 top-0.5 px-1' : 'ml-auto'
      )}
    >
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      <span className="sr-only"> {waitingLabel(count)}</span>
    </span>
  )
}

function NavLink({
  item,
  active,
  collapsed,
  waiting,
  onNavigate,
}: {
  item: Item
  active: boolean
  collapsed: boolean
  waiting: number
  onNavigate?: () => void
}) {
  const Icon = item.icon
  const collapsedLabel =
    item.showWaiting && waiting > 0 ? `${item.label}, ${waitingLabel(waiting)}` : item.label
  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? collapsedLabel : undefined}
      onClick={onNavigate}
      className={cn(
        'relative flex items-center gap-3 rounded-control px-2.5 py-2 text-sm font-medium transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        collapsed && 'justify-center',
        active ? 'bg-surface-selected text-accent-700' : 'text-fg-body hover:bg-surface-subtle hover:text-fg-heading'
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {item.showWaiting && <WaitingChip count={waiting} collapsed={collapsed} />}
    </Link>
  )
  return collapsed ? <Tooltip content={item.label}>{link}</Tooltip> : link
}

export interface SidebarNavProps {
  user: ShellUser
  /** The live waiting count; AppShell owns the refresh so every copy agrees. */
  waiting: number
  collapsed: boolean
  onToggle: () => void
  onNavigate?: () => void
  showToggle?: boolean
  /** The collapsed rail's Expand button opens the drawer dialog (editor route). */
  opensDialog?: boolean
}

export function SidebarNav({
  user,
  waiting,
  collapsed,
  onToggle,
  onNavigate,
  showToggle = true,
  opensDialog = false,
}: SidebarNavProps) {
  const pathname = usePathname() ?? ''
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <div className="flex h-full flex-col gap-1 p-2">
      <div className={cn('flex items-center gap-2 px-1 pb-3 pt-1', collapsed ? 'justify-center' : 'justify-between')}>
        <Link
          href="/dashboard"
          aria-label="CV Builder home"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary text-sm font-medium text-primary-fg"
          >
            CV
          </span>
          {!collapsed && <span className="text-base font-medium text-fg-heading">CV Builder</span>}
        </Link>
        {showToggle && !collapsed && (
          <button
            type="button"
            aria-label="Collapse sidebar"
            aria-expanded={true}
            onClick={onToggle}
            className="rounded-control p-1.5 text-fg-muted transition hover:bg-surface-subtle hover:text-fg-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ToggleIcon aria-hidden="true" strokeWidth={1.75} className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      {showToggle && collapsed && (
        <Tooltip content="Expand sidebar">
          <button
            type="button"
            aria-label="Expand sidebar"
            aria-expanded={false}
            aria-haspopup={opensDialog ? 'dialog' : undefined}
            onClick={onToggle}
            className="mb-1 flex items-center justify-center rounded-control p-2 text-fg-muted transition hover:bg-surface-subtle hover:text-fg-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ToggleIcon aria-hidden="true" strokeWidth={1.75} className="h-[18px] w-[18px]" />
          </button>
        </Tooltip>
      )}

      <nav aria-label="Primary" className="flex flex-col gap-0.5">
        {ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={item.isActive(pathname)}
            collapsed={collapsed}
            waiting={waiting}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-border-subtle pt-2">
        <NavLink
          item={SETTINGS}
          active={SETTINGS.isActive(pathname)}
          collapsed={collapsed}
          waiting={0}
          onNavigate={onNavigate}
        />
        <SidebarUserMenu user={user} collapsed={collapsed} />
      </div>
    </div>
  )
}
