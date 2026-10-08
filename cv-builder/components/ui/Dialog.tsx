'use client'

import type { ReactNode } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

/**
 * The app's modal primitive over Radix Dialog.
 *
 * A centered card from `sm` up, a full-height sheet below it: the header and
 * footer stay put and only the body scrolls, so the primary action is always
 * reachable on a phone (`h-dvh`, not `h-screen`, so the browser's collapsing
 * address bar does not hide the footer).
 *
 * Closing is a request, not a command: Escape, an outside press and the close
 * button all call `onOpenChange(false)` and the caller decides whether to
 * close. The profile form uses that to ask before discarding edits.
 *
 * There is no `Dialog.Trigger` (callers open it from their own state), so
 * Radix has nowhere to return focus to; pass `returnFocusTo` for that.
 */
export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  footer?: ReactNode
  children: ReactNode
  returnFocusTo?: HTMLElement | null
  /** Tried at close time when `returnFocusTo` is missing or has left the DOM. */
  fallbackReturnFocusTo?: HTMLElement | null
  /** Override where focus lands on open (default: Radix focuses the first focusable). */
  onOpenAutoFocus?: (event: Event) => void
}

export function Dialog({ open, onOpenChange, title, description, footer, children, returnFocusTo, fallbackReturnFocusTo, onOpenAutoFocus }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-fg-heading/40" />
        <DialogPrimitive.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={(event) => {
            const target = [returnFocusTo, fallbackReturnFocusTo].find((el) => el?.isConnected)
            if (target) {
              event.preventDefault()
              target.focus()
            }
          }}
          className={cn(
            'fixed z-50 flex flex-col bg-surface focus-visible:outline-none',
            'max-sm:inset-0 max-sm:h-dvh',
            'sm:left-1/2 sm:top-1/2 sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:w-[calc(100%-2rem)] sm:max-w-[35rem]',
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-overlay sm:border sm:border-border sm:shadow-popover'
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogPrimitive.Title className="break-words text-base font-medium text-fg-heading">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-sm text-fg-subtle">{description}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className="shrink-0">
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="border-t border-border-subtle px-5 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
