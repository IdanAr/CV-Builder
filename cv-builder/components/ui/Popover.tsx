'use client'

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface PopoverProps {
  /** The element that toggles the popover. Rendered as the sole child of the popover's positioning wrapper. */
  trigger: ReactElement
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

/**
 * Generic popover primitive: owns outside-click detection, Escape-to-close, and
 * focus-return to the trigger on close, plus fixed-position portal rendering anchored
 * below/right-aligned to the trigger. Callers own everything visual — the trigger
 * itself and the panel's contents/styling/ARIA role — via `trigger` and `children`.
 */
export function Popover({ trigger, open, onOpenChange, children }: PopoverProps) {
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    function updatePosition() {
      const rect = containerRef.current?.getBoundingClientRect()
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
      const insideMenu = panelRef.current?.contains(target) ?? false
      if (!insideTrigger && !insideMenu) onOpenChange(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onOpenChange(false)
        ;(containerRef.current?.firstElementChild as HTMLElement | null)?.focus()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  return (
    <div ref={containerRef} className="relative inline-block">
      {trigger}
      {mounted && open && menuPosition && createPortal(
        <div
          ref={panelRef}
          style={{ top: menuPosition.top, right: menuPosition.right }}
          className="fixed z-[100]"
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  )
}
