import type { PipelineJob } from './pipeline-types'

export type JobActionId =
  | 'open-posting' | 'track' | 'dismiss' | 'approve' | 'open-cv'
  | 'mark-applied' | 'open-applications' | 'restore' | 'find-again' | 'delete'

export interface JobActionPlan {
  primary: JobActionId | null
  secondary: JobActionId[]
  overflow: JobActionId[]
}

type Planned = Pick<PipelineJob, 'stage' | 'pendingApprovals' | 'draftResumeId' | 'url' | 'deletedAt'>

const ONE_STEP: ReadonlySet<JobActionId> = new Set(['approve', 'mark-applied', 'restore', 'find-again'])
/** `A` runs the primary action only when it finishes in place. Opening a link is never a keyboard shortcut. */
export function isOneStep(id: JobActionId): boolean {
  return ONE_STEP.has(id)
}

/** Only transitions that exist in the product today (spec 7.4). */
export function planActions(job: Planned): JobActionPlan {
  const hasCv = Boolean(job.draftResumeId)
  switch (job.stage) {
    case 'found':
    case 'matched':
      return job.url
        ? { primary: 'open-posting', secondary: ['track', 'dismiss'], overflow: ['delete'] }
        : { primary: 'track', secondary: ['dismiss'], overflow: ['delete'] }
    case 'drafted':
      if (job.pendingApprovals.length > 0) {
        return { primary: 'approve', secondary: [...(hasCv ? (['open-cv'] as const) : []), 'dismiss'], overflow: ['delete'] }
      }
      return { primary: hasCv ? 'open-cv' : null, secondary: ['dismiss'], overflow: ['delete'] }
    case 'ready':
      return { primary: 'mark-applied', secondary: [...(hasCv ? (['open-cv'] as const) : []), 'dismiss'], overflow: ['delete'] }
    case 'applied':
      return { primary: 'open-applications', secondary: [], overflow: [] }
    case 'archive':
      return { primary: job.deletedAt ? 'find-again' : 'restore', secondary: [], overflow: [] }
  }
}
