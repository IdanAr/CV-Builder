import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { setScrapedJobDismissed, deleteScrapedJob } from '@/lib/api/scraped-jobs'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const PATCH = auth(async function PATCH(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const body = await req.json()
    if (typeof body.dismissed !== 'boolean') {
      return apiError('VALIDATION_ERROR', 'dismissed (boolean) is required', 400)
    }
    // setScrapedJobDismissed returns false for both "not found" and "already
    // submitted, can't toggle a terminal state" — collapsed to 404 here since
    // the UI never offers the dismiss/restore control on a submitted job, so
    // the distinction isn't user-facing in practice.
    const updated = await setScrapedJobDismissed(req.auth.user.id, id, body.dismissed)
    if (!updated) return apiError('NOT_FOUND', 'Not found', 404)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/jobsearch/scraped-jobs/[id]')
  }
})

export const DELETE = auth(async function DELETE(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const deleted = await deleteScrapedJob(req.auth.user.id, id)
    if (!deleted) return apiError('NOT_FOUND', 'Not found', 404)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/jobsearch/scraped-jobs/[id]')
  }
})
