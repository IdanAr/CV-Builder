import { Skeleton, NavbarSkeleton } from '@/components/ui/Skeleton'

/**
 * Shown while `ResumePage` fetches the résumé that `EditorShell` renders.
 *
 * The editor is the app's heaviest route and the one most often opened from a
 * cold navigation, so it is the wait most worth covering. The shape follows
 * `EditorShell`: a full-height, non-scrolling column holding the navbar, then
 * a form pane beside a document preview.
 */
export default function ResumeEditorLoading() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50">
      <NavbarSkeleton />

      <div role="status" aria-live="polite" className="flex min-h-0 flex-1">
        <span className="sr-only">Loading your CV</span>

        {/* Editing pane. */}
        <div
          aria-hidden="true"
          className="hidden w-[420px] shrink-0 flex-col gap-4 border-r border-border-subtle p-4 md:flex"
        >
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="space-y-2 rounded-card border border-border-subtle bg-surface/70 p-3"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>

        {/* Preview pane. A single tall block, because that is what an A4 page
            looks like before it has any content in it. */}
        <div aria-hidden="true" className="flex min-w-0 flex-1 items-start justify-center p-6">
          <Skeleton className="aspect-[1/1.414] w-full max-w-[595px] rounded-card" />
        </div>
      </div>
    </div>
  )
}
