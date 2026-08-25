import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { runSuggestionPipeline } from '@/lib/ai/pipeline'
import { checkRateLimit, AI_RATE_LIMIT } from '@/lib/rate-limit'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import type { SuggestionField } from '@/lib/ai/pipeline'

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const rate = checkRateLimit(`${req.auth.user.id}:ai`, AI_RATE_LIMIT)
  if (!rate.allowed) {
    return apiError('RATE_LIMITED', 'Too many AI requests - please wait a moment.', 429, undefined, rate.retryAfterSeconds)
  }

  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>)
    const resume = await getResume(req.auth.user.id, id)
    if (!resume) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }

    const body = await req.json().catch(() => ({}))
    const input: string = typeof body.input === 'string' ? body.input.slice(0, 500) : ''
    const field: SuggestionField = body.field === 'summary' ? 'summary' : 'highlight'
    const jobTitle: string | undefined = typeof body.jobTitle === 'string' ? body.jobTitle : undefined
    const company: string | undefined = typeof body.company === 'string' ? body.company : undefined

    if (!input.trim()) {
      return apiError('BAD_REQUEST', 'Input is required', 400)
    }

    const result = await runSuggestionPipeline(input, { field, jobTitle, company })
    return NextResponse.json(result)
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/ai-suggest')
  }
})
