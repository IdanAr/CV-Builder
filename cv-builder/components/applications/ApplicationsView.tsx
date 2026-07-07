'use client'

// Client orchestrator for the applications page: owns the applications +
// board-config state, optimistic cell edits, and the recoverable-delete
// (optimistic-hide + undo toast) flow shared by the table and board views.
import { useEffect, useRef, useState } from 'react'
import { toast, useToastStore } from '@/lib/stores/toast.store'
import { onToastPause, onToastResume } from '@/components/ui/Toaster'
import type { BoardColumn, CustomFieldValue, SortEntry } from '@/lib/schemas/application.zod'
import type { ApplicationRow, BoardConfigData, ResumeOption } from '@/lib/applications/types'
import { buildCellPatch } from '@/lib/applications/cells'
import { sortApplications, toggleSort } from '@/lib/applications/sort'
import { computeMovedOrder } from '@/lib/applications/order'
import ApplicationsTable from './ApplicationsTable'
import { ColumnHeader } from './ColumnHeader'
import { ColumnForm, type ColumnFormResult } from './ColumnForm'
import { EmptyApplicationsState } from './EmptyApplicationsState'

const UNDO_DELETE_DURATION = 6000

interface PendingDelete {
  timer: number | null
  remaining: number
  startedAt: number
  toastId: number
  cancelled: boolean
}

function applyCellLocally(
  app: ApplicationRow,
  column: BoardColumn,
  value: CustomFieldValue,
  resumes: ResumeOption[]
): ApplicationRow {
  switch (column.key) {
    case 'company':
      return { ...app, company: String(value ?? '') }
    case 'role':
      return { ...app, role: String(value ?? '') }
    case 'status':
      return { ...app, status: String(value ?? '') }
    case 'resumeId': {
      const resumeId = value === null || value === '' ? null : String(value)
      return {
        ...app,
        resumeId,
        resumeTitle: resumeId ? resumes.find((r) => r.id === resumeId)?.title : undefined,
      }
    }
    default:
      return { ...app, customFields: { ...app.customFields, [column.id]: value } }
  }
}

export interface ApplicationsViewProps {
  initialApplications: ApplicationRow[]
  initialBoardConfig: BoardConfigData
  resumes: ResumeOption[]
}

