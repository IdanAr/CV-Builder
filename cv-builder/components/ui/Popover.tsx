'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface PopoverProps {
  /** The element that toggles the popover. Rendered as the sole child of the popover's positioning wrapper. */
  trigger: ReactElement
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

/** Keyboard-reachable elements, in DOM order, used to find the panel's entry point. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Generic popover primitive: owns outside-click detection, Escape-to-close, and
 * focus-return to the trigger on close, plus fixed-position portal rendering anchored
 * below/right-aligned to the trigger. Callers own everything visual — the trigger
 * itself and the panel's contents/styling/ARIA role — via `trigger` and `children`.
 *
 * Focus is moved *into* the panel on open. The panel is portaled to
 * `document.body`, so it lands at the end of the DOM and is therefore not in the
 * trigger's tab sequence — without this, a keyboard user could open a popover and
 * Escape out of it but never reach its contents (AiSuggestButton's "Use this" /
 * "Dismiss" buttons were unreachable this way, so a suggestion could be dismissed
 * but never accepted).
 */
export function Popover({ trigger, open, onOpenChange, children }: PopoverProps) {
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  /** Guards the focus-into-panel effect so it fires once per open cycle, not on every reposition. */
  const focusEnteredRef = useRef(false)
  /** Whether focus currently sits inside the panel; decides if closing should return it to the trigger. */
  const focusInsidePanelRef = useRef(false)
  /** Previous `open`, so the restore effect can detect the true→false transition. */
  const prevOpenRef = useRef(open)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    function updatePosition() {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      // Default/fallback placement: below and right-aligned to the trigger.
      // The layout effect below flips this to "above" post-measurement when
      // there isn't room below.
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

  // Auto-flip: once the panel has actually mounted at its default
  // below-the-trigger position, measure its real rendered height and, if it
  // doesn't fit between the trigger and the bottom of the viewport but does
  // fit above the trigger, reposition it there instead. Runs in a layout
  // effect (synchronous, pre-paint) so the correction — when needed — lands
  // in the same commit as the initial below-position render and isn't
  // visibly flashed.
  useLayoutEffect(() => {
    if (!open || !menuPosition) return
    const triggerRect = containerRef.current?.getBoundingClientRect()
    const panelHeight = panelRef.current?.getBoundingClientRect().height
    if (!triggerRect || !panelHeight) return

    const fitsBelow = triggerRect.bottom + panelHeight + 8 <= window.innerHeight
    if (fitsBelow) return

    const fitsAbove = triggerRect.top > panelHeight + 8
    if (!fitsAbove) return // neither side fits cleanly — keep the below fallback

    const flippedTop = triggerRect.top - panelHeight - 8
    setMenuPosition((prev) => {
      if (!prev || Math.abs(prev.top - flippedTop) < 0.5) return prev
      return { ...prev, top: flippedTop }
    })
  }, [open, menuPosition])

  // Declared before the focus-entry effect below so the `focusin` listener is
  // already attached when that effect moves focus into the panel — otherwise the
  // very first focusin (the one we cause) would be missed and closing wouldn't
  // know focus had ever been inside.
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      const insideTrigger = containerRef.current?.contains(target) ?? false
      const insideMenu = panelRef.current?.contains(target) ?? false
      if (!insideTrigger && !insideMenu) {
        // The user is clicking something else; that element is about to take
        // focus as the click's default action. Forget that focus was in the
        // panel so the close below doesn't yank it back to the trigger.
        focusInsidePanelRef.current = false
        onOpenChange(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onOpenChange(false)
        ;(containerRef.current?.firstElementChild as HTMLElement | null)?.focus()
      }
    }
    function onFocusIn(e: FocusEvent) {
      focusInsidePanelRef.current = panelRef.current?.contains(e.target as Node) ?? false
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [open, onOpenChange])

  // Move focus into the panel once it exists. `menuPosition` is a dependency
  // because the panel only renders after the first position is measured, so an
  // effect keyed on `open` alone would run while panelRef is still null;
  // `focusEnteredRef` keeps this to once per open cycle despite `menuPosition`
  // also changing on scroll, resize and auto-flip.
  useEffect(() => {
    if (!open) {
      focusEnteredRef.current = false
      return
    }
    if (focusEnteredRef.current) return
    const panel = panelRef.current
    if (!panel) return
    focusEnteredRef.current = true
    panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()
  }, [open, menuPosition])

  // Return focus to the trigger when the popover closes while focus was inside
  // it — i.e. a programmatic close such as choosing a menu item. Escape restores
  // focus itself (above), and an outside click clears the flag so the element the
  // user clicked keeps focus.
  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open
    if (!wasOpen || open || !focusInsidePanelRef.current) return
    focusInsidePanelRef.current = false
    ;(containerRef.current?.firstElementChild as HTMLElement | null)?.focus()
  }, [open])

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
