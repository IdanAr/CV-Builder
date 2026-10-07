import { Skeleton } from '@/components/ui/Skeleton'

/** Mirrors the Settings page frame so nothing jumps when content arrives. */
export default function SettingsLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-2xl px-4 py-8">
      <span className="sr-only">Loading settings</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} aria-hidden="true" className="rounded-card border border-border bg-surface p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
