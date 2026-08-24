// Data access for scraped job postings. Every query is scoped to the
// requesting userId, matching every other service in lib/api/.
import dbConnect from '@/lib/db'
import ScrapedJob from '@/models/ScrapedJob'
import { createApplication } from '@/lib/api/applications'
import type { CreateScrapedJobInput, ScrapeSource, ScrapedJobStatus } from '@/lib/schemas/jobsearch.zod'

export async function listScrapedJobs(userId: string, profileId: string) {
  await dbConnect()
  return ScrapedJob.find({ userId, profileId }).sort({ createdAt: -1 }).lean()
}

export async function findExistingSourceIds(
  userId: string,
  profileId: string,
  source: ScrapeSource,
  sourceIds: string[]
): Promise<Set<string>> {
  if (sourceIds.length === 0) return new Set()
  await dbConnect()
  const existing = (await ScrapedJob.find(
    { userId, profileId, source, sourceId: { $in: sourceIds } },
    'sourceId'
  ).lean()) as unknown as Array<{ sourceId: string }>
  return new Set(existing.map((j) => j.sourceId))
}

export async function createScrapedJobs(
  userId: string,
  profileId: string,
  jobs: CreateScrapedJobInput[]
): Promise<void> {
  if (jobs.length === 0) return
  await dbConnect()
  try {
    // `ordered: false` so a duplicate-key race on the unique
    // (userId, profileId, source, sourceId) index — e.g. two concurrent
    // scans for the same profile — doesn't abort the whole batch; every
    // genuinely-new document still gets inserted.
    await ScrapedJob.insertMany(
      jobs.map((job) => ({ ...job, userId, profileId })),
      { ordered: false }
    )
  } catch (err) {
    const writeErrors = (err as { writeErrors?: Array<{ code?: number }> } | undefined)?.writeErrors
    const isDuplicateKeyOnly =
      Array.isArray(writeErrors) && writeErrors.length > 0 && writeErrors.every((we) => we.code === 11000)
    if (!isDuplicateKeyOnly) {
      throw err
    }
    // Every failure was an expected E11000 duplicate-key race — the point
    // of ordered:false here is "insert everything genuinely new, silently
    // skip anything already there." Nothing else to do.
  }
}

export async function countDraftedInWindow(
  userId: string,
  profileId?: string,
  windowMs = 24 * 60 * 60 * 1000
): Promise<number> {
  await dbConnect()
  const since = new Date(Date.now() - windowMs)
  const query: Record<string, unknown> = { userId, draftedAt: { $gte: since } }
  if (profileId) query.profileId = profileId
  return ScrapedJob.countDocuments(query)
}

export async function listDraftQueueBacklog(userId: string, profileId: string, limit: number) {
  if (limit <= 0) return []
  await dbConnect()
  return ScrapedJob.find({
    userId,
    profileId,
    resolvedActions: 'draft_and_queue',
    draftedAt: { $exists: false },
    // Also gated on status:'new' (not just draftedAt unset) because a
    // future notify feature could flip a stacked draft_and_queue+notify
    // posting's status away from 'new' before its capped drafting turn
    // comes up — if that ever ships, this filter needs revisiting so such
    // a posting doesn't silently fall out of the backlog. Currently
    // unreachable: nothing in this repo transitions status this way yet.
    status: 'new',
  })
    .sort({ firstSeenAt: 1 })
    .limit(limit)
    .lean()
}

export interface DraftedFields {
  draftResumeId: string
  postTailorScore: number
  pendingApprovals: string[]
  tailoredKeywords: string[]
  status: ScrapedJobStatus
}

export async function markScrapedJobDrafted(userId: string, id: string, fields: DraftedFields): Promise<void> {
  await dbConnect()
  await ScrapedJob.updateOne({ _id: id, userId }, { $set: { ...fields, draftedAt: new Date() } })
}

export type ConvertResult =
  | { ok: true; application: Awaited<ReturnType<typeof createApplication>> }
  | { ok: false; code: 'NOT_FOUND' | 'NO_DRAFT' | 'ALREADY_SUBMITTED' | 'PENDING_APPROVALS'; message: string }

