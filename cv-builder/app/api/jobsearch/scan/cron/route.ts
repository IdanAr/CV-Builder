import { NextResponse } from 'next/server'
import { listAllActiveJobSearchProfiles } from '@/lib/api/jobsearch-profiles'
import { publishScanJob } from '@/lib/jobsearch/queue'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

// Vercel Cron target (see vercel.json's `crons` entry). Not wrapped in the
// session-based auth() HOF — a scheduled cron request carries no user
// session, only the `Authorization: Bearer $CRON_SECRET` header Vercel
// automatically attaches when CRON_SECRET is set (design spec §6).
// auth.config.ts's authorized callback also excludes this path from the
// session-auth matcher (see Task 5).
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  try {
    const profiles = (await listAllActiveJobSearchProfiles()) as unknown as Array<{
      _id: unknown
      userId: string
    }>

    let queued = 0
    let failed = 0
    for (const profile of profiles) {
      try {
        await publishScanJob(profile.userId, String(profile._id))
        queued++
      } catch {
        // One profile's publish failure shouldn't abort the whole fan-out —
        // it simply misses this scheduled run and gets picked up next time.
        failed++
      }
    }

    return NextResponse.json({ queued, failed, total: profiles.length })
  } catch (err) {
    return handleRouteError(err, 'GET /api/jobsearch/scan/cron')
  }
}
