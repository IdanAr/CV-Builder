import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { CreateJobSearchProfileSchema } from '@/lib/schemas/jobsearch.zod'
import { listJobSearchProfiles, createJobSearchProfile } from '@/lib/api/jobsearch-profiles'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const profiles = await listJobSearchProfiles(req.auth.user.id)
    return NextResponse.json({ profiles })
  } catch (err) {
    return handleRouteError(err, 'GET /api/jobsearch/profiles')
  }
})

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const body = await req.json()
    const result = CreateJobSearchProfileSchema.safeParse(body)
    if (!result.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, result.error.issues)
    }
    const profile = await createJobSearchProfile(req.auth.user.id, result.data)
    return NextResponse.json({ profile }, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'POST /api/jobsearch/profiles')
  }
})
