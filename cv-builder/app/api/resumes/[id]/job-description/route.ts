import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { checkRateLimit, JOB_URL_RATE_LIMIT } from '@/lib/rate-limit'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import { fetchPublicPage, JobUrlError } from '@/lib/job-url/safe-fetch'
import { extractJobDescription } from '@/lib/job-url/extract'

// Below this, what came back is a cookie wall, a "please enable JavaScript"
// shell or a login page, not a job description.
const MIN_TEXT = 300

/**
 * POST { url } -> { text, title?, company?, source, host }
 *
 * Imports a job description from a public posting link, for the Cover Letter
 * tab. Scoped to a résumé the user owns only so it sits under the existing
 * `/api/resumes` auth matcher; the résumé itself is not read or changed.
 */
export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const rate = checkRateLimit(`${req.auth.user.id}:job-url`, JOB_URL_RATE_LIMIT)
  if (!rate.allowed) {
    return apiError('RATE_LIMITED', 'Too many imports - please wait a moment.', 429, undefined, rate.retryAfterSeconds)
  }

  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>)
    const resume = await getResume(req.auth.user.id, id)
    if (!resume) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }

    const body = await req.json().catch(() => ({}))
    const url = typeof body.url === 'string' ? body.url.slice(0, 2000) : ''
    if (!url.trim()) {
      return apiError('BAD_REQUEST', 'url is required', 400)
    }

    const page = await fetchPublicPage(url)
    const job = extractJobDescription(page.html)
    if (job.text.length < MIN_TEXT) {
      return apiError(
        'UNPROCESSABLE',
        "Couldn't find a job description on that page. It may need a sign-in or load its content with JavaScript. Paste the text instead.",
        422
      )
    }
    return NextResponse.json({ ...job, host: new URL(page.finalUrl).hostname.replace(/^www\./, '') })
  } catch (err) {
    if (err instanceof JobUrlError) {
      return apiError(err.status === 400 ? 'BAD_REQUEST' : 'UNPROCESSABLE', err.message, err.status)
    }
    return handleRouteError(err, 'POST /api/resumes/[id]/job-description')
  }
})
