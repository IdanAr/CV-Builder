import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { runScanForProfile } from '@/lib/jobsearch/scan'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import { checkRateLimit, SCAN_RATE_LIMIT } from '@/lib/rate-limit'

// No route in this app set maxDuration, leaving both scan entry points on the
// platform default — which is well under what a scan can legitimately need.
// runApplyPipeline makes two Claude calls, the client allows ~60s each
// (timeout 30s, maxRetries 1 in lib/ai/models.ts), and a scan runs up to
// PER_PROFILE_DAILY_DRAFT_CAP backlog items plus that many new postings.
//
// 60 is the ceiling available on every Vercel plan, so it is the safe value
// to commit rather than one that fails to deploy on Hobby. It does not cover
// the pathological worst case; the lever for that is the per-invocation draft
// caps in lib/jobsearch/apply.ts, which is a throughput decision rather than
// a correctness one and is deliberately left alone here. What this does buy
// is a predictable, documented ceiling instead of an implicit platform one.
export const maxDuration = 60

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const rate = checkRateLimit(`${req.auth.user.id}:scan`, SCAN_RATE_LIMIT)
  if (!rate.allowed) {
    return apiError('RATE_LIMITED', 'Too many scan requests - please wait a moment.', 429, undefined, rate.retryAfterSeconds)
  }

  try {
    const body = await req.json()
    if (typeof body.profileId !== 'string' || body.profileId.length === 0) {
      return apiError('VALIDATION_ERROR', 'profileId is required', 400)
    }
    const result = await runScanForProfile(req.auth.user.id, body.profileId)
    return NextResponse.json({ result })
  } catch (err) {
    return handleRouteError(err, 'POST /api/jobsearch/scan')
  }
})