export default function ApplicationsView({
  initialApplications,
  initialBoardConfig,
  resumes,
}: ApplicationsViewProps) {
  const [applications, setApplications] = useState(initialApplications)
  const [boardConfig, setBoardConfig] = useState(initialBoardConfig)
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set())
  const [columnModal, setColumnModal] = useState<
    { mode: 'add' } | { mode: 'edit'; column: BoardColumn } | null
  >(null)
  const pendingDeletesRef = useRef(new Map<string, PendingDelete>())

  // --- Board config persistence (optimistic, reverts on failure) ------------
  async function persistBoardConfig(patch: { columns?: BoardColumn[]; sort?: SortEntry[] }) {
    const previous = boardConfig
    setBoardConfig((cfg) => ({ ...cfg, ...patch }))
    try {
      const res = await fetch('/api/applications/board-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Board config update failed')
    } catch (err) {
      console.error(err)
      setBoardConfig(previous)
      toast.error('Could not save the board settings. Please try again.')
    }
  }

  function handleToggleSort(columnId: string, additive: boolean) {
    void persistBoardConfig({ sort: toggleSort(boardConfig.sort, columnId, additive) })
  }

  // --- Drag reordering (fractional index: only the moved item changes) ------
  async function handleRowMove(activeId: string, overId: string) {
    const newOrder = computeMovedOrder(
      applications.map((a) => ({ id: a._id, order: a.order })),
      activeId,
      overId
    )
    if (newOrder === null) return
    const previous = applications
    setApplications((apps) => apps.map((a) => (a._id === activeId ? { ...a, order: newOrder } : a)))
    try {
      const res = await fetch(`/api/applications/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder }),
      })
      if (!res.ok) throw new Error('Reorder failed')
    } catch (err) {
      console.error(err)
      setApplications(previous)
      toast.error('Could not save the new order. Please try again.')
    }
  }

  // --- Column management (add / edit / delete) -------------------------------
  function handleColumnFormSubmit(result: ColumnFormResult) {
    if (!columnModal) return
    if (columnModal.mode === 'add') {
      const id = `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const maxOrder = Math.max(0, ...boardConfig.columns.map((c) => c.order))
      void persistBoardConfig({
        columns: [
          ...boardConfig.columns,
          {
            id,
            key: id,
            label: result.label,
            type: result.type,
            isBuiltIn: false,
            order: maxOrder + 1000,
            options: result.options,
          },
        ],
      })
    } else {
      const editedId = columnModal.column.id
      void persistBoardConfig({
        columns: boardConfig.columns.map((c) =>
          c.id === editedId ? { ...c, label: result.label, options: result.options } : c
        ),
      })
    }
    setColumnModal(null)
  }

  function handleDeleteColumn(column: BoardColumn) {
    // A real confirm (not an undo toast): deleting a column silently discards
    // that field across every row, which an undo window handles poorly.
    const confirmed = window.confirm(
      `Delete the "${column.label}" column? Its values will no longer be shown on any application.`
    )
    if (!confirmed) return
    void persistBoardConfig({
      columns: boardConfig.columns.filter((c) => c.id !== column.id),
    })
  }

  function handleColumnMove(activeId: string, overId: string) {
    const newOrder = computeMovedOrder(
      boardConfig.columns.map((c) => ({ id: c.id, order: c.order })),
      activeId,
      overId
    )
    if (newOrder === null) return
    void persistBoardConfig({
      columns: boardConfig.columns.map((c) => (c.id === activeId ? { ...c, order: newOrder } : c)),
    })
  }

  // --- Inline cell editing (optimistic, reverts on failure) -----------------
  async function handleCellChange(appId: string, column: BoardColumn, value: CustomFieldValue) {
    const patch = buildCellPatch(column, value)
    if (!patch) return
    const previous = applications
    setApplications((apps) =>
      apps.map((a) => (a._id === appId ? applyCellLocally(a, column, value, resumes) : a))
    )
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Patch failed')
    } catch (err) {
      console.error(err)
      setApplications(previous)
      toast.error('Could not save that change. Please try again.')
    }
  }

  // --- Quick add -------------------------------------------------------------
  async function handleAddRow() {
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Create failed')
      const { application } = await res.json()
      setApplications((apps) => [...apps, application])
    } catch (err) {
      console.error(err)
      toast.error('Could not create the application. Please try again.')
    }
  }

  // --- Recoverable delete (ResumeCard convention) ----------------------------
  async function commitDelete(appId: string) {
    pendingDeletesRef.current.delete(appId)
    try {
      const res = await fetch(`/api/applications/${appId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setApplications((apps) => apps.filter((a) => a._id !== appId))
      setHiddenIds((ids) => {
        const next = new Set(ids)
        next.delete(appId)
        return next
      })
    } catch (err) {
      console.error(err)
      setHiddenIds((ids) => {
        const next = new Set(ids)
        next.delete(appId)
        return next
      })
      toast.error('Could not delete the application. It has been restored.')
    }
  }

  function startDeleteTimer(appId: string, ms: number) {
    const entry = pendingDeletesRef.current.get(appId)
    if (!entry) return
    entry.startedAt = Date.now()
    entry.remaining = ms
    entry.timer = window.setTimeout(() => {
      entry.timer = null
      useToastStore.getState().dismiss(entry.toastId)
      void commitDelete(appId)
    }, ms)
  }

  function handleDeleteRow(appId: string) {
    const app = applications.find((a) => a._id === appId)
    setHiddenIds((ids) => new Set(ids).add(appId))
    const toastId = toast.withAction(
      `Deleted application${app?.company ? ` at ${app.company}` : ''}`,
      'Undo',
      () => {
        const entry = pendingDeletesRef.current.get(appId)
        if (entry) {
          entry.cancelled = true
          if (entry.timer) window.clearTimeout(entry.timer)
          pendingDeletesRef.current.delete(appId)
        }
        setHiddenIds((ids) => {
          const next = new Set(ids)
          next.delete(appId)
          return next
        })
      }
    )
    pendingDeletesRef.current.set(appId, {
      timer: null,
      remaining: UNDO_DELETE_DURATION,
      startedAt: 0,
      toastId,
      cancelled: false,
    })
    startDeleteTimer(appId, UNDO_DELETE_DURATION)
  }

  // Pause/resume the delete countdown in lockstep with the undo toast's own
  // hover/focus pause (same bus ResumeCard subscribes to).
  useEffect(() => {
    const unsubPause = onToastPause((id) => {
      for (const entry of pendingDeletesRef.current.values()) {
        if (entry.toastId !== id || entry.timer === null) continue
        entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt))
        window.clearTimeout(entry.timer)
        entry.timer = null
      }
    })
    const unsubResume = onToastResume((id) => {
      for (const [appId, entry] of pendingDeletesRef.current.entries()) {
        if (entry.toastId !== id || entry.timer !== null || entry.cancelled) continue
        startDeleteTimer(appId, entry.remaining)
      }
    })
    return () => {
      unsubPause()
      unsubResume()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Commit any still-pending deletes if the view unmounts mid-countdown.
  useEffect(() => {
    const pending = pendingDeletesRef.current
    return () => {
      for (const [appId, entry] of pending.entries()) {
        if (entry.timer) window.clearTimeout(entry.timer)
        if (!entry.cancelled) void fetch(`/api/applications/${appId}`, { method: 'DELETE' })
      }
      pending.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleApplications = applications.filter((a) => !hiddenIds.has(a._id))
  const columns = boardConfig.columns
  const sortedApplications = sortApplications(visibleApplications, boardConfig.sort, columns)

  if (applications.length === 0) {
    return <EmptyApplicationsState onCreate={handleAddRow} />
  }

  return (
    <div className="flex flex-col gap-3">
      <ApplicationsTable
        applications={sortedApplications}
        columns={columns}
        resumes={resumes}
        onCellChange={handleCellChange}
        onDeleteRow={handleDeleteRow}
        onAddRow={handleAddRow}
        onRowMove={handleRowMove}
        onColumnMove={handleColumnMove}
        rowDragEnabled={boardConfig.sort.length === 0}
        renderHeaderCell={(column) => (
          <ColumnHeader
            column={column}
            sort={boardConfig.sort}
            onToggleSort={handleToggleSort}
            onEdit={(col) => setColumnModal({ mode: 'edit', column: col })}
            onDelete={handleDeleteColumn}
          />
        )}
        headerAccessory={
          <button
            type="button"
            onClick={() => setColumnModal({ mode: 'add' })}
            title="Add a custom column"
            className="whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
          >
            + Column
          </button>
        }
      />

      {columnModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={columnModal.mode === 'add' ? 'Add column' : 'Edit column'}
          className="fixed inset-0 z-40 flex items-center justify-center bg-indigo-950/30 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setColumnModal(null)
          }}
        >
          <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-xl">
            <h2 className="mb-3 text-sm font-semibold text-indigo-900">
              {columnModal.mode === 'add' ? 'Add column' : `Edit "${columnModal.column.label}"`}
            </h2>
            <ColumnForm
              initial={columnModal.mode === 'edit' ? columnModal.column : undefined}
              onSubmit={handleColumnFormSubmit}
              onCancel={() => setColumnModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
