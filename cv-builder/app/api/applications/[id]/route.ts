import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { PatchApplicationSchema } from '@/lib/schemas/application.zod'
import { patchApplication, deleteApplication } from '@/lib/api/applications'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const PATCH = auth(async function PATCH(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const body = await req.json()
    const result = PatchApplicationSchema.safeParse(body)
    if (!result.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, result.error.issues)
    }
    const application = await patchApplication(req.auth.user.id, id, result.data)
    if (!application) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    return NextResponse.json({ application })
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/applications/[id]')
  }
})

export const DELETE = auth(async function DELETE(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const deleted = await deleteApplication(req.auth.user.id, id)
    if (!deleted) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/applications/[id]')
  }
})
