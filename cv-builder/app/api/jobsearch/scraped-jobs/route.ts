import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { listScrapedJobs } from '@/lib/api/scraped-jobs'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { searchParams } = new URL(req.url)
    const profileId = searchParams.get('profileId')
    if (!profileId) {
      return apiError('VALIDATION_ERROR', 'profileId is required', 400)
    }
    const scrapedJobs = await listScrapedJobs(req.auth.user.id, profileId)
    return NextResponse.json({ scrapedJobs })
  } catch (err) {
    return handleRouteError(err, 'GET /api/jobsearch/scraped-jobs')
  }
})
