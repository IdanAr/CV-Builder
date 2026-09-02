import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { listAllActiveJobSearchProfiles } from '@/lib/api/jobsearch-profiles'
import { publishScanJob } from '@/lib/jobsearch/queue'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

function isValidCronAuth(authHeader: string | null): boolean {
  if (!process.env.CRON_SECRET || !authHeader) return false
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`)
  const actual = Buffer.from(authHeader)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

// Caps how many publishScanJob calls run at once. Each is an independent
// QStash HTTP round-trip; fanning out every active profile unboundedly is
// fine at today's scale but risks thundering against the QStash API once
// the active-profile count grows.
const MAX_CONCURRENT_PUBLISHES = 20

async function publishInBatches(
  profiles: Array<{ _id: unknown; userId: string }>
): Promise<{ queued: number; failed: number }> {
  let queued = 0
  let failed = 0
  for (let i = 0; i < profiles.length; i += MAX_CONCURRENT_PUBLISHES) {
    const batch = profiles.slice(i, i + MAX_CONCURRENT_PUBLISHES)
    // Promise.allSettled fans each batch out concurrently — per-profile
    // failure isolation is preserved: one rejected publish doesn't abort
    // the rest of the batch or the remaining batches.
    const results = await Promise.allSettled(
      batch.map((profile) => publishScanJob(profile.userId, String(profile._id)))
    )
    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      if (result.status === 'fulfilled') {
        queued++
      } else {
        // One profile's publish failure shouldn't abort the whole fan-out —
        // it simply misses this scheduled run and gets picked up next time.
        // Logged (not silently swallowed) so a systemic failure — bad
        // QSTASH_TOKEN, wrong region, etc. — is actually diagnosable from
        // Vercel's function logs instead of just an opaque failed count.
        console.error(
          `[GET /api/jobsearch/scan/cron] publishScanJob failed for profile ${String(batch[j]._id)}`,
          result.reason
        )
        failed++
      }
    }
  }
  return { queued, failed }
}

// Vercel Cron target (see vercel.json's `crons` entry). Not wrapped in the
// session-based auth() HOF — a scheduled cron request carries no user
// session, only the `Authorization: Bearer $CRON_SECRET` header Vercel
// automatically attaches when CRON_SECRET is set (design spec §6).
// auth.config.ts's authorized callback also excludes this path from the
// session-auth matcher (see Task 5).
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!isValidCronAuth(authHeader)) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  try {
    const profiles = (await listAllActiveJobSearchProfiles()) as unknown as Array<{
      _id: unknown
      userId: string
    }>

    const { queued, failed } = await publishInBatches(profiles)

    return NextResponse.json({ queued, failed, total: profiles.length })
  } catch (err) {
    return handleRouteError(err, 'GET /api/jobsearch/scan/cron')
  }
}
