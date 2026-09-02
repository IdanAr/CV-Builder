'use client'

import { useState } from 'react'
import type { ExportMode } from '@/lib/export-mode'
import { Popover } from '@/components/ui/Popover'

export interface ExportMenuProps {
  onExport: (format: 'pdf' | 'docx', mode: ExportMode) => void
  /** True while an export is in flight; disables the trigger to stop duplicate requests. */
  busy?: boolean
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

export function ExportMenu({ onExport, busy = false }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  // Derived rather than synced through an effect: while an export is running
  // the menu stays shut, so the trigger's in-flight state is what the user
  // sees instead of a live-looking list that would queue a second render.
  const menuOpen = open && !busy

  const item = (label: string, sub: string, format: 'pdf' | 'docx', mode: ExportMode) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => { setOpen(false); onExport(format, mode) }}
      className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors"
    >
      <span className="block text-xs font-medium text-indigo-900">{label}</span>
      <span className="block text-[10px] text-indigo-400">{sub}</span>
    </button>
  )

  return (
    <Popover
      open={menuOpen}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={busy}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-busy={busy}
          aria-label={busy ? 'Exporting, please wait' : 'Export options'}
          className="text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
        >
          {busy ? 'Exporting…' : 'Export ▾'}
        </button>
      }
    >
      <div
        ref={(el) => { el?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus() }}
        role="menu"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); focusMenuItem(e.currentTarget, 1) }
          if (e.key === 'ArrowUp') { e.preventDefault(); focusMenuItem(e.currentTarget, -1) }
        }}
        className="w-56 overflow-hidden rounded-xl border border-white/40 bg-white/90 shadow-xl backdrop-blur-xl"
      >
        {item('PDF - Designed', 'Exact match of the preview', 'pdf', 'designed')}
        {item('PDF - ATS-optimized', 'Single-column, parser-safe', 'pdf', 'ats')}
        <div className="my-1 border-t border-indigo-100" aria-hidden="true" />
        {item('DOCX - Designed', 'Exact match of the preview', 'docx', 'designed')}
        {item('DOCX - ATS-optimized', 'Single-column, parser-safe', 'docx', 'ats')}
      </div>
    </Popover>
  )
}
