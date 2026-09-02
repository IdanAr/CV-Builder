import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The one button.
 *
 * The interface had 192 hand-styled buttons across 58 files, and the primary
 * button alone existed in 18 distinct class strings — same intent, eighteen
 * spellings, drifting in radius, padding, transition and disabled treatment.
 * The variants below are not invented: each is the dominant spelling already
 * in the codebase, re-expressed against the design tokens, so adopting the
 * primitive keeps a button looking the way it looks today.
 *
 * Two things are deliberately *not* carried over from the call sites:
 *
 *   Focus is `focus-visible`, not `focus`. Keyboard users get a ring;
 *   mouse users no longer get one stuck on the button after a click. The ring
 *   is the `ring` token (4.1:1) rather than the 2.0–2.8:1 rings in use, which
 *   fell short of the 3:1 that WCAG 2.2 SC 1.4.11 asks of a focus indicator.
 *
 *   Every size clears 24x24 CSS pixels, the floor set by SC 2.5.8 (Target
 *   Size, Minimum). Fourteen buttons in the audit did not.
 */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'soft'
  | 'ghost'
  | 'danger'
  | 'dangerGhost'
  | 'link'

export type ButtonSize = 'xs' | 'sm' | 'md' | 'icon'

const VARIANT: Record<ButtonVariant, string> = {
  /** The page's main action. One per view, ideally. */
  primary: 'bg-primary text-primary-fg shadow-sm hover:bg-primary-hover',
  /** Sits beside a primary without competing with it. */
  secondary:
    'border border-border bg-surface/50 text-fg-body hover:bg-surface-subtle hover:border-border-input',
  /** A filled but quiet action — toolbars, chips, segmented controls. */
  soft: 'bg-secondary text-secondary-fg hover:bg-accent-200',
  /** No chrome until you touch it. Icon buttons and tertiary actions. */
  ghost: 'text-fg-muted hover:bg-surface-subtle hover:text-fg-body',
  /** Destructive and unmistakable. */
  danger: 'bg-danger-600 text-primary-fg shadow-sm hover:bg-danger-700',
  /** Destructive, but not the loudest thing on screen. */
  dangerGhost: 'text-fg-danger hover:bg-surface-danger',
  /**
   * Reads as a link, behaves as a button. For genuine navigation use `Link`
   * with `buttonClasses({ variant: 'link' })` instead — a real destination
   * belongs in an anchor so it can be opened in a new tab.
   */
  link: 'text-fg-body underline-offset-4 hover:underline',
}

/**
 * Heights are floors, not fixed values, so a button that wraps or carries a
 * two-line label still grows. `min-h-6` is 24px — the SC 2.5.8 target floor —
 * and applies even to `xs`, whose padding alone would leave it at 22px.
 */
const SIZE: Record<ButtonSize, string> = {
  xs: 'min-h-6 gap-1 rounded-control px-2.5 py-1 text-xs',
  sm: 'min-h-8 gap-1.5 rounded-control px-3 py-1.5 text-sm',
  md: 'min-h-10 gap-1.5 rounded-control px-4 py-2 text-sm',
  /** Square, for a button whose whole label is an icon. */
  icon: 'h-8 w-8 rounded-control',
}

export interface ButtonOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

/**
 * The class string on its own, for the cases that cannot be a `<button>` —
 * chiefly `next/link`, where the element must stay an anchor to keep
 * middle-click and "open in new tab" working.
 */
export function buttonClasses({
  variant = 'primary',
  size = 'sm',
  className,
}: ButtonOptions = {}): string {
  return cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
    'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'focus-visible:ring-offset-1 focus-visible:ring-offset-surface-page',
    // A disabled control still has to be readable: `opacity-50` on top of an
    // already-muted foreground is what pushed several of these under 3:1.
    'disabled:pointer-events-none disabled:opacity-60',
    VARIANT[variant],
    SIZE[size],
    className
  )
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      // Defaulting to `type="button"` rather than the HTML default of
      // "submit": most of these live inside a form but are not the submit
      // action, and an unmarked button there submits the form on Enter.
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  )
})
