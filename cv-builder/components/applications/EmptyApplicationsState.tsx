'use client'

import Link from 'next/link'
import { ClipboardList, FileText, Plus } from 'lucide-react'

// Mirrors EmptyDashboardState's pattern: explain the feature, offer a CTA
// that doesn't require starting from a resume, and point at the resume path.
export function EmptyApplicationsState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-white/50 py-12 px-6 text-center backdrop-blur-sm">
      <h2 className="text-lg font-semibold text-indigo-900">Track your job applications</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">
        One row per application - status, resume used, notes, and any custom columns you add. Every
        change is logged with a timestamp.
      </p>
      <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-indigo-200 bg-white/70 p-6 text-left shadow-sm">
          <ClipboardList className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-indigo-900">Start tracking</h3>
          <p className="mb-4 mt-1 flex-1 text-sm text-fg-muted">
            Add your first application and fill it in right in the table.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Application
          </button>
        </div>
        <div className="flex flex-col rounded-xl border border-indigo-100 bg-white/70 p-6 text-left shadow-sm">
          <FileText className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-indigo-900">Track from a CV</h3>
          <p className="mb-4 mt-1 flex-1 text-sm text-fg-muted">
            Use &ldquo;Track&rdquo; on any CV card to create a pre-filled row linked to
            that resume.
          </p>
          <Link
            href="/dashboard"
            className="rounded-lg border border-indigo-300 bg-white/50 px-4 py-2 text-center text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
          >
            Go to My CVs
          </Link>
        </div>
      </div>
    </div>
  )
}
