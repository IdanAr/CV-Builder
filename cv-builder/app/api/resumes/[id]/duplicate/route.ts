import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { duplicateResume } from '@/lib/api/resumes'

export const POST = auth(async function POST(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const { id } = await params
    const resume = await duplicateResume(req.auth.user.id, id)
    if (!resume) {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    return NextResponse.json({ resume }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
