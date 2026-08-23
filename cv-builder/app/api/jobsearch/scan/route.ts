import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { runScanForProfile } from '@/lib/jobsearch/scan'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const body = await req.json()
    if (typeof body.profileId !== 'string' || body.profileId.length === 0) {
      return apiError('VALIDATION_ERROR', 'profileId is required', 400)
    }
    const result = await runScanForProfile(req.auth.user.id, body.profileId)
    return NextResponse.json({ result })
  } catch (err) {
    return handleRouteError(err, 'POST /api/jobsearch/scan')
  }
})
