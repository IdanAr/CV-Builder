import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The panel container: 37 distinct spellings of "bordered white box" existed
 * across the app, differing in radius, border tint, background alpha and
 * whether they blurred what was behind them. These three tones are the ones
 * actually in use, re-expressed against the tokens.
 */

export type CardTone =
  /** The default. Translucent, so the page's gradient shows through. */
  | 'default'
  /** Opaque. For anything that sits above the page — dialogs, popovers. */
  | 'raised'
  /** No fill, just an outline. Empty states and drop zones. */
  | 'outline'

const TONE: Record<CardTone, string> = {
  default: 'border-border-subtle bg-surface/70 shadow-sm backdrop-blur-sm',
  raised: 'border-border-subtle bg-surface shadow-xl',
  outline: 'border-border-subtle bg-surface/50 shadow-none',
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
