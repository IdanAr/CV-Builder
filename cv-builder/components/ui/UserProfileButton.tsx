'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, FileText, LogOut, Settings } from 'lucide-react'

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

export function UserProfileButton({ user }: UserProfileButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // The menu is portalled into document.body so it always sits above
  // ancestors (e.g. the navbar's backdrop-blur) which create their own stacking
  // context and containing block for fixed-position elements.
  //
  // The Terms & Conditions modal that used to be portalled here was ~120 lines
  // of legal copy duplicating app/terms/page.tsx, and the two had diverged: the
  // modal held 11 sections to the page's 15, so a signed-in user read a
  // materially different agreement from a visitor. The menu now links to the
  // page, which is the only copy.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [dropdownOpen])

  useEffect(() => {
    if (!dropdownOpen) return
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      const insideTrigger = containerRef.current?.contains(target) ?? false
      const insideMenu = menuRef.current?.contains(target) ?? false
      if (!insideTrigger && !insideMenu) {
        setDropdownOpen(false)
      }
    }
    function getMenuItems(): HTMLElement[] {
      return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = getMenuItems()
        if (items.length === 0) return
        const currentIndex = items.indexOf(document.activeElement as HTMLElement)
        let nextIndex: number
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex === -1 || currentIndex === items.length - 1 ? 0 : currentIndex + 1
        } else {
          nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1
        }
        items[nextIndex]?.focus()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [dropdownOpen])

  // Stable callback ref (not a plain useEffect keyed on dropdownOpen/menuPosition):
  // menuPosition is recomputed to a new object on every scroll/resize while the
  // menu is open, so an effect depending on it would steal focus back to the
  // first item on every scroll. A callback ref only fires when the underlying
  // DOM node itself is created (menu opens) or torn down (menu closes).
  const setMenuNode = useCallback((node: HTMLDivElement | null) => {
    menuRef.current = node
    if (node) {
      node.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    }
  }, [])

  const firstName = user.name?.split(' ')[0] ?? 'Account'

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger pill */}
      <button
        ref={triggerRef}
        onClick={() => setDropdownOpen(o => !o)}
        aria-label="Open user menu"
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-indigo-200/40 bg-white/70 px-2.5 py-1 shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <Avatar image={user.image} name={user.name} size={26} />
        <span className="text-xs font-medium text-indigo-700">{firstName}</span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={2.5}
          className={`h-3 w-3 text-fg-muted transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {mounted && dropdownOpen && menuPosition && createPortal(
        <div
          ref={setMenuNode}
          role="menu"
          style={{ top: menuPosition.top, right: menuPosition.right }}
          className="fixed z-[100] w-56 overflow-hidden rounded-xl border border-white/40 bg-white/90 shadow-xl backdrop-blur-xl"
        >
          {/* User info header (non-interactive) */}
          <div className="flex items-center gap-3 border-b border-indigo-50 px-4 py-3">
            <Avatar image={user.image} name={user.name} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-indigo-900">
                {user.name ?? 'User'}
              </p>
              <p className="truncate text-xs text-fg-muted">{user.email ?? ''}</p>
            </div>
          </div>

          {/* Menu items */}
          <div role="group" className="p-1.5">
            <Link
              href="/dashboard/settings"
              role="menuitem"
              tabIndex={-1}
              onClick={() => setDropdownOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-indigo-900 transition hover:bg-indigo-50/70"
            >
              <Settings aria-hidden="true" strokeWidth={2} className="h-4 w-4 shrink-0 text-fg-muted" />
              Settings
            </Link>
            <Link
              href="/terms"
              role="menuitem"
              tabIndex={-1}
              onClick={() => setDropdownOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-indigo-900 transition hover:bg-indigo-50/70"
            >
              <FileText aria-hidden="true" strokeWidth={2} className="h-4 w-4 shrink-0 text-fg-muted" />
              Terms of Use
            </Link>
          </div>

          {/* Sign Out */}
          <div role="group" className="border-t border-indigo-50 p-1.5">
            <button
              role="menuitem"
              tabIndex={-1}
              onClick={() => signOut({ callbackUrl: '/signin' })}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50/80"
            >
              <LogOut aria-hidden="true" strokeWidth={2} className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
