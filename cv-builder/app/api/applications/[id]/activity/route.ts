import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { listActivity } from '@/lib/api/applications'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const GET = auth(async function GET(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const activity = await listActivity(req.auth.user.id, id)
    return NextResponse.json({ activity })
  } catch (err) {
    return handleRouteError(err, 'GET /api/applications/[id]/activity')
  }
})
