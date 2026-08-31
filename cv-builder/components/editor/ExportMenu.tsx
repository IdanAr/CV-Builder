'use client'

import { useState } from 'react'
import type { ExportMode } from '@/lib/export-mode'
import { Popover } from '@/components/ui/Popover'

export interface ExportMenuProps {
  onExport: (format: 'pdf' | 'docx', mode: ExportMode) => void
}

export function ExportMenu({ onExport }: ExportMenuProps) {
  const [open, setOpen] = useState(false)

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
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Export options"
          className="text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 transition-colors"
        >
          Export ▾
        </button>
      }
    >
      <div
        ref={(el) => { el?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus() }}
        role="menu"
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