export async function convertScrapedJobToApplication(userId: string, id: string): Promise<ConvertResult> {
  await dbConnect()
  const job = (await ScrapedJob.findOne({ userId, _id: id }).lean()) as {
    draftResumeId?: string
    status: string
    pendingApprovals: string[]
    company: string
    title: string
  } | null
  if (!job) return { ok: false, code: 'NOT_FOUND', message: 'Not found' }
  if (!job.draftResumeId) {
    return { ok: false, code: 'NO_DRAFT', message: 'This posting has no tailored draft to submit yet.' }
  }
  if (job.status === 'submitted') {
    return { ok: false, code: 'ALREADY_SUBMITTED', message: 'Already marked as applied.' }
  }
  if (job.pendingApprovals.length > 0) {
    return {
      ok: false,
      code: 'PENDING_APPROVALS',
      message: 'Resolve the flagged claims on this draft before marking it applied.',
    }
  }

  // Atomic claim: only one concurrent convert call for this job can pass
  // this — the { status: { $ne: 'submitted' } } filter makes it a
  // compare-and-set. This closes the race the old sequence left open (two
  // concurrent requests could both pass the status==='submitted' check
  // above before either wrote, each then calling createApplication and
  // producing two real Application rows from one user confirmation).
  const claim = await ScrapedJob.updateOne(
    { _id: id, userId, status: { $ne: 'submitted' } },
    { $set: { status: 'submitted' } }
  )
  if (claim.matchedCount === 0) {
    return { ok: false, code: 'ALREADY_SUBMITTED', message: 'Already marked as applied.' }
  }

  const application = await createApplication(userId, {
    resumeId: job.draftResumeId,
    company: job.company.slice(0, 200),
    role: job.title.slice(0, 200),
    status: 'applied',
    // CreateApplicationInput's inferred type requires customFields (its Zod
    // field carries .default({}), which makes the output type non-optional
    // — the same class of issue Task 1 hit on ScrapedJob's defaulted array
    // fields). Supply the empty default explicitly since this call builds
    // the input object directly rather than parsing through the schema.
    customFields: {},
  })
  return { ok: true, application }
}

// Toggles a scraped job listing between visible ('new') and dismissed
// ('dismissed') — the "Active"/"Non-Active" control on ScrapedJobsList.
// Never overwrites 'submitted' (a terminal, already-applied state — nothing
// useful comes from dismissing/restoring it) so the toggle only applies to
// listings still mid-pipeline or not yet acted on.
export async function setScrapedJobDismissed(userId: string, id: string, dismissed: boolean): Promise<boolean> {
  await dbConnect()
  const job = (await ScrapedJob.findOne({ _id: id, userId }, 'status').lean()) as { status: string } | null
  if (!job || job.status === 'submitted') return false
  const result = await ScrapedJob.updateOne(
    { _id: id, userId },
    { $set: { status: dismissed ? 'dismissed' : 'new' } }
  )
  return result.matchedCount === 1
}

export async function deleteScrapedJob(userId: string, id: string): Promise<boolean> {
  await dbConnect()
  const result = await ScrapedJob.deleteOne({ _id: id, userId })
  return result.deletedCount === 1
}

export interface NewScrapedJobSummary {
  _id: unknown
  title: string
  company: string
  description: string
  atsScore?: number
}

// Scoped to status:'new' only — a job the user has already dismissed,
// queued, needs_review'd, or submitted reflects a decision that shouldn't
// be silently undone by a later profile-preference edit (see scan.ts's
// stale-job pruning, which re-checks these against the profile's current
// roles/threshold on every scan).
export async function listNewScrapedJobs(userId: string, profileId: string): Promise<NewScrapedJobSummary[]> {
  await dbConnect()
  return (await ScrapedJob.find(
    { userId, profileId, status: 'new' },
    'title company description atsScore'
  ).lean()) as unknown as NewScrapedJobSummary[]
}

export async function deleteScrapedJobsByIds(userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  await dbConnect()
  const result = await ScrapedJob.deleteMany({ _id: { $in: ids }, userId })
  return result.deletedCount ?? 0
}
