import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { PatchJobSearchProfileSchema } from '@/lib/schemas/jobsearch.zod'
import {
  getJobSearchProfile,
  updateJobSearchProfile,
  deleteJobSearchProfile,
} from '@/lib/api/jobsearch-profiles'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const GET = auth(async function GET(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const profile = await getJobSearchProfile(req.auth.user.id, id)
    if (!profile) return apiError('NOT_FOUND', 'Not found', 404)
    return NextResponse.json({ profile })
  } catch (err) {
    return handleRouteError(err, 'GET /api/jobsearch/profiles/[id]')
  }
})

export const PATCH = auth(async function PATCH(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const body = await req.json()
    const result = PatchJobSearchProfileSchema.safeParse(body)
    if (!result.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, result.error.issues)
    }
    const profile = await updateJobSearchProfile(req.auth.user.id, id, result.data)
    if (!profile) return apiError('NOT_FOUND', 'Not found', 404)
    return NextResponse.json({ profile })
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/jobsearch/profiles/[id]')
  }
})

export const DELETE = auth(async function DELETE(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const deleted = await deleteJobSearchProfile(req.auth.user.id, id)
    if (!deleted) return apiError('NOT_FOUND', 'Not found', 404)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/jobsearch/profiles/[id]')
  }
})
