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
 * Stand-in for `AppNavbar`, which every authenticated page renders itself
 * rather than inheriting from the group layout. A `loading.tsx` therefore
 * replaces the navbar too, and without this the bar would vanish and the page
 * would jump 64-80px the moment content arrived.
 *
 * The geometry deliberately mirrors AppNavbar's own `min-h-[64px] py-2
 * md:h-20`; if that changes, this has to change with it.
 */
export function NavbarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="w-full border-b border-white/30 bg-surface/55 shadow-sm backdrop-blur-xl"
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[64px] items-center gap-3 py-2 md:h-20 md:py-0">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="ml-auto h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>
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
