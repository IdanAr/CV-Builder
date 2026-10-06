import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { countUnreadNotifyMatches, countPipelineStages } from '@/lib/api/scraped-jobs'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const userId = req.auth.user.id
    const [count, stages] = await Promise.all([
      countUnreadNotifyMatches(userId),
      countPipelineStages(userId),
    ])
    return NextResponse.json({ count, waiting: stages.waiting })
  } catch (err) {
    return handleRouteError(err, 'GET /api/jobsearch/notifications/unread-count')
  }
})
