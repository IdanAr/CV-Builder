'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null)

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

  return (
    <Link
      href="/dashboard/jobsearch/notifications"
      aria-label="Job matches"
      className="relative rounded-md border border-indigo-200 bg-white/50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
    >
      Job Matches
      {!!count && count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
