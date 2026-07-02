import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { duplicateResume } from '@/lib/api/resumes'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const POST = auth(async function POST(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const resume = await duplicateResume(req.auth.user.id, id)
    if (!resume) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    return NextResponse.json({ resume }, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/duplicate')
  }
})
