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

export async function markScrapedJobDrafted(id: string, fields: DraftedFields): Promise<void> {
  await dbConnect()
  await ScrapedJob.updateOne({ _id: id }, { $set: { ...fields, draftedAt: new Date() } })
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

  const application = await createApplication(userId, {
    resumeId: job.draftResumeId,
    company: job.company.slice(0, 200),
    role: job.title.slice(0, 200),
    // CreateApplicationInput's inferred type requires customFields (its Zod
    // field carries .default({}), which makes the output type non-optional
    // — the same class of issue Task 1 hit on ScrapedJob's defaulted array
    // fields). Supply the empty default explicitly since this call builds
    // the input object directly rather than parsing through the schema.
    customFields: {},
  })
  await ScrapedJob.updateOne({ _id: id, userId }, { $set: { status: 'submitted' } })
  return { ok: true, application }
}
