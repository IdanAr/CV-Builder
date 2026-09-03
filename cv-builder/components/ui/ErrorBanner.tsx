import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The job-search error banner.
 *
 * This exact markup was written out eleven times across eight files, and ten of
 * those copies forgot `role="alert"` — so a scan that failed, a rule that would
 * not save, or a queue that errored simply appeared on screen and was never
 * announced. A sighted user sees a red box; a screen-reader user gets silence
 * and a form that seems to have done nothing.
 *
 * `alert` rather than `status` because these interrupt a task the user just
 * attempted: the request they made did not happen, and waiting for the next
 * natural pause to say so is too late to be useful.
 *
 * The tone is the danger token pair (danger-700 on danger-50, 5.8:1) rather
 * than the raw red utilities the copies used.
 */
export function ErrorBanner({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-control bg-surface-danger px-3 py-2 text-sm text-fg-danger',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
