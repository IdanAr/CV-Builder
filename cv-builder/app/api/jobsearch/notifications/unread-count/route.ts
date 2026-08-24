import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { countUnreadNotifyMatches } from '@/lib/api/scraped-jobs'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const count = await countUnreadNotifyMatches(req.auth.user.id)
    return NextResponse.json({ count })
  } catch (err) {
    return handleRouteError(err, 'GET /api/jobsearch/notifications/unread-count')
  }
})
