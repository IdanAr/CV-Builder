'use client'

import NewResumeButton from './NewResumeButton'
import UploadCVButton from './UploadCVButton'

export function EmptyDashboardState() {
  return (
    <div className="rounded-xl border border-indigo-100 bg-white/50 py-12 px-6 text-center backdrop-blur-sm">
      <h2 className="text-lg font-semibold text-indigo-900">Let&apos;s build your first CV</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-indigo-400">
        Import your existing CV or start fresh - either way you get a live preview and an ATS score.
      </p>
      <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-indigo-200 bg-white/70 p-6 text-left shadow-sm">
          <span className="text-2xl" aria-hidden="true">📄</span>
          <h3 className="mt-3 font-semibold text-indigo-900">Upload your existing CV</h3>
          <p className="mb-4 mt-1 flex-1 text-sm text-indigo-400">
            PDF or Word. We extract everything automatically and show you your ATS score.
          </p>
          <UploadCVButton variant="hero" />
        </div>
        <div className="flex flex-col rounded-xl border border-indigo-100 bg-white/70 p-6 text-left shadow-sm">
          <span className="text-2xl" aria-hidden="true">✨</span>
          <h3 className="mt-3 font-semibold text-indigo-900">Start from scratch</h3>
          <p className="mb-4 mt-1 flex-1 text-sm text-indigo-400">
            A guided editor with 5 ATS-safe templates and live PDF-accurate preview.
          </p>
          <NewResumeButton variant="hero" />
        </div>
      </div>
    </div>
  )
}
