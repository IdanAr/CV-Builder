'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, FileText, LogOut, Settings } from 'lucide-react'
import { Menu, MenuContent, MenuGroup, MenuItem, MenuTrigger } from '@/components/ui/Menu'

interface UserProfileButtonProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('')
}

function Avatar({
  image,
  name,
  size,
}: {
  image?: string | null
  name?: string | null
  size: number
}) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? 'User'}
        width={size}
        height={size}
        className="rounded-full"
      />
    )
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.floor(size * 0.42) }}
    >
      {getInitials(name)}
    </div>
  )
}

/**
 * Built on the shared Menu primitive (components/ui/Menu.tsx). The version this
 * replaces hand-rolled the portal, the scroll/resize repositioning, the
 * outside-click and Escape listeners, and its own ArrowUp/ArrowDown roving
 * focus — around 60 lines that Radix now owns, along with typeahead and the
 * two-axis collision detection it never had.
 *
 * The Terms & Conditions modal that used to be portalled here was ~120 lines of
 * legal copy duplicating app/terms/page.tsx, and the two had diverged: the
 * modal held 11 sections to the page's 15, so a signed-in user read a
 * materially different agreement from a visitor. The menu links to the page,
 * which is the only copy.
 */
export function UserProfileButton({ user }: UserProfileButtonProps) {
  const [open, setOpen] = useState(false)

  const firstName = user.name?.split(' ')[0] ?? 'Account'

  return (
    // modal={false}: a navbar menu, so the page behind it stays scrollable and
    // its content stays reachable — matching the hand-rolled behaviour.
    <Menu open={open} onOpenChange={setOpen} modal={false}>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="Open user menu"
          className="flex items-center gap-2 rounded-full border border-indigo-200/40 bg-white/70 px-2.5 py-1 shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <Avatar image={user.image} name={user.name} size={26} />
          <span className="text-xs font-medium text-indigo-700">{firstName}</span>
          <ChevronDown
            aria-hidden="true"
            strokeWidth={2.5}
            className={`h-3 w-3 text-fg-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </MenuTrigger>

      <MenuContent className="w-56">
        {/* User info header (non-interactive, so deliberately not a MenuItem —
            roving focus and typeahead must skip it). */}
        <div className="flex items-center gap-3 border-b border-indigo-50 px-4 py-3">
          <Avatar image={user.image} name={user.name} size={34} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-indigo-900">
              {user.name ?? 'User'}
            </p>
            <p className="truncate text-xs text-fg-muted">{user.email ?? ''}</p>
          </div>
        </div>

        <MenuGroup className="p-1.5">
          <MenuItem asChild textValue="Settings">
            <Link href="/dashboard/settings">
              <Settings aria-hidden="true" strokeWidth={2} className="h-4 w-4 shrink-0 text-fg-muted" />
              Settings
            </Link>
          </MenuItem>
          <MenuItem asChild textValue="Terms of Use">
            <Link href="/terms">
              <FileText aria-hidden="true" strokeWidth={2} className="h-4 w-4 shrink-0 text-fg-muted" />
              Terms of Use
            </Link>
          </MenuItem>
        </MenuGroup>

        <MenuGroup className="border-t border-indigo-50 p-1.5">
          <MenuItem
            textValue="Sign Out"
            onSelect={() => signOut({ callbackUrl: '/signin' })}
            className="font-medium text-red-600 hover:bg-red-50/80 data-[highlighted]:bg-red-50/80"
          >
            <LogOut aria-hidden="true" strokeWidth={2} className="h-4 w-4 shrink-0" />
            Sign Out
          </MenuItem>
        </MenuGroup>
      </MenuContent>
    </Menu>
  )
}
