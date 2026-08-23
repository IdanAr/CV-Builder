import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { CreateJobSearchRuleSchema } from '@/lib/schemas/jobsearch.zod'
import { listRulesForProfile, createJobSearchRule } from '@/lib/api/jobsearch-rules'
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
    const rules = await listRulesForProfile(req.auth.user.id, profileId)
    return NextResponse.json({ rules })
  } catch (err) {
    return handleRouteError(err, 'GET /api/jobsearch/rules')
  }
})

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const body = await req.json()
    const result = CreateJobSearchRuleSchema.safeParse(body)
    if (!result.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, result.error.issues)
    }
    const rule = await createJobSearchRule(req.auth.user.id, result.data)
    if (!rule) {
      return apiError('NOT_FOUND', 'Profile not found', 404)
    }
    return NextResponse.json({ rule }, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'POST /api/jobsearch/rules')
  }
})
