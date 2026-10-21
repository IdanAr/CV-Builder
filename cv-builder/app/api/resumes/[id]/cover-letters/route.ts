import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import {
  listCoverLetters,
  createCoverLetter,
  latestNotes,
  suggestedPostingFor,
} from '@/lib/api/cover-letters'
import { enqueueCoverLetter } from '@/lib/ai/cover-letter/queue'
import { CreateCoverLetterSchema } from '@/lib/schemas/cover-letter.zod'
import { checkAiRateLimit, aiRateLimitedResponse } from '@/lib/rate-limit'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

// Without QStash the writer runs in after() inside this request's lifetime.
export const maxDuration = 60

export const GET = auth(async (req, ctx) => {
  const userId = req.auth?.user?.id
  if (!userId) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>)
    const resume = await getResume(userId, id)
    if (!resume) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }

    // Read-only: nothing here creates a letter or starts the writer.
    const [letters, notes, suggestedPosting] = await Promise.all([
      listCoverLetters(userId, id),
      latestNotes(userId, id),
      suggestedPostingFor(userId, id),
    ])
    return NextResponse.json({ letters, notes, suggestedPosting })
  } catch (err) {
    return handleRouteError(err, 'GET /api/resumes/[id]/cover-letters')
  }
})

export const POST = auth(async (req, ctx) => {
  const userId = req.auth?.user?.id
  if (!userId) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>)
    const resume = await getResume(userId, id)
    if (!resume) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }

    // Validate before the rate limit so a malformed request costs no AI allowance.
    const body = await req.json().catch(() => undefined)
    const parsed = CreateCoverLetterSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues)
    }

    const rate = await checkAiRateLimit(userId)
    if (!rate.allowed) {
      return aiRateLimitedResponse(rate)
    }

    const letter = await createCoverLetter(userId, id, parsed.data)
    // If this throws the letter stays "writing" and the read-time stale rule fails it.
    await enqueueCoverLetter(userId, letter.id)
    return NextResponse.json({ letter }, { status: 202 })
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/cover-letters')
  }
})
