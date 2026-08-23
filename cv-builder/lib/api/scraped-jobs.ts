// Data access for scraped job postings. Every query is scoped to the
// requesting userId, matching every other service in lib/api/.
import dbConnect from '@/lib/db'
import ScrapedJob from '@/models/ScrapedJob'
import type { CreateScrapedJobInput, ScrapeSource } from '@/lib/schemas/jobsearch.zod'

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
