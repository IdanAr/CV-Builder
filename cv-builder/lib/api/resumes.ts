import dbConnect from '@/lib/db'
import Resume from '@/models/Resume'
import { sectionsFilledCount } from '@/lib/sections'
import type { CreateResumeInput, PatchResumeInput, ResumeData } from '@/lib/schemas/resume.zod'
import { scoreResume } from '@/lib/ats/scorer'

export async function listResumes(userId: string) {
  await dbConnect()
  const resumes = await Resume.find({ userId }).sort({ updatedAt: -1 }).lean()
  const titleById = new Map<string, string>(resumes.map((r) => [String(r._id), r.title]))

  // Cache-aside: reuse a resume's formatScore when it was computed at or
  // after the resume's last edit; recompute (and persist) otherwise. Editing
  // a resume already bumps `updatedAt` via the schema's timestamps, so that
  // alone is the staleness signal — no separate invalidation step needed.
  const now = new Date()
  const bulkOps: Array<{
    updateOne: { filter: { _id: unknown }; update: { $set: { cachedFormatScore: number; formatScoreComputedAt: Date } } }
  }> = []

  const results = resumes.map((r) => {
    const isFresh =
      r.cachedFormatScore !== undefined &&
      r.formatScoreComputedAt !== undefined &&
      r.formatScoreComputedAt >= r.updatedAt
    const formatScore = isFresh
      ? r.cachedFormatScore
      : scoreResume((r.data ?? {}) as ResumeData, '').breakdown.format

    if (!isFresh) {
      bulkOps.push({
        updateOne: {
          filter: { _id: r._id },
          update: { $set: { cachedFormatScore: formatScore, formatScoreComputedAt: now } },
        },
      })
    }

    return {
      ...r,
      sectionsFilledCount: sectionsFilledCount((r.data ?? {}) as ResumeData),
      formatScore,
      parentResumeTitle: r.parentResumeId ? titleById.get(String(r.parentResumeId)) : undefined,
    }
  })

  // Awaited (not fire-and-forget): a Vercel serverless function can be frozen
  // right after the response is sent, so an un-awaited write isn't reliable.
  if (bulkOps.length > 0) {
    await Resume.bulkWrite(bulkOps)
  }

  return results
}

/** Lightweight id/title pairs for pickers (applications table resume column). */
export async function listResumeOptions(userId: string) {
  await dbConnect()
  const resumes = await Resume.find({ userId }, 'title').sort({ updatedAt: -1 }).lean()
  return resumes.map((r) => ({ id: String(r._id), title: r.title }))
}

export async function getResume(userId: string, id: string) {
  await dbConnect()
  return Resume.findOne({ _id: id, userId }).lean()
}

// `parentResumeId` is deliberately not part of CreateResumeSchema/CreateResumeInput
// — it's not something a client of POST /api/resumes should be able to set
// arbitrarily (there's no ownership check on an attacker-supplied id, only on
// how it's later *displayed* via listResumes' scoped title lookup). Trusted
// server-side callers (job-search's tailoring pipeline) pass it here instead,
// the same lineage field duplicateResume() sets directly via Resume.create.
export async function createResume(
  userId: string,
  input: CreateResumeInput,
  options?: { parentResumeId?: string }
) {
  await dbConnect()
  const resume = await Resume.create({ userId, ...input, parentResumeId: options?.parentResumeId })
  return resume.toObject()
}

export async function patchResume(userId: string, id: string, patch: PatchResumeInput) {
  await dbConnect()

  const setPayload: Record<string, unknown> = {}

  if (patch.title !== undefined) setPayload.title = patch.title
  if (patch.data !== undefined) setPayload.data = patch.data
  if (patch.applicationStatus !== undefined) setPayload.applicationStatus = patch.applicationStatus
  if (patch.targetCompany !== undefined) setPayload.targetCompany = patch.targetCompany
  if (patch.targetRole !== undefined) setPayload.targetRole = patch.targetRole
  if (patch.meta !== undefined) {
    for (const [key, value] of Object.entries(patch.meta)) {
      if (value !== undefined) setPayload[`meta.${key}`] = value
    }
  }

  return Resume.findOneAndUpdate(
    { _id: id, userId },
    { $set: setPayload },
    { new: true }
  ).lean()
}

export async function deleteResume(userId: string, id: string): Promise<boolean> {
  await dbConnect()
  const result = await Resume.deleteOne({ _id: id, userId })
  return result.deletedCount > 0
}

export async function duplicateResume(
  userId: string,
  id: string,
  overrides?: { targetCompany?: string; targetRole?: string }
) {
  await dbConnect()
  const source = await Resume.findOne({ _id: id, userId }).lean()
  if (!source) return null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, createdAt, updatedAt, __v, ...rest } = source as typeof source & { __v?: number }
  const copy = await Resume.create({
    ...rest,
    userId,
    title: `Copy of ${rest.title}`,
    parentResumeId: String(_id),
    applicationStatus: 'draft',
    targetCompany: overrides?.targetCompany ?? rest.targetCompany,
    targetRole: overrides?.targetRole ?? rest.targetRole,
  })
  return copy.toObject()
}
