// lib/api/cover-letters.ts
// Data access for the CoverLetter collection. Letters are written by a
// background job, so a letter can be left "writing" by a job that died or was
// never delivered; every read applies the stale rule so the panel never waits
// on one forever.
import dbConnect from '@/lib/db'
import CoverLetter, { type ICoverLetter } from '@/models/CoverLetter'
import Resume from '@/models/Resume'
import ScrapedJob from '@/models/ScrapedJob'
import { preparePosting } from '@/lib/ai/cover-letter/posting'
import type {
  CoverLetterNotes,
  CreateCoverLetterInput,
  UpdateCoverLetterInput,
} from '@/lib/schemas/cover-letter.zod'

/** A letter still "writing" this long after it started (or was created) has been lost. */
export const STALE_WRITING_MS = 90_000
export const STALE_MESSAGE = 'Writing this letter took too long. Please try again.'

// A migrated letter has no posting; the schema requires some job text.
const LEGACY_JOB_TEXT = 'Imported from the cover letter saved with this CV.'
const LEGACY_FALLBACK = 'Unspecified'
const DUPLICATE_KEY = 11000

/** What the API returns: the stored letter without the posting text or Mongo internals. */
export type CoverLetterView = Omit<ICoverLetter, 'jobText'> & { id: string }

type StoredLetter = ICoverLetter & { _id: unknown; __v?: number }

function toView(doc: StoredLetter): CoverLetterView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, __v, jobText, ...rest } = doc
  return { ...rest, id: String(_id) }
}

function isStale(doc: StoredLetter, now = Date.now()): boolean {
  if (doc.status !== 'writing') return false
  const since = doc.startedAt ?? doc.createdAt
  return now - new Date(since).getTime() > STALE_WRITING_MS
}

/**
 * Marks a stale writing letter as failed. The update is conditional on the
 * letter still being "writing", so a job that finishes at the same moment is
 * not overwritten; in that case the finished letter is returned instead.
 */
async function settleStale(doc: StoredLetter): Promise<StoredLetter> {
  if (!isStale(doc)) return doc
  const updated = await CoverLetter.findOneAndUpdate(
    { _id: doc._id, status: 'writing' },
    { $set: { status: 'failed', error: STALE_MESSAGE } },
    { returnDocument: 'after' }
  ).lean<StoredLetter>()
  if (updated) return updated
  const current = await CoverLetter.findById(doc._id).lean<StoredLetter>()
  return current ?? doc
}

/** Moves the old ResumeData.coverLetter text into a letter of its own, once per CV. */
export async function migrateLegacyCoverLetter(userId: string, resumeId: string): Promise<void> {
  await dbConnect()
  const resume = await Resume.findOne({ _id: resumeId, userId }).lean()
  const text = resume?.data?.coverLetter
  if (!resume || typeof text !== 'string' || !text.trim()) return
  if (await CoverLetter.exists({ resumeId, legacy: true })) return

  try {
    await CoverLetter.create({
      userId,
      resumeId,
      company: resume.targetCompany || LEGACY_FALLBACK,
      role: resume.targetRole || LEGACY_FALLBACK,
      jobText: LEGACY_JOB_TEXT,
      content: text,
      status: 'ready',
      legacy: true,
    })
  } catch (err) {
    // A concurrent call won the race; the unique partial index kept it to one.
    if ((err as { code?: number }).code !== DUPLICATE_KEY) throw err
  }
}

export async function listCoverLetters(userId: string, resumeId: string): Promise<CoverLetterView[]> {
  await dbConnect()
  await migrateLegacyCoverLetter(userId, resumeId)
  const docs = await CoverLetter.find({ userId, resumeId }).sort({ updatedAt: -1 }).lean<StoredLetter[]>()
  const settled = await Promise.all(docs.map(settleStale))
  return settled.map(toView)
}

export async function getCoverLetter(
  userId: string,
  resumeId: string,
  id: string
): Promise<CoverLetterView | null> {
  await dbConnect()
  const doc = await CoverLetter.findOne({ _id: id, userId, resumeId }).lean<StoredLetter>()
  if (!doc) return null
  return toView(await settleStale(doc))
}

export async function createCoverLetter(
  userId: string,
  resumeId: string,
  input: CreateCoverLetterInput
): Promise<CoverLetterView> {
  await dbConnect()
  const created = await CoverLetter.create({ ...input, userId, resumeId, status: 'writing' })
  return toView(created.toObject() as StoredLetter)
}

/** Edits a finished letter. Returns 'writing' when the letter is still being written, null when it is not found. */
export async function updateCoverLetter(
  userId: string,
  resumeId: string,
  id: string,
  patch: UpdateCoverLetterInput
): Promise<CoverLetterView | 'writing' | null> {
  await dbConnect()
  const $set: Record<string, unknown> = {}
  if (patch.content !== undefined) $set.content = patch.content
  if (patch.pendingApprovals !== undefined) $set.pendingApprovals = patch.pendingApprovals
  if (patch.notes !== undefined) {
    for (const [key, value] of Object.entries(patch.notes)) {
      if (value !== undefined) $set[`notes.${key}`] = value
    }
  }

  // Excluding "writing" in the filter keeps an edit from racing the job's own write.
  const updated = await CoverLetter.findOneAndUpdate(
    { _id: id, userId, resumeId, status: { $ne: 'writing' } },
    { $set },
    { returnDocument: 'after' }
  ).lean<StoredLetter>()
  if (updated) return toView(updated)

  const current = await CoverLetter.findOne({ _id: id, userId, resumeId }).lean<StoredLetter>()
  if (!current) return null
  // Stale means the job is gone: the letter is failed, not writing, and can be edited.
  const settled = await settleStale(current)
  if (settled.status === 'writing') return 'writing'
  return updateCoverLetter(userId, resumeId, id, patch)
}

export async function deleteCoverLetter(userId: string, resumeId: string, id: string): Promise<boolean> {
  await dbConnect()
  const result = await CoverLetter.deleteOne({ _id: id, userId, resumeId })
  return result.deletedCount > 0
}

/** The "explain" note from the newest letter of this CV, to prefill the next one. */
export async function latestNotes(userId: string, resumeId: string): Promise<CoverLetterNotes> {
  await dbConnect()
  const latest = await CoverLetter.findOne({ userId, resumeId }, 'notes')
    .sort({ updatedAt: -1 })
    .lean<Pick<StoredLetter, 'notes'>>()
  const explain = latest?.notes?.explain
  return explain ? { explain } : {}
}

export type SuggestedPosting = { company: string; role: string; jobText: string; scrapedJobId: string }

/** The posting this CV was drafted for by the job search, cleaned for the writer. */
export async function suggestedPostingFor(userId: string, resumeId: string): Promise<SuggestedPosting | null> {
  await dbConnect()
  const job = await ScrapedJob.findOne({ userId, draftResumeId: resumeId })
    .sort({ draftedAt: -1 })
    .lean()
  if (!job) return null
  const posting = preparePosting({ company: job.company, jobText: job.description })
  if (!posting.text) return null
  return {
    company: posting.company,
    role: job.title,
    jobText: posting.text,
    scrapedJobId: String(job._id),
  }
}
