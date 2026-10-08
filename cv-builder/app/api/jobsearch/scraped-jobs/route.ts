import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import {
  listPipelineJobs,
  countPipelineStages,
  InvalidCursorError,
} from '@/lib/api/scraped-jobs'
import { parsePipelineFilter } from '@/lib/jobsearch/stages'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  const userId = req.auth.user.id
  try {
    const { searchParams } = new URL(req.url)
    const profileId = searchParams.get('profileId') ?? undefined

    const stageParam = searchParams.get('stage')
    if (stageParam === null) return apiError('VALIDATION_ERROR', 'stage is required', 400)
    const stage = parsePipelineFilter(stageParam)
    if (!stage) return apiError('VALIDATION_ERROR', 'stage is not a pipeline stage', 400)
    const limitParam = searchParams.get('limit')
    const limit = limitParam === null ? undefined : Number(limitParam)
    if (limit !== undefined && !Number.isInteger(limit)) {
      return apiError('VALIDATION_ERROR', 'limit must be an integer', 400)
    }
    const [page, counts] = await Promise.all([
      listPipelineJobs(userId, {
        stage,
        profileId,
        q: searchParams.get('q') ?? undefined,
        cursor: searchParams.get('cursor') ?? undefined,
        limit,
      }),
      countPipelineStages(userId, { profileId }),
    ])
    return NextResponse.json({ items: page.items, nextCursor: page.nextCursor, counts })
  } catch (err) {
    if (err instanceof InvalidCursorError) {
      return apiError('VALIDATION_ERROR', 'cursor is not valid', 400)
    }
    return handleRouteError(err, 'GET /api/jobsearch/scraped-jobs')
  }
})
