import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import NewResumeButton from '@/components/NewResumeButton'
import UploadCVButton from '@/components/UploadCVButton'

export function FirstRun({ hasCvs, hasProfiles }: { hasCvs: boolean; hasProfiles: boolean }) {
  if (hasCvs || hasProfiles) return null
  return (
    <section aria-labelledby="overview-first-run" className="grid gap-4 sm:grid-cols-2">
      <h2 id="overview-first-run" className="sr-only">
        Get started
      </h2>
      <Card padding="lg" className="flex flex-col">
        <h3 className="font-medium text-fg-heading">Create your first CV</h3>
        <p className="mb-4 mt-1 flex-1 text-sm text-fg-muted">
          Start fresh or import a PDF or Word file. You get a live preview and an ATS score.
        </p>
        <div className="flex flex-col gap-2">
          <NewResumeButton variant="hero" />
          <UploadCVButton variant="hero" />
        </div>
      </Card>
      <Card padding="lg" className="flex flex-col">
        <h3 className="font-medium text-fg-heading">Set up a job search</h3>
        <p className="mb-4 mt-1 flex-1 text-sm text-fg-muted">
          Tell us which companies to watch and we find roles that fit your CV.
        </p>
        <Link href="/dashboard/jobsearch" className="text-sm text-fg-body underline underline-offset-4">
          Set up a job search
        </Link>
      </Card>
    </section>
  )
}
