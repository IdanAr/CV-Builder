// Data access for scraped job postings. Every query is scoped to the
// requesting userId, matching every other service in lib/api/.
import dbConnect from '@/lib/db'
import ScrapedJob from '@/models/ScrapedJob'
import { createApplication } from '@/lib/api/applications'
import { ensureJobMetadataColumns, JOB_URL_COLUMN_ID, JOB_LOCATION_COLUMN_ID } from '@/lib/api/board-config'
import { getJobSearchProfile, getProfileNameMap } from '@/lib/api/jobsearch-profiles'
import type {
  CreateScrapedJobInput,
  ScrapeSource,
  ScrapedJobStatus,
  WorkMode,
} from '@/lib/schemas/jobsearch.zod'
import type { CustomFieldValue } from '@/lib/schemas/application.zod'

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
    url: string
    location?: string
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

  // Provisions the "Job URL"/"Location" custom columns on first use so the
  // customFields written below actually render as real columns in the
  // user's applications table instead of being invisible, orphaned keys.
  await ensureJobMetadataColumns(userId)
  const customFields: Record<string, CustomFieldValue> = {}
  if (job.url) customFields[JOB_URL_COLUMN_ID] = job.url
  if (job.location) customFields[JOB_LOCATION_COLUMN_ID] = job.location

  const application = await createApplication(userId, {
    resumeId: job.draftResumeId,
    company: job.company.slice(0, 200),
    role: job.title.slice(0, 200),
    status: 'applied',
    customFields,
  })
  return { ok: true, application }
}

export type ApproveResult =
  | { ok: true; status: ScrapedJobStatus }
  | { ok: false; code: 'NOT_FOUND' | 'NO_PENDING_APPROVALS'; message: string }

// Resolves the "Needs your review" state caused by unverified claims: the
// user has read the flagged claims (surfaced by detectHallucinations at
// draft time) and either confirmed they're accurate or edited the draft
// resume directly (via its normal editor) to remove them — either way,
// clearing pendingApprovals is a manual attestation, the same trust model
// AtsFixReviewPanel's "Apply" already uses elsewhere for unverified figures.
// A job held back purely by a low postTailorScore (pendingApprovals already
// empty) has nothing for this to clear — the caller only offers this action
// once pendingApprovals.length > 0.
export async function approveScrapedJob(userId: string, id: string): Promise<ApproveResult> {
  await dbConnect()
  const job = (await ScrapedJob.findOne({ userId, _id: id }).lean()) as {
    profileId: string
    pendingApprovals: string[]
    postTailorScore?: number
  } | null
  if (!job) return { ok: false, code: 'NOT_FOUND', message: 'Not found' }
  if (job.pendingApprovals.length === 0) {
    return { ok: false, code: 'NO_PENDING_APPROVALS', message: 'Nothing to approve on this posting.' }
  }

  const profile = (await getJobSearchProfile(userId, job.profileId)) as { minAtsScore?: number } | null
  const minAtsScore = profile?.minAtsScore ?? 0
  const status: ScrapedJobStatus =
    job.postTailorScore !== undefined && job.postTailorScore < minAtsScore ? 'needs_review' : 'queued'

  await ScrapedJob.updateOne({ _id: id, userId }, { $set: { pendingApprovals: [], status } })
  return { ok: true, status }
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

export interface NotifyMatchSummary {
  _id: unknown
  profileId: string
  /** Resolved from the profile, not stored on the job — the feed is
   *  cross-profile, so a card has to say which profile found it. */
  profileName?: string
  title: string
  company: string
  location?: string
  url: string
  atsScore?: number
  workMode?: WorkMode
  /** Names, not ids — lib/jobsearch/rules.ts stores `rule.name`, so these
   *  render as-is. */
  matchedRules: string[]
  postedAt?: Date
  status: string
  createdAt: Date
}

// Cross-profile: JobMatchesFeed (design spec §9) shows every 'notify' rule
// match for this user regardless of which profile it came from, so this
// intentionally omits the profileId scoping every other scraped-jobs query
// in this file uses.
export async function listNotifyMatches(userId: string): Promise<NotifyMatchSummary[]> {
  await dbConnect()
  const [matches, names] = await Promise.all([
    ScrapedJob.find(
      { userId, resolvedActions: 'notify', status: { $in: ['new', 'notified'] } },
      'profileId title company location url atsScore workMode matchedRules postedAt status createdAt'
    )
      .sort({ createdAt: -1 })
      .lean() as unknown as Promise<NotifyMatchSummary[]>,
    getProfileNameMap(userId),
  ])
  return matches.map((match) => ({ ...match, profileName: names.get(match.profileId) }))
}

export async function countUnreadNotifyMatches(
  userId: string,
  profileId?: string
): Promise<number> {
  await dbConnect()
  return ScrapedJob.countDocuments({
    userId,
    resolvedActions: 'notify',
    status: 'new',
    ...(profileId ? { profileId } : {}),
  })
}

// Marks currently-unread notify matches as seen (status 'new' -> 'notified')
// — called once JobMatchesFeed has actually loaded the list, so the AppNavbar
// badge count drops without requiring a per-item action.
//
// `profileId` scopes it to one profile's matches. The feed inside a profile
// record shows only that profile, and marking the whole account read from
// there would silently clear unread counts for profiles the user never
// opened.
export async function markNotifyMatchesRead(
  userId: string,
  profileId?: string
): Promise<void> {
  await dbConnect()
  await ScrapedJob.updateMany(
    { userId, resolvedActions: 'notify', status: 'new', ...(profileId ? { profileId } : {}) },
    { $set: { status: 'notified' } }
  )
}
