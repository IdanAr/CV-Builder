'use client'

import type { ReactElement, ReactNode } from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

/**
 * A text label shown on hover and keyboard focus. Used where an icon stands in
 * for a word (the collapsed sidebar). The trigger must still carry its own
 * accessible name; the tooltip is a sighted convenience, not the label.
 */
export function Tooltip({
  content,
  side = 'right',
  children,
}: {
  content: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: ReactElement
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={8}
            className="z-[100] rounded-control bg-fg-heading px-2 py-1 text-xs font-medium text-primary-fg shadow-popover"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
