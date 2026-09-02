'use client'

/**
 * Error boundary for every authenticated route.
 *
 * `app/(dashboard)/layout.tsx` wraps its whole subtree in `PlasmaBackground`,
 * which mounts a WebGL canvas. `EditorErrorBoundary` only guards individual
 * editor panels several levels below that, so before this file existed any
 * client-side throw from the layout itself — or from a page with no boundary of
 * its own — fell through to Next's default error screen with no way back into
 * the app.
 *
 * Next.js remounts the segment when `reset()` is called, which is enough to
 * recover from a transient failure without a full page load.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="max-w-md rounded-xl border border-indigo-200 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
        <h1 className="text-xl font-semibold text-indigo-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-indigo-700">
          This page didn&apos;t load correctly. Your saved CVs and applications are unaffected.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-indigo-600">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-[44px] rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="min-h-[44px] rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50"
          >
            Back to my CVs
          </a>
        </div>
      </div>
    </div>
  )
}
