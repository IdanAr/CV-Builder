import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { markNotifyMatchesRead } from '@/lib/api/scraped-jobs'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    // The body is optional: the cross-profile feed posts nothing, while the
    // feed inside a profile record posts that profile's id so it only marks
    // its own matches read.
    const body = await req.json().catch(() => ({}))
    const profileId = typeof body?.profileId === 'string' ? body.profileId : undefined
    await markNotifyMatchesRead(req.auth.user.id, profileId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err, 'POST /api/jobsearch/notifications/mark-read')
  }
})
