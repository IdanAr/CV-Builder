'use client'

import { useEffect, useRef, useState } from 'react'
import type { ExportMode } from '@/lib/export-mode'

export interface ExportMenuProps {
  onExport: (format: 'pdf' | 'docx', mode: ExportMode) => void
}

export function ExportMenu({ onExport }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

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
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Export options"
        className="text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 transition-colors"
      >
        Export ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-56 rounded border border-indigo-100 bg-white shadow-lg z-50 py-1"
        >
          {item('PDF — Designed', 'Exact match of the preview', 'pdf', 'designed')}
          {item('PDF — ATS-optimized', 'Single-column, parser-safe', 'pdf', 'ats')}
          <div className="my-1 border-t border-indigo-100" aria-hidden="true" />
          {item('DOCX — Designed', 'Exact match of the preview', 'docx', 'designed')}
          {item('DOCX — ATS-optimized', 'Single-column, parser-safe', 'docx', 'ats')}
        </div>
      )}
    </div>
  )
}
