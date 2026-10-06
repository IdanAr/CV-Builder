'use client'

import { useMemo, useState } from 'react'
import { LayoutGrid, Rows3 } from 'lucide-react'
import { EmptyDashboardState } from '@/components/EmptyDashboardState'
import { CVS_VIEW_COOKIE, writePreference, type CvsView } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import { sortRows, type CvRow, type CvSortKey } from './cv-row'
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

export function CvLibrary({ rows, initialView }: { rows: CvRow[]; initialView: CvsView }) {
  const [view, setView] = useState<CvsView>(initialView)
  const [sort, setSort] = useState<CvSort>(DEFAULT_SORT)
  // Owned here, not by a row, so a pending delete survives view switches and
  // re-sorts (see use-cv-deletion.ts).
  const { isHidden, requestDelete } = useCvDeletion()
  const visible = useMemo(() => rows.filter((r) => !isHidden(r.id)), [rows, isHidden])
  const sorted = useMemo(() => sortRows(visible, sort.key, sort.dir), [visible, sort])

  if (rows.length === 0) return <EmptyDashboardState />

  function chooseView(next: CvsView) {
    setView(next)
    // Written on the user's choice only, never on mount, so the server can
    // render the remembered view on the next visit.
    writePreference(CVS_VIEW_COOKIE, next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          {visible.length} {visible.length === 1 ? 'CV' : 'CVs'}
        </p>
        <div role="group" aria-label="View" className="inline-flex rounded-control border border-border bg-surface p-0.5">
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
                  pressed ? 'bg-surface-selected text-accent-700' : 'text-fg-muted hover:text-fg-heading'
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {label}
              </button>
            )
          })}
        </div>
      </div>
      {view === 'table' ? (
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
