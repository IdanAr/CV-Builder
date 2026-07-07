import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { generateCoverLetter } from '@/lib/ai/cover-letter-pipeline'
import { checkRateLimit, AI_RATE_LIMIT } from '@/lib/rate-limit'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import type { ResumeData } from '@/lib/schemas/resume.zod'

const MAX_JOB_DESCRIPTION_LENGTH = 10_000
const MAX_CONTEXT_FIELD_LENGTH = 200

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const rate = checkRateLimit(`${req.auth.user.id}:ai`, AI_RATE_LIMIT)
  if (!rate.allowed) {
    return apiError('RATE_LIMITED', 'Too many AI requests — please wait a moment.', 429, undefined, rate.retryAfterSeconds)
  }

  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>)
    const resume = await getResume(req.auth.user.id, id)
    if (!resume) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }

    const body = await req.json().catch(() => ({}))

    const jobDescription: string = typeof body.jobDescription === 'string'
      ? body.jobDescription.trim().slice(0, MAX_JOB_DESCRIPTION_LENGTH)
      : ''

    if (jobDescription.length === 0) {
      return apiError('BAD_REQUEST', 'jobDescription is required', 400)
    }

    const companyName: string | undefined = typeof body.companyName === 'string'
      ? body.companyName.trim().slice(0, MAX_CONTEXT_FIELD_LENGTH) || undefined
      : undefined
    const roleName: string | undefined = typeof body.roleName === 'string'
      ? body.roleName.trim().slice(0, MAX_CONTEXT_FIELD_LENGTH) || undefined
      : undefined

    const data = (resume.data ?? {}) as ResumeData
    const result = await generateCoverLetter(data, jobDescription, { companyName, roleName })
    return NextResponse.json(result)
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/cover-letter')
  }
})
