'use client'

import { useState } from 'react'
import type { ExportMode } from '@/lib/export-mode'
import { Popover } from '@/components/ui/Popover'
import { Button } from '@/components/ui/Button'

export interface ExportMenuProps {
  onExport: (format: 'pdf' | 'docx', mode: ExportMode) => void
  /** True while an export is in flight; disables the trigger to stop duplicate requests. */
  busy?: boolean
  /** When provided, adds a "JSON - Raw data" item after the file formats. */
  onJsonExport?: () => void
}

function focusMenuItem(container: HTMLElement, direction: 1 | -1) {
  const items = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
  if (items.length === 0) return
  const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
  const nextIndex =
    currentIndex === -1
      ? (direction === 1 ? 0 : items.length - 1)
      : (currentIndex + direction + items.length) % items.length
  items[nextIndex]?.focus()
}

export function ExportMenu({ onExport, busy = false, onJsonExport }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  // Derived rather than synced through an effect: while an export is running
  // the menu stays shut, so the trigger's in-flight state is what the user
  // sees instead of a live-looking list that would queue a second render.
  const menuOpen = open && !busy

  const rawItem = (label: string, sub: string, onSelect: () => void) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => { setOpen(false); onSelect() }}
      className="w-full rounded-control px-3 py-2 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-10"
    >
      <span className="block text-xs font-medium text-fg">{label}</span>
      <span className="block text-[10px] text-fg-muted">{sub}</span>
    </button>
  )
  const item = (label: string, sub: string, format: 'pdf' | 'docx', mode: ExportMode) =>
    rawItem(label, sub, () => onExport(format, mode))

  return (
    <Popover
      open={menuOpen}
      onOpenChange={setOpen}
      trigger={
        <Button
          size="md"
          disabled={busy}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-busy={busy}
          aria-label={busy ? 'Exporting, please wait' : 'Export options'}
          className="shrink-0 px-3 focus-visible:outline-none"
        >
          {busy ? 'Exporting…' : 'Export ▾'}
        </Button>
      }
    >
      <div
        ref={(el) => { el?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus() }}
        role="menu"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); focusMenuItem(e.currentTarget, 1) }
          if (e.key === 'ArrowUp') { e.preventDefault(); focusMenuItem(e.currentTarget, -1) }
        }}
        className="w-56 overflow-hidden rounded-card border border-border bg-surface p-1 shadow-popover"
      >
        {item('PDF - Designed', 'Exact match of the preview', 'pdf', 'designed')}
        {item('PDF - ATS-optimized', 'Single-column, parser-safe', 'pdf', 'ats')}
        <div className="my-1 border-t border-border" aria-hidden="true" />
        {item('DOCX - Designed', 'Exact match of the preview', 'docx', 'designed')}
        {item('DOCX - ATS-optimized', 'Single-column, parser-safe', 'docx', 'ats')}
        {onJsonExport && (
          <>
            <div className="my-1 border-t border-border" aria-hidden="true" />
            {rawItem('JSON - Raw data', 'Resume data and design settings', onJsonExport)}
          </>
        )}
      </div>
    </Popover>
  )
}
