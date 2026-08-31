'use client'

// Per-row activity log: a clock-icon trigger opening a popover with the
// application's timestamped change feed, newest first — one line per changed field.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { History } from 'lucide-react'
import type { ActivityEntry } from '@/lib/applications/types'
import { formatRelativeTime } from '@/lib/format-relative-time'

export function formatActivityLine(entry: ActivityEntry): string {
  const from = entry.fromValue === null ? '-' : `'${entry.fromValue}'`
  const to = entry.toValue === null ? '-' : `'${entry.toValue}'`
  return `${entry.fieldLabel} changed from ${from} to ${to}`
}

export function ActivityLog({ applicationId, company }: { applicationId: string; company: string }) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null)
  const [error, setError] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(false)
    setEntries(null)
    fetch(`/api/applications/${applicationId}/activity`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Activity fetch failed')
        const { activity } = await res.json()
        if (!cancelled) setEntries(activity)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, applicationId])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Flip the popover to open upward when there isn't enough room below the
  // trigger but there is above — measured once at open-time against the
  // panel's actual rendered height (it starts positioned below by default,
  // so this can only run after that first paint's DOM is committed, which is
  // exactly when a layout effect fires).
  useLayoutEffect(() => {
    if (!open) return
    const triggerRect = ref.current?.getBoundingClientRect()
    const panelHeight = panelRef.current?.getBoundingClientRect().height
    if (!triggerRect || !panelHeight) return
    const fitsBelow = triggerRect.bottom + panelHeight + 8 <= window.innerHeight
    const fitsAbove = triggerRect.top > panelHeight + 8
    setOpenUpward(fitsBelow ? false : fitsAbove)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Activity log for application at ${company || 'unknown company'}`}
        aria-expanded={open}
        title="Activity log"
        onClick={() => setOpen((o) => !o)}
        className="rounded px-1 py-0.5 text-xs text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600"
      >
        <History className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={panelRef}
          role="status"
          aria-live="polite"
          className={`absolute right-0 z-30 max-h-72 w-80 overflow-y-auto rounded-lg border border-indigo-100 bg-white p-2 shadow-xl ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-indigo-400">
            Activity
          </p>
          {error && (
            <p className="px-1 py-2 text-sm text-red-500">Could not load the activity log.</p>
          )}
          {!error && entries === null && (
            <p className="px-1 py-2 text-sm text-indigo-300">Loading…</p>
          )}
          {entries !== null && entries.length === 0 && (
            <p className="px-1 py-2 text-sm text-indigo-400">
              No changes yet - edits to this application will appear here.
            </p>
          )}
          {entries !== null &&
            entries.map((entry) => (
              <div key={entry._id} className="border-t border-indigo-50 px-1 py-1.5 first:border-t-0">
                <p className="text-sm text-indigo-900">{formatActivityLine(entry)}</p>
                <p className="mt-0.5 text-xs text-indigo-400">
                  {formatRelativeTime(entry.changedAt)}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
