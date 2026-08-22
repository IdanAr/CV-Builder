// Data access for job-search profiles. Every query is scoped to the
// requesting userId — never trust an id alone (CLAUDE.md route-protection convention).
import dbConnect from '@/lib/db'
import JobSearchProfile from '@/models/JobSearchProfile'
import type {
  CreateJobSearchProfileInput,
  PatchJobSearchProfileInput,
} from '@/lib/schemas/jobsearch.zod'

export async function listJobSearchProfiles(userId: string) {
  await dbConnect()
  return JobSearchProfile.find({ userId }).sort({ createdAt: 1 }).lean()
}

export async function createJobSearchProfile(userId: string, input: CreateJobSearchProfileInput) {
  await dbConnect()
  return JobSearchProfile.create({ ...input, userId })
}

export async function getJobSearchProfile(userId: string, id: string) {
  await dbConnect()
  return JobSearchProfile.findOne({ _id: id, userId }).lean()
}

export async function updateJobSearchProfile(
  userId: string,
  id: string,
  input: PatchJobSearchProfileInput
) {
  await dbConnect()
  return JobSearchProfile.findOneAndUpdate({ _id: id, userId }, { $set: input }, { new: true }).lean()
}

export async function deleteJobSearchProfile(userId: string, id: string): Promise<boolean> {
  await dbConnect()
  const result = await JobSearchProfile.deleteOne({ _id: id, userId })
  return result.deletedCount === 1
}
