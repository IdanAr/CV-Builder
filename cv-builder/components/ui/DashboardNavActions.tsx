import type { ReactNode } from 'react'
import Link from 'next/link'
import { UserProfileButton } from '@/components/ui/UserProfileButton'
import { JobSearchNav } from '@/components/jobsearch/JobSearchNav'

/**
 * The authenticated navbar's right-hand cluster.
 *
 * This exact arrangement — cross-section links, a hairline divider, the job
 * search menu and the profile button — was written out five times across
 * app/(dashboard)/**, drifting as it went: the applications page omits the
 * "Applications" link, the dashboard omits "My CVs" and adds "Homepage", and
 * every jobsearch page carries both. `current` encodes that rule (a section
 * never links to itself) so the copies collapse into one component.
 */

export type NavSection = 'resumes' | 'applications' | 'jobsearch'

interface DashboardNavActionsProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  /** The section being viewed. Its own link is omitted from the cluster. */
  current: NavSection
  /** Actions rendered flush-left, before the cluster (e.g. "New CV"). */
  leading?: ReactNode
  /** Adds a link to the marketing homepage. Only the résumé library shows it. */
  showHomepage?: boolean
}

const LINK_CLASSES =
  'rounded-control border border-border bg-surface/50 px-3 py-1.5 text-sm font-medium ' +
  'text-fg-body transition hover:bg-surface-subtle focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ' +
  'focus-visible:ring-offset-surface-page'

export function DashboardNavActions({
  user,
  current,
  leading,
  showHomepage = false,
}: DashboardNavActionsProps) {
  return (
    <div className="flex flex-1 flex-wrap items-center gap-3">
      {leading}

      {/* ml-auto on the first cluster item pushes the whole group right,
          whether or not `leading` rendered anything. */}
      {showHomepage && (
        <Link href="/" className={`ml-auto ${LINK_CLASSES}`}>
          Homepage
        </Link>
      )}

      {current !== 'resumes' && (
        <Link href="/dashboard" className={showHomepage ? LINK_CLASSES : `ml-auto ${LINK_CLASSES}`}>
          My CVs
        </Link>
      )}

      {current !== 'applications' && (
        <Link
          href="/dashboard/applications"
          className={
            showHomepage || current !== 'resumes' ? LINK_CLASSES : `ml-auto ${LINK_CLASSES}`
          }
        >
          Applications
        </Link>
      )}

      <div className="h-4 w-px bg-border" />
      <JobSearchNav />
      <UserProfileButton user={user} />
    </div>
  )
}
