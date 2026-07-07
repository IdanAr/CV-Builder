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
    const body = await req.json().catch(() => ({}))
    const targetCompany: string | undefined =
      typeof body.targetCompany === 'string' ? body.targetCompany.slice(0, 200) : undefined
    const targetRole: string | undefined =
      typeof body.targetRole === 'string' ? body.targetRole.slice(0, 200) : undefined
    const resume = await duplicateResume(req.auth.user.id, id, { targetCompany, targetRole })
    if (!resume) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }
    return NextResponse.json({ resume }, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/duplicate')
  }
})
