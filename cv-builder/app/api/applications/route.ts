import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { CreateApplicationSchema } from '@/lib/schemas/application.zod'
import { listApplications, createApplication } from '@/lib/api/applications'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const applications = await listApplications(req.auth.user.id)
    return NextResponse.json({ applications })
  } catch (err) {
    return handleRouteError(err, 'GET /api/applications')
  }
})

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const body = await req.json()
    const result = CreateApplicationSchema.safeParse(body)
    if (!result.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, result.error.issues)
    }
    const application = await createApplication(req.auth.user.id, result.data)
    return NextResponse.json({ application }, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'POST /api/applications')
  }
})
