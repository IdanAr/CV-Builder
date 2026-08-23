import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { PatchJobSearchRuleSchema } from '@/lib/schemas/jobsearch.zod'
import {
  getJobSearchRule,
  updateJobSearchRule,
  deleteJobSearchRule,
} from '@/lib/api/jobsearch-rules'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const GET = auth(async function GET(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const rule = await getJobSearchRule(req.auth.user.id, id)
    if (!rule) return apiError('NOT_FOUND', 'Not found', 404)
    return NextResponse.json({ rule })
  } catch (err) {
    return handleRouteError(err, 'GET /api/jobsearch/rules/[id]')
  }
})

export const PATCH = auth(async function PATCH(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const body = await req.json()
    const result = PatchJobSearchRuleSchema.safeParse(body)
    if (!result.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, result.error.issues)
    }
    const rule = await updateJobSearchRule(req.auth.user.id, id, result.data)
    if (!rule) return apiError('NOT_FOUND', 'Not found', 404)
    return NextResponse.json({ rule })
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/jobsearch/rules/[id]')
  }
})

export const DELETE = auth(async function DELETE(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const deleted = await deleteJobSearchRule(req.auth.user.id, id)
    if (!deleted) return apiError('NOT_FOUND', 'Not found', 404)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/jobsearch/rules/[id]')
  }
})
