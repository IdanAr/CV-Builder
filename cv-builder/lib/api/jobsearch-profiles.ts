// Data access for job-search profiles. Every query is scoped to the
// requesting userId — never trust an id alone (CLAUDE.md route-protection convention).
import dbConnect from '@/lib/db'
import JobSearchProfile from '@/models/JobSearchProfile'
import Resume from '@/models/Resume'
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

  // Only trust resumeId once ownership is confirmed — otherwise drop it rather
  // than persist a reference to a resume that isn't (or may not be) the
  // caller's. Same pattern as lib/api/applications.ts's createApplication.
  let resumeId: string | undefined
  if (input.resumeId) {
    const resume = await Resume.findOne({ _id: input.resumeId, userId }).lean()
    if (resume) {
      resumeId = input.resumeId
    }
  }

  return JobSearchProfile.create({ ...input, resumeId, userId })
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

  const setPayload: PatchJobSearchProfileInput = { ...input }
  if (input.resumeId !== undefined) {
    // Only persist resumeId once ownership is confirmed. If it doesn't belong
    // to the requesting user, drop it from the update entirely — leave the
    // existing (or absent) resumeId untouched rather than nulling it out.
    const resume = input.resumeId
      ? await Resume.findOne({ _id: input.resumeId, userId }).lean()
      : null
    if (resume) {
      setPayload.resumeId = input.resumeId
    } else {
      delete setPayload.resumeId
    }
  }

  return JobSearchProfile.findOneAndUpdate(
    { _id: id, userId },
    { $set: setPayload },
    { new: true }
  ).lean()
}

export async function deleteJobSearchProfile(userId: string, id: string): Promise<boolean> {
  await dbConnect()
  const result = await JobSearchProfile.deleteOne({ _id: id, userId })
  return result.deletedCount === 1
}
