'use client'

import { useEffect, useRef } from 'react'

export interface PipelineShortcutHandlers {
  move(delta: 1 | -1): void
  /** Enter */
  openSelected(): void
  /** A (the caller checks isOneStep before running) */
  runPrimary(): void
  /** D */
  dismissSelected(): void
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    target.contentEditable === 'true'
  )
}

/**
 * Optional keyboard shortcuts for the pipeline inbox. Never the only way to do
 * anything, and ignored while typing or when a modifier is held.
 */
export function usePipelineShortcuts(handlers: PipelineShortcutHandlers, enabled = true): void {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      const h = ref.current
      switch (event.key) {
        case 'j':
        case 'J':
          h.move(1)
          break
        case 'k':
        case 'K':
          h.move(-1)
          break
        case 'a':
        case 'A':
          h.runPrimary()
          break
        case 'd':
        case 'D':
          h.dismissSelected()
          break
        case 'Enter': {
          const t = event.target
          if (t instanceof HTMLElement && (t.tagName === 'BUTTON' || t.tagName === 'A')) return
          h.openSelected()
          break
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
