import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { PatchResumeSchema } from '@/lib/schemas/resume.zod'
import { getResume, patchResume, deleteResume } from '@/lib/api/resumes'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

const MAX_BODY_BYTES = 1_000_000 // resume JSON is a few KB; 1MB is generous headroom (mirrors preview/pagination route)

export const GET = auth(async function GET(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const resume = await getResume(req.auth.user.id, id)
    if (!resume) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    return NextResponse.json({ resume })
  } catch (err) {
    return handleRouteError(err, 'GET /api/resumes/[id]')
  }
})

export const PATCH = auth(async function PATCH(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const raw = await req.text().catch(() => null)
    if (raw === null || raw.length > MAX_BODY_BYTES) {
      return apiError('BAD_REQUEST', 'Payload too large or unreadable', 400)
    }
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return apiError('BAD_REQUEST', 'Invalid request payload', 400)
    }
    const result = PatchResumeSchema.safeParse(body)
    if (!result.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, result.error.issues)
    }
    const resume = await patchResume(req.auth.user.id, id, result.data)
    if (!resume) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    return NextResponse.json({ resume })
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/resumes/[id]')
  }
})

export const DELETE = auth(async function DELETE(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const deleted = await deleteResume(req.auth.user.id, id)
    if (!deleted) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/resumes/[id]')
  }
})
