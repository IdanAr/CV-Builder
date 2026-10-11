import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { runAtsFixPipeline } from '@/lib/ai/ats-fix-pipeline'
import { checkRateLimit, AI_RATE_LIMIT } from '@/lib/rate-limit'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import type { ResumeData } from '@/lib/schemas/resume.zod'

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
    const missingKeywords: string[] = Array.isArray(body.missingKeywords)
      ? body.missingKeywords.filter((k: unknown) => typeof k === 'string').slice(0, 20)
      : []
    // Keywords the CV covers only through a synonym: the fix adds the job's
    // exact term next to the user's own wording.
    const synonymKeywords: string[] = Array.isArray(body.synonymKeywords)
      ? body.synonymKeywords.filter((k: unknown) => typeof k === 'string').slice(0, 10)
      : []

    if (missingKeywords.length === 0 && synonymKeywords.length === 0) {
      return apiError('BAD_REQUEST', 'missingKeywords or synonymKeywords array is required', 400)
    }

    const data = (resume.data ?? {}) as ResumeData
    const fixes = await runAtsFixPipeline(data, missingKeywords, synonymKeywords)
    return NextResponse.json(fixes)
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/ats-fix')
  }
})
