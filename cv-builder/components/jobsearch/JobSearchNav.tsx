'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

// Combines "Profiles" (create/manage job search profiles) and "Job Matches"
// (the notifications feed) behind a single trigger so the navbar gains a
// reachable entry point to /dashboard/jobsearch without adding a second pill
// next to it. Portal-based positioning mirrors UserProfileButton.tsx — the
// navbar's backdrop-blur creates a stacking/containing-block context that
// would otherwise clip a plain absolutely-positioned dropdown.
export function JobSearchNav() {
  const [count, setCount] = useState<number | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/jobsearch/notifications/unread-count')
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then((body) => {
        if (!cancelled) setCount(body.count ?? 0)
      })
      .catch(() => {
        if (!cancelled) setCount(0)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [dropdownOpen])

  const setMenuNode = useCallback((node: HTMLDivElement | null) => {
    menuRef.current = node
    if (node) {
      node.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    }
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setDropdownOpen((o) => !o)}
        aria-label="Job search menu"
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        className="relative flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white/50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
      >
        Job Search
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
          className={`text-indigo-400 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {!!count && count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {mounted && dropdownOpen && menuPosition && createPortal(
        <div
          ref={setMenuNode}
          role="menu"
          style={{ top: menuPosition.top, right: menuPosition.right }}
          className="fixed z-[100] w-52 overflow-hidden rounded-xl border border-white/40 bg-white/90 p-1.5 shadow-xl backdrop-blur-xl"
        >
          <Link
            href="/dashboard/jobsearch"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setDropdownOpen(false)}
            className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-indigo-900 transition hover:bg-indigo-50/70"
          >
            Profiles
          </Link>
          <Link
            href="/dashboard/jobsearch/notifications"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setDropdownOpen(false)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-indigo-900 transition hover:bg-indigo-50/70"
          >
            Job Matches
            {!!count && count > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        </div>,
        document.body
      )}
    </div>
  )
}
