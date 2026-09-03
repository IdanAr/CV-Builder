import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Status pills. Every tone pairs a token surface with the matching AA-rated
 * foreground, which is the part the hand-rolled pills kept getting wrong —
 * `text-indigo-500` on `bg-indigo-50` is 4.0:1, under the 4.5:1 floor for text
 * this size.
 */

export type BadgeTone = 'accent' | 'neutral' | 'danger' | 'success' | 'warning'

const TONE: Record<BadgeTone, string> = {
  accent: 'bg-surface-subtle text-fg-body',
  neutral: 'bg-neutral-100 text-fg-subtle',
  danger: 'bg-surface-danger text-fg-danger',
  success: 'bg-surface-success text-fg-success',
  warning: 'bg-surface-warning text-fg-warning',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

export function Badge({ tone = 'accent', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5',
        'text-xs font-medium',
        TONE[tone],
        className
      )}
      {...props}
    />
  )
}
