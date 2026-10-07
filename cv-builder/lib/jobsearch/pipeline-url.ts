import { parsePipelineFilter, type PipelineFilter } from './stages'

export const PIPELINE_PATH = '/dashboard/jobsearch'

export interface PipelineView {
  stage: PipelineFilter
  profile: string | null
  q: string
  job: string | null
}

export function pipelineHref(view: Partial<PipelineView> = {}): string {
  const params = new URLSearchParams()
  if (view.stage) params.set('stage', view.stage)
  if (view.profile) params.set('profile', view.profile)
  const q = view.q?.trim()
  if (q) params.set('q', q)
  if (view.job) params.set('job', view.job)
  const query = params.toString()
  return query ? `${PIPELINE_PATH}?${query}` : PIPELINE_PATH
}

export function parsePipelineView(
  params: { get(name: string): string | null },
  fallbackStage: PipelineFilter
): PipelineView {
  return {
    stage: parsePipelineFilter(params.get('stage')) ?? fallbackStage,
    profile: params.get('profile') || null,
    q: params.get('q') ?? '',
    job: params.get('job') || null,
  }
}

/** R1: land on what needs the user; Found when nothing does. */
export function defaultStage(counts: { matchedUnread: number; drafted: number; ready: number }): PipelineFilter {
  if (counts.matchedUnread > 0) return 'matched'
  if (counts.drafted > 0) return 'drafted'
  if (counts.ready > 0) return 'ready'
  return 'found'
}
