'use client'

import { Popover as PopoverPrimitive } from 'radix-ui'
import type { ReactElement, ReactNode } from 'react'

export interface PopoverProps {
  /** The element that toggles the popover. Rendered as the popover's trigger and anchor. */
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
 * Generic popover primitive over Radix's Popover. Callers own everything
 * visual — the trigger itself and the panel's contents, styling and ARIA role —
 * via `trigger` and `children`, and own the open state via `open`/`onOpenChange`.
 *
 * This replaced a hand-rolled implementation of the same API: portal, fixed
 * positioning, outside-click, Escape, and focus entry/return, about 120 lines.
 * The behaviours that version had are all preserved (each is covered by a test
 * in Popover.test.tsx), but two were wrong and are not:
 *
 *  - Dismissal listened for `mousedown`, a mouse-only event; Radix listens for
 *    `pointerdown`, so a tap outside dismisses on touch devices too.
 *  - Positioning was `top: rect.bottom + 8; right: innerWidth - rect.right`
 *    with a vertical flip only. Horizontal overflow was never corrected, so on
 *    a narrow viewport a panel wider than the space to its left simply ran off
 *    the screen — and several of these panels are 224-320px inside a 375px
 *    phone. `collisionPadding` now shifts on both axes.
 *
 * Focus is moved *into* the panel on open. The panel is portaled to the end of
 * document.body, so it is not in the trigger's tab sequence — without this a
 * keyboard user could open a popover and Escape out of it but never reach its
 * contents (AiSuggestButton's "Use this" / "Dismiss" buttons were unreachable
 * this way, so a suggestion could be dismissed but never accepted). Radix's own
 * default focuses the panel container instead, so `onOpenAutoFocus` overrides
 * it — a public prop on Popover.Content, unlike the same-named prop on
 * DropdownMenu.Content, which is Omit-ted from the public type.
 *
 * `preventDefault()` there also covers the empty case: a panel with nothing
 * focusable takes no focus at all, leaving it on the trigger.
 */
export function Popover({ trigger, open, onOpenChange, children }: PopoverProps) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className="z-[100]"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            const panel = event.currentTarget as HTMLElement | null
            panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()
          }}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
