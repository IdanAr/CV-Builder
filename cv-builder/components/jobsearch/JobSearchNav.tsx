'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu'

// Combines "Profiles" (create/manage job search profiles) and "Job Matches"
// (the notifications feed) behind a single trigger so the navbar gains a
// reachable entry point to /dashboard/jobsearch without adding a second pill
// next to it.
//
// Built on the shared Menu primitive rather than a hand-rolled portal. The
// version this replaces gave its two items `tabIndex={-1}` and focused only the
// first, with no arrow-key handling anywhere — so a keyboard user could open
// the menu and reach "Profiles" but never "Job Matches". Radix's roving focus
// fixes that; see components/ui/Menu.tsx for what else the swap buys.
export function JobSearchNav() {
  const [count, setCount] = useState<number | null>(null)
  const [open, setOpen] = useState(false)

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

  const badge = count && count > 0 ? (count > 99 ? '99+' : String(count)) : null

  return (
    // modal={false}: this is a navbar menu, so the page behind it stays
    // scrollable and its content stays reachable, matching what the
    // hand-rolled version did.
    <Menu open={open} onOpenChange={setOpen} modal={false}>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="Job search menu"
          className="relative flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white/50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
        >
          Job Search
          <ChevronDown
            aria-hidden="true"
            strokeWidth={2.5}
            className={`h-3 w-3 text-fg-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
          {badge && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
              {badge}
            </span>
          )}
        </button>
      </MenuTrigger>

      <MenuContent className="w-52 p-1.5">
        <MenuItem asChild textValue="Profiles">
          <Link href="/dashboard/jobsearch">Profiles</Link>
        </MenuItem>
        <MenuItem asChild textValue="Job Matches">
          <Link href="/dashboard/jobsearch/notifications" className="justify-between">
            Job Matches
            {badge && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                {badge}
              </span>
            )}
          </Link>
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
