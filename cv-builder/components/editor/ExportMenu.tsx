'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ExportMode } from '@/lib/export-mode'

export interface ExportMenuProps {
  onExport: (format: 'pdf' | 'docx', mode: ExportMode) => void
}

export function ExportMenu({ onExport }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      const insideTrigger = containerRef.current?.contains(target) ?? false
      const insideMenu = menuRef.current?.contains(target) ?? false
      if (!insideTrigger && !insideMenu) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
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
    <div ref={containerRef} className="relative">
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
      {mounted && open && menuPosition && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ top: menuPosition.top, right: menuPosition.right }}
          className="fixed z-[100] w-56 overflow-hidden rounded-xl border border-white/40 bg-white/90 shadow-xl backdrop-blur-xl"
        >
          {item('PDF — Designed', 'Exact match of the preview', 'pdf', 'designed')}
          {item('PDF — ATS-optimized', 'Single-column, parser-safe', 'pdf', 'ats')}
          <div className="my-1 border-t border-indigo-100" aria-hidden="true" />
          {item('DOCX — Designed', 'Exact match of the preview', 'docx', 'designed')}
          {item('DOCX — ATS-optimized', 'Single-column, parser-safe', 'docx', 'ats')}
        </div>,
        document.body
      )}
    </div>
  )
}
