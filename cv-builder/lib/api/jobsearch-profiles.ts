// Data access for job-search profiles. Every query is scoped to the
// requesting userId — never trust an id alone (CLAUDE.md route-protection convention).
import dbConnect from '@/lib/db'
import JobSearchProfile from '@/models/JobSearchProfile'
import ScrapedJob from '@/models/ScrapedJob'
import Resume from '@/models/Resume'
import type {
  CreateJobSearchProfileInput,
  PatchJobSearchProfileInput,
} from '@/lib/schemas/jobsearch.zod'

export interface JobSearchProfileCounts {
  /** Notify matches this profile found that the user has not seen yet. Scoped
   *  identically to countUnreadNotifyMatches so a profile card and the navbar
   *  badge can never disagree about what "new" means. */
  newMatchCount: number
  /** Drafts this profile has queued and not yet submitted. */
  queuedCount: number
}

/**
 * One aggregate for every profile rather than a count query per card — the
 * list is small but the queries would be N+1, and both counts come off the
 * same {userId} scan.
 */
async function countsByProfile(userId: string): Promise<Map<string, JobSearchProfileCounts>> {
  const rows = (await ScrapedJob.aggregate([
    {
      $match: {
        userId,
        $or: [{ status: 'new', resolvedActions: 'notify' }, { status: 'queued' }],
      },
    },
    { $group: { _id: { profileId: '$profileId', status: '$status' }, n: { $sum: 1 } } },
  ])) as Array<{ _id: { profileId: string; status: string }; n: number }>

  const counts = new Map<string, JobSearchProfileCounts>()
  for (const row of rows) {
    const entry = counts.get(row._id.profileId) ?? { newMatchCount: 0, queuedCount: 0 }
    if (row._id.status === 'queued') entry.queuedCount = row.n
    else entry.newMatchCount = row.n
    counts.set(row._id.profileId, entry)
  }
  return counts
}

export async function listJobSearchProfiles(userId: string) {
  await dbConnect()
  const [profiles, counts] = await Promise.all([
    JobSearchProfile.find({ userId }).sort({ createdAt: 1 }).lean(),
    countsByProfile(userId),
  ])
  // Counts ride along on the profile rather than arriving from a second
  // endpoint: ProfileList renders them on the same card as the name, so a
  // separate request would only give the card two arrival times.
  return profiles.map((profile) => ({
    ...profile,
    ...(counts.get(String(profile._id)) ?? { newMatchCount: 0, queuedCount: 0 }),
  }))
}

/** id -> name, for attributing a cross-profile match to the profile that found it. */
export async function getProfileNameMap(userId: string): Promise<Map<string, string>> {
  await dbConnect()
  const profiles = (await JobSearchProfile.find({ userId }, 'name').lean()) as unknown as Array<{
    _id: unknown
    name: string
  }>
  return new Map(profiles.map((p) => [String(p._id), p.name]))
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

// System-wide query used only by the QStash cron fan-out
// (app/api/jobsearch/scan/cron/route.ts) to publish one scan job per active
// profile across every user — deliberately NOT scoped to a single userId,
// unlike every other function in this file. There is no user session on a
// Vercel Cron request to scope by. Never expose this via a user-facing API
// route.
export async function listAllActiveJobSearchProfiles() {
  await dbConnect()
  return JobSearchProfile.find({ isActive: true }).lean()
}
