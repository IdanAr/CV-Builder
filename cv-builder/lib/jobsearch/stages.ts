import type { ScrapedJobStatus } from '@/lib/schemas/jobsearch.zod'

/** The funnel, in order. A single source of truth for the Overview, the sidebar count and the pipeline inbox. */
export const PIPELINE_STAGES = ['found', 'matched', 'drafted', 'ready', 'applied'] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const STAGE_LABELS: Record<PipelineStage, string> = {
  found: 'Found',
  matched: 'Matched',
  drafted: 'Drafted',
  ready: 'Ready',
  applied: 'Applied',
}

export interface StageInput {
  status: ScrapedJobStatus
  resolvedActions?: readonly string[]
  deletedAt?: Date | string | null
}

/**
 * Which stage a scraped job is in. `archive` is not a stage of the funnel: it
 * holds dismissed, expired and soft-deleted jobs.
 */
export function stageOf(job: StageInput): PipelineStage | 'archive' {
  if (job.deletedAt) return 'archive'
  switch (job.status) {
    case 'dismissed':
    case 'expired':
      return 'archive'
    case 'submitted':
      return 'applied'
    case 'queued':
      return 'ready'
    case 'needs_review':
      return 'drafted'
    case 'new':
    case 'notified':
      return job.resolvedActions?.includes('notify') ? 'matched' : 'found'
    default: {
      const unreachable: never = job.status
      return unreachable
    }
  }
}
