'use client'

import Link from 'next/link'
import { ArrowLeft, Redo2, Undo2 } from 'lucide-react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { Tooltip } from '@/components/ui/Tooltip'
import { ExportMenu } from './ExportMenu'
import type { ExportMode } from '@/lib/export-mode'

export interface EditorTopBarProps {
  onLeave: (e: React.MouseEvent<HTMLAnchorElement>) => void
  onExport: (format: 'pdf' | 'docx', mode: ExportMode) => void
  onJsonExport: () => void
  exporting: boolean
  leaving: boolean
}

const ICON_BUTTON =
  'flex min-h-10 min-w-10 items-center justify-center rounded-control text-fg-body transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'

/** Slim editor header: back link, title, save status, undo/redo, export. */
export function EditorTopBar({ onLeave, onExport, onJsonExport, exporting, leaving }: EditorTopBarProps) {
  const title = useResumeEditorStore((s) => s.title)
  const setTitle = useResumeEditorStore((s) => s.setTitle)
  const isDirty = useResumeEditorStore((s) => s.isDirty)
  const isSaving = useResumeEditorStore((s) => s.isSaving)
  const saveError = useResumeEditorStore((s) => s.saveError)
  const undo = useResumeEditorStore((s) => s.undo)
  const redo = useResumeEditorStore((s) => s.redo)
  const canUndo = useResumeEditorStore((s) => s.canUndo)
  const canRedo = useResumeEditorStore((s) => s.canRedo)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <Link
        href="/dashboard/cvs"
        onClick={onLeave}
        aria-busy={leaving}
        className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-control px-1 text-sm font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">My CVs</span>
      </Link>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Resume title"
        className="min-w-0 flex-1 rounded-control bg-transparent px-2 py-1 text-sm font-semibold text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div
        role="status"
        aria-live="polite"
        title={saveError ?? undefined}
        className={`max-w-[7rem] shrink-0 truncate text-xs ${saveError ? 'text-fg-danger' : 'text-fg-muted'}`}
      >
        {saveError ??
          (isSaving ? (
            'Saving…'
          ) : isDirty ? (
            <span className="rounded-chip bg-surface-attention px-2 py-0.5 text-xs font-medium text-fg-attention">
              Unsaved
            </span>
          ) : (
            'Saved'
          ))}
      </div>

      <Tooltip content="Undo" side="bottom">
        <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo" className={ICON_BUTTON}>
          <Undo2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </Tooltip>
      <Tooltip content="Redo" side="bottom">
        <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo" className={ICON_BUTTON}>
          <Redo2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </Tooltip>

      <ExportMenu onExport={onExport} onJsonExport={onJsonExport} busy={exporting} />
    </header>
  )
}
