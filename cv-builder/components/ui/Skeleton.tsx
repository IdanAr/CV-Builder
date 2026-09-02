import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Loading placeholder.
 *
 * The app had none, and no route-level `loading.tsx` either, so every await
 * showed the bare page gradient and six jobsearch panels returned `null` while
 * fetching — making "loading", "empty" and "broken" indistinguishable.
 *
 * Deliberately not a client component and deliberately CSS-only: these are
 * consumed from `loading.tsx` files, which are Server Components, so the
 * reduced-motion check has to be `motion-safe:` rather than the
 * `useReducedMotion()` hook used elsewhere in the app.
 *
 * `aria-hidden` throughout: the shape carries no information. A route's
 * loading state should be announced once, by a live region on the container,
 * not by every bar in the layout.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('motion-safe:animate-pulse rounded-control bg-secondary', className)}
      {...props}
    />
  )
}

/**
 * A run of stacked bars standing in for a paragraph. The last line is short,
 * which is what makes a block of bars read as text rather than as a table.
 */
export function SkeletonText({
  lines = 3,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}
