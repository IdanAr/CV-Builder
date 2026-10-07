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

/** Everything the inbox can filter by: the five funnel stages plus the archive. */
export const PIPELINE_FILTERS = [...PIPELINE_STAGES, 'archive'] as const
export type PipelineFilter = (typeof PIPELINE_FILTERS)[number]

export const FILTER_LABELS: Record<PipelineFilter, string> = { ...STAGE_LABELS, archive: 'Archive' }

export function parsePipelineFilter(value: string | null | undefined): PipelineFilter | null {
  return (PIPELINE_FILTERS as readonly string[]).includes(value ?? '') ? (value as PipelineFilter) : null
}

const LIVE = { deletedAt: { $exists: false } } as const
const UNACTED = { $in: ['new', 'notified'] }

/**
 * The Mongo filter that returns exactly the jobs for which `stageOf(job)` is
 * `filter`. The inbox's list and its counts both go through this, so the stage
 * a row is labelled with and the stage tab it was found under cannot disagree.
 * An integration test proves the equivalence for every status x notify x
 * tombstone combination.
 */
export function stageQuery(filter: PipelineFilter): Record<string, unknown> {
  switch (filter) {
    case 'found':
      return { status: UNACTED, resolvedActions: { $ne: 'notify' }, ...LIVE }
    case 'matched':
      return { status: UNACTED, resolvedActions: 'notify', ...LIVE }
    case 'drafted':
      return { status: 'needs_review', ...LIVE }
    case 'ready':
      return { status: 'queued', ...LIVE }
    case 'applied':
      return { status: 'submitted', ...LIVE }
    case 'archive':
      return { $or: [{ status: { $in: ['dismissed', 'expired'] } }, { deletedAt: { $exists: true } }] }
    default: {
      const unreachable: never = filter
      return unreachable
    }
  }
}
