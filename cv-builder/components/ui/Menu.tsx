'use client'

import { DropdownMenu } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * The app's dropdown-menu primitive, wrapping Radix's DropdownMenu with the
 * styling and behaviour both navbar menus already had.
 *
 * It replaces two near-identical hand-rolled implementations (UserProfileButton
 * and JobSearchNav) that each carried ~60 lines of portal, scroll/resize
 * repositioning, outside-click, Escape and roving-focus code. Three things the
 * hand-rolled versions got wrong and this does not:
 *
 *  - Dismissal listened for `mousedown`, a mouse-only event. Radix listens for
 *    `pointerdown`, so tapping outside a menu dismisses it on touch devices too.
 *  - Positioning was `top: rect.bottom + 8; right: innerWidth - rect.right`
 *    with a vertical flip only. Nothing corrected horizontal overflow, so a
 *    menu with no room to its left ran off the edge of a narrow viewport.
 *    Radix collision-detects on both axes — hence `collisionPadding`.
 *  - JobSearchNav had no arrow-key navigation at all: its items were
 *    `tabIndex={-1}` with only the first focused, so a keyboard user could open
 *    the menu and reach exactly one of its two items.
 *
 * `loop` is the one Radix default deliberately overridden, because Radix stops
 * at the ends where both hand-rolled menus wrapped. Focus-on-open needs no
 * override: Radix already focuses the first item when the menu is opened from
 * the keyboard (Enter/Space/ArrowDown) — verified, not assumed — and focuses
 * the panel itself only for pointer opens, where highlighting a row the user
 * never asked for is the worse behaviour. Note that Radix does expose an
 * `onOpenAutoFocus` that would force it either way, but it lives in
 * `MenuContentImplPrivateProps` and is `Omit`ted from the public Content type,
 * so building on it would mean depending on internals.
 */
export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger
export const MenuGroup = DropdownMenu.Group

export function MenuContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="end"
        sideOffset={8}
        // Keeps the panel clear of the viewport edge once collision detection
        // has shifted it — the correction the hand-rolled `right:` offset never
        // made on narrow screens.
        collisionPadding={8}
        loop
        className={cn(
          'z-[100] overflow-hidden rounded-xl border border-white/40 bg-white/90 shadow-xl backdrop-blur-xl',
          className
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  )
}

export function MenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenu.Item>) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-indigo-900 outline-none transition',
        'hover:bg-indigo-50/70 data-[highlighted]:bg-indigo-50/70',
        className
      )}
      {...props}
    />
  )
}
