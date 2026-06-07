import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { CreateResumeSchema } from '@/lib/schemas/resume.zod'
import { listResumes, createResume } from '@/lib/api/resumes'

export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const resumes = await listResumes(req.auth.user.id)
    return NextResponse.json({ resumes })
  } catch {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const result = CreateResumeSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: result.error.issues },
        { status: 400 }
      )
    }
    const resume = await createResume(req.auth.user.id, result.data)
    return NextResponse.json({ resume }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
