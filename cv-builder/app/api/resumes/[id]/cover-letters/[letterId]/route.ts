import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { getCoverLetter, updateCoverLetter, deleteCoverLetter } from '@/lib/api/cover-letters'
import { UpdateCoverLetterSchema } from '@/lib/schemas/cover-letter.zod'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

type Params = Promise<{ id: string; letterId: string }>

export const GET = auth(async (req, ctx) => {
  const userId = req.auth?.user?.id
  if (!userId) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  try {
    const { id, letterId } = await (ctx?.params as Params)
    if (!(await getResume(userId, id))) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    const letter = await getCoverLetter(userId, id, letterId)
    if (!letter) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    return NextResponse.json({ letter })
  } catch (err) {
    return handleRouteError(err, 'GET /api/resumes/[id]/cover-letters/[letterId]')
  }
})

export const PATCH = auth(async (req, ctx) => {
  const userId = req.auth?.user?.id
  if (!userId) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  try {
    const { id, letterId } = await (ctx?.params as Params)
    if (!(await getResume(userId, id))) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }

    const body = await req.json().catch(() => undefined)
    const parsed = UpdateCoverLetterSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues)
    }

    const letter = await updateCoverLetter(userId, id, letterId, parsed.data)
    if (letter === null) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    if (letter === 'writing') {
      return apiError('CONFLICT', 'This letter is still being written.', 409)
    }
    return NextResponse.json({ letter })
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/resumes/[id]/cover-letters/[letterId]')
  }
})

export const DELETE = auth(async (req, ctx) => {
  const userId = req.auth?.user?.id
  if (!userId) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  try {
    const { id, letterId } = await (ctx?.params as Params)
    if (!(await getResume(userId, id))) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    const deleted = await deleteCoverLetter(userId, id, letterId)
    if (!deleted) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/resumes/[id]/cover-letters/[letterId]')
  }
})
