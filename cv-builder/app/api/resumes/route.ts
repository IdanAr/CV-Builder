import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { CreateResumeSchema } from '@/lib/schemas/resume.zod'
import { listResumes, createResume } from '@/lib/api/resumes'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const resumes = await listResumes(req.auth.user.id)
    return NextResponse.json({ resumes })
  } catch (err) {
    return handleRouteError(err, 'GET /api/resumes')
  }
})

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const body = await req.json()
    const result = CreateResumeSchema.safeParse(body)
    if (!result.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, result.error.issues)
    }
    const resume = await createResume(req.auth.user.id, result.data)
    return NextResponse.json({ resume }, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes')
  }
})
