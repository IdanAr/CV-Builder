'use client'

import Link from 'next/link'
import { ClipboardList, FileText, Plus } from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

// Mirrors EmptyDashboardState's pattern: explain the feature, offer a CTA
// that doesn't require starting from a resume, and point at the resume path.
export function EmptyApplicationsState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card padding="lg" className="py-12 text-center">
      <h2 className="text-base font-medium text-fg-heading">Track your job applications</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">
        One row per application: status, resume used, notes, and any custom columns you add. Every
        change is logged with a timestamp.
      </p>
      <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
        <Card padding="lg" className="flex flex-col text-left">
          <ClipboardList className="h-6 w-6 text-fg-muted" aria-hidden="true" />
          <h3 className="mt-3 text-base font-medium text-fg-heading">Start tracking</h3>
          <p className="mb-4 mt-1 flex-1 text-sm text-fg-muted">
            Add your first application and fill it in right in the table.
          </p>
          <Button variant="primary" size="md" onClick={onCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Application
          </Button>
        </Card>
        <Card padding="lg" className="flex flex-col text-left">
          <FileText className="h-6 w-6 text-fg-muted" aria-hidden="true" />
          <h3 className="mt-3 text-base font-medium text-fg-heading">Track from a CV</h3>
          <p className="mb-4 mt-1 flex-1 text-sm text-fg-muted">
            Use Track application in a CV&apos;s actions menu to create a pre-filled row
            linked to that CV.
          </p>
          <Link
            href="/dashboard/cvs"
            className={buttonClasses({ variant: 'secondary', size: 'md' })}
          >
            Go to My CVs
          </Link>
        </Card>
      </div>
    </Card>
  )
}
