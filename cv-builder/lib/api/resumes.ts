import dbConnect from '@/lib/db'
import Resume from '@/models/Resume'
import { sectionsFilledCount } from '@/lib/sections'
import type { CreateResumeInput, PatchResumeInput, ResumeData } from '@/lib/schemas/resume.zod'
import { scoreResume } from '@/lib/ats/scorer'

export async function listResumes(userId: string) {
  await dbConnect()
  const resumes = await Resume.find({ userId }).sort({ updatedAt: -1 }).lean()
  return resumes.map((r) => ({
    ...r,
    sectionsFilledCount: sectionsFilledCount((r.data ?? {}) as ResumeData),
    formatScore: scoreResume((r.data ?? {}) as ResumeData, '').breakdown.format,
  }))
}

export async function getResume(userId: string, id: string) {
  await dbConnect()
  return Resume.findOne({ _id: id, userId }).lean()
}

export async function createResume(userId: string, input: CreateResumeInput) {
  await dbConnect()
  const resume = await Resume.create({ userId, ...input })
  return resume.toObject()
}

export async function patchResume(userId: string, id: string, patch: PatchResumeInput) {
  await dbConnect()

  const setPayload: Record<string, unknown> = {}

  if (patch.title !== undefined) setPayload.title = patch.title
  if (patch.data !== undefined) setPayload.data = patch.data
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

export async function duplicateResume(userId: string, id: string) {
  await dbConnect()
  const source = await Resume.findOne({ _id: id, userId }).lean()
  if (!source) return null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, createdAt, updatedAt, __v, ...rest } = source as typeof source & { __v?: number }
  const copy = await Resume.create({
    ...rest,
    userId,
    title: `Copy of ${rest.title}`,
  })
  return copy.toObject()
}
