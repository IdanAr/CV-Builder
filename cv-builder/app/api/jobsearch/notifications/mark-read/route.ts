import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { markNotifyMatchesRead } from '@/lib/api/scraped-jobs'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    await markNotifyMatchesRead(req.auth.user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err, 'POST /api/jobsearch/notifications/mark-read')
  }
})
