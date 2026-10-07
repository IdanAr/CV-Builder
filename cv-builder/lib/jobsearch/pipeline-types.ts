import type { PipelineFilter, PipelineStage } from './stages'

/** One row of the inbox. Dates are ISO strings; `description` is never sent. */
export interface PipelineJob {
  _id: string
  profileId: string
  profileName?: string
  title: string
  company: string
  location?: string
  url: string
  workMode?: string
  atsScore?: number
  postTailorScore?: number
  matchedRules: string[]
  pendingApprovals: string[]
  tailoredKeywords: string[]
  draftResumeId?: string
  status: string
  /** `stageOf` result, computed server-side so the client never re-derives it. */
  stage: PipelineStage | 'archive'
  postedAt?: string
  createdAt: string
  deletedAt?: string
}

export interface PipelineCountsDto extends Record<PipelineStage, number> {
  archive: number
  /** Matches still unread (status 'new'). */
  matchedUnread: number
  /** matchedUnread + drafted + ready. */
  waiting: number
}

export interface PipelinePageDto {
  items: PipelineJob[]
  nextCursor: string | null
  counts: PipelineCountsDto
}

export type { PipelineFilter }
