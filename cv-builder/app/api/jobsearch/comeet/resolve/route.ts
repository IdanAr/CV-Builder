import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { resolveComeetCompanyFromUrl } from '@/lib/jobsearch/sources/comeet-resolve'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import { checkRateLimit, COMEET_RESOLVE_RATE_LIMIT } from '@/lib/rate-limit'

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const rate = checkRateLimit(`${req.auth.user.id}:comeet-resolve`, COMEET_RESOLVE_RATE_LIMIT)
  if (!rate.allowed) {
    return apiError('RATE_LIMITED', 'Too many requests - please wait a moment.', 429, undefined, rate.retryAfterSeconds)
  }

  try {
    const body = await req.json()
    if (typeof body.url !== 'string' || body.url.length === 0) {
      return apiError('VALIDATION_ERROR', 'url is required', 400)
    }
    const result = await resolveComeetCompanyFromUrl(body.url)
    if (!result.ok) {
      return apiError('RESOLVE_FAILED', result.error, 422)
    }
    return NextResponse.json({ company: result.company })
  } catch (err) {
    return handleRouteError(err, 'POST /api/jobsearch/comeet/resolve')
  }
})
