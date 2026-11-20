'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, Rows3, Search } from 'lucide-react'
import { EmptyDashboardState } from '@/components/EmptyDashboardState'
import { Button } from '@/components/ui/Button'
import { CVS_VIEW_COOKIE, writePreference, type CvsView } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import { filterRows, sortRows, type CvRow, type CvSortKey } from './cv-row'
import { CvTable, type CvSort } from './CvTable'
import { CvCards } from './CvCards'
import { useCvDeletion } from './use-cv-deletion'

const DEFAULT_SORT: CvSort = { key: 'edited', dir: 'desc' }

/**
 * Three-state header sorting. A new column starts in its natural direction
 * (A to Z and lowest score first; newest first for Edited), the second press
 * flips it, and the third returns to the default Edited-descending order.
 */
export function nextSort(current: CvSort, key: CvSortKey): CvSort {
  const first = key === 'edited' ? 'desc' : 'asc'
  if (current.key !== key) return { key, dir: first }
  if (current.dir === first) return { key, dir: first === 'asc' ? 'desc' : 'asc' }
  return DEFAULT_SORT
}

const VIEWS: Array<{ id: CvsView; label: string; Icon: typeof Rows3 }> = [
  { id: 'table', label: 'Table', Icon: Rows3 },
  { id: 'cards', label: 'Cards', Icon: LayoutGrid },
]

/** True when a keystroke is meant for a field the user is already typing in. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function countLabel(shown: number, total: number, filtering: boolean): string {
  const noun = total === 1 ? 'CV' : 'CVs'
  return filtering ? `${shown} of ${total} ${noun}` : `${total} ${noun}`
}

export function CvLibrary({ rows, initialView }: { rows: CvRow[]; initialView: CvsView }) {
  const [view, setView] = useState<CvsView>(initialView)
  const [sort, setSort] = useState<CvSort>(DEFAULT_SORT)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  // Owned here, not by a row, so a pending delete survives view switches and
  // re-sorts (see use-cv-deletion.ts).
  const { isHidden, requestDelete } = useCvDeletion()
  const visible = useMemo(() => rows.filter((r) => !isHidden(r.id)), [rows, isHidden])
  const matching = useMemo(() => filterRows(visible, query), [visible, query])
  const sorted = useMemo(() => sortRows(matching, sort.key, sort.dir), [matching, sort])
  const filtering = query.trim().length > 0

  // "/" jumps to the search box from anywhere on the page, the way most list
  // UIs do, unless the user is already typing somewhere.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  if (rows.length === 0) return <EmptyDashboardState />

  function chooseView(next: CvsView) {
    setView(next)
    // Written on the user's choice only, never on mount, so the server can
    // render the remembered view on the next visit.
    writePreference(CVS_VIEW_COOKIE, next)
  }

  function clearSearch() {
    setQuery('')
    searchRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-48 flex-1 sm:max-w-sm">
          <span className="sr-only">Search CVs</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.preventDefault()
                setQuery('')
              }
            }}
            placeholder="Search CVs"
            title="Search by name, company, role, template or status"
            autoComplete="off"
            spellCheck={false}
            className={cn(
              'min-h-10 w-full rounded-control border border-border bg-surface pl-8 pr-3 text-sm text-fg-body sm:min-h-8',
              'placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          />
        </label>
        <p className="text-sm text-fg-muted" aria-live="polite">
          {countLabel(sorted.length, visible.length, filtering)}
        </p>
        <div
          role="group"
          aria-label="View"
          className="ml-auto inline-flex rounded-control border border-border bg-surface p-0.5"
        >
          {VIEWS.map(({ id, label, Icon }) => {
            const pressed = view === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={pressed}
                onClick={() => chooseView(id)}
                className={cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-chip px-2.5 text-sm transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  pressed ? 'bg-surface-selected font-medium text-fg-body' : 'text-fg-muted hover:text-fg-heading'
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {label}
              </button>
            )
          })}
        </div>
      </div>
      {sorted.length === 0 && filtering ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-fg-body">No CVs match “{query.trim()}”</p>
          <p className="text-sm text-fg-muted">Try fewer words, or search by company, role or template.</p>
          <Button variant="secondary" size="sm" onClick={clearSearch}>
            Clear search
          </Button>
        </div>
      ) : view === 'table' ? (
        <CvTable
          rows={sorted}
          sort={sort}
          onSort={(key) => setSort((s) => nextSort(s, key))}
          onDelete={requestDelete}
        />
      ) : (
        <CvCards rows={sorted} onDelete={requestDelete} />
      )}
    </div>
  )
}
