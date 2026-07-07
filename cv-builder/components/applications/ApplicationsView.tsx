'use client'

// Client orchestrator for the applications page: owns the applications +
// board-config state, optimistic cell edits, and the recoverable-delete
// (optimistic-hide + undo toast) flow shared by the table and board views.
import { useEffect, useRef, useState } from 'react'
import { toast, useToastStore } from '@/lib/stores/toast.store'
import { onToastPause, onToastResume } from '@/components/ui/Toaster'
import type { BoardColumn, CustomFieldValue } from '@/lib/schemas/application.zod'
import type { ApplicationRow, BoardConfigData, ResumeOption } from '@/lib/applications/types'
import { buildCellPatch } from '@/lib/applications/cells'
import ApplicationsTable from './ApplicationsTable'
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
  const [boardConfig] = useState(initialBoardConfig)
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set())
  const pendingDeletesRef = useRef(new Map<string, PendingDelete>())

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

  if (applications.length === 0) {
    return <EmptyApplicationsState onCreate={handleAddRow} />
  }

  return (
    <div className="flex flex-col gap-3">
      <ApplicationsTable
        applications={visibleApplications}
        columns={columns}
        resumes={resumes}
        onCellChange={handleCellChange}
        onDeleteRow={handleDeleteRow}
        onAddRow={handleAddRow}
      />
    </div>
  )
}
