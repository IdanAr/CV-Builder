import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The panel container: 37 distinct spellings of "bordered white box" existed
 * across the app, differing in radius, border tint, background alpha and
 * whether they blurred what was behind them. These three tones are the ones
 * actually in use, re-expressed against the tokens.
 */

export type CardTone =
  /** The default. Opaque on a flat page. */
  | 'default'
  /** Opaque. For anything that sits above the page — dialogs, popovers. */
  | 'raised'
  /** No fill, just an outline. Empty states and drop zones. */
  | 'outline'

const TONE: Record<CardTone, string> = {
  /** The default. Opaque, hairline border, no shadow. */
  default: 'border-border bg-surface shadow-none',
  /** Floats above the page: dialogs, popovers. */
  raised: 'border-border bg-surface shadow-popover',
  /** No fill, just an outline. Empty states and drop zones. */
  outline: 'border-border bg-transparent shadow-none',
}

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: CardTone
  padding?: keyof typeof PADDING
}

export function Card({
  tone = 'default',
  padding = 'md',
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn('rounded-card border', TONE[tone], PADDING[padding], className)}
      {...props}
    />
  )
}
