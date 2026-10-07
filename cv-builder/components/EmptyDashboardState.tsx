'use client'

import NewResumeButton from './NewResumeButton'
import UploadCVButton from './UploadCVButton'
import { Card } from '@/components/ui/Card'

export function EmptyDashboardState() {
  return (
    <Card padding="lg" className="px-6 py-12 text-center">
      <h2 className="text-lg font-medium text-fg-heading">Let&apos;s build your first CV</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">
        Import your existing CV or start fresh. Either way you get a live preview and an ATS score.
      </p>
      <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
        <Card padding="lg" className="flex flex-col text-left">
          <span className="text-2xl" aria-hidden="true">📄</span>
          <h3 className="mt-3 font-medium text-fg-heading">Upload your existing CV</h3>
          <p className="mb-4 mt-1 flex-1 text-sm text-fg-muted">
            PDF or Word. We extract everything automatically and show you your ATS score.
          </p>
          <UploadCVButton variant="hero" />
        </Card>
        <Card padding="lg" className="flex flex-col text-left">
          <span className="text-2xl" aria-hidden="true">✨</span>
          <h3 className="mt-3 font-medium text-fg-heading">Start from scratch</h3>
          <p className="mb-4 mt-1 flex-1 text-sm text-fg-muted">
            A guided editor with 5 ATS-safe templates and live PDF-accurate preview.
          </p>
          <NewResumeButton variant="hero" />
        </Card>
      </div>
    </Card>
  )
}
