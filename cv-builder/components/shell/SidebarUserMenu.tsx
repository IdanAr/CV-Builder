'use client'

import Image from 'next/image'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu'
import { cn } from '@/lib/utils'
import type { ShellUser } from './SidebarNav'

function initials(user: ShellUser): string {
  const source = user.name?.trim() || user.email?.trim() || '?'
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function SidebarUserMenu({ user, collapsed }: { user: ShellUser; collapsed: boolean }) {
  const display = user.name || user.email || 'Account'
  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            'flex w-full items-center gap-2 rounded-control p-2 text-left text-sm text-fg-body transition',
            'hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed && 'justify-center'
          )}
        >
          {user.image ? (
            <Image src={user.image} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full" />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-selected text-xs font-medium text-fg-body"
            >
              {initials(user)}
            </span>
          )}
          {!collapsed && <span className="min-w-0 flex-1 truncate">{display}</span>}
        </button>
      </MenuTrigger>
      <MenuContent align="start" side="top" className="w-56 p-1.5">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium text-fg-heading">{user.name ?? 'Signed in'}</p>
          {user.email && <p className="truncate text-xs text-fg-muted">{user.email}</p>}
        </div>
        <MenuItem asChild textValue="Settings">
          <Link href="/dashboard/settings">Settings</Link>
        </MenuItem>
        <MenuItem asChild textValue="Homepage">
          <Link href="/">Homepage</Link>
        </MenuItem>
        <MenuItem asChild textValue="Terms of use">
          <Link href="/terms">Terms of use</Link>
        </MenuItem>
        <MenuItem textValue="Sign out" onSelect={() => signOut({ callbackUrl: '/signin' })}>
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
