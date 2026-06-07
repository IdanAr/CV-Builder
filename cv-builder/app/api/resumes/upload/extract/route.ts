import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { extractResume, ExtractionError } from '@/lib/upload/extract-resume'
import { createResume } from '@/lib/api/resumes'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
  }

  const text = typeof (body as Record<string, unknown>).text === 'string'
    ? ((body as Record<string, unknown>).text as string).trim()
    : ''

  if (!text) {
    return NextResponse.json({ error: 'text is required', code: 'BAD_REQUEST' }, { status: 400 })
  }

  try {
    const data = await extractResume(text)
    const name = (data.basics as Record<string, unknown> | undefined)?.name
    const title = typeof name === 'string' && name
      ? `${name}'s CV`
      : `Uploaded CV — ${new Date().toISOString().slice(0, 10)}`

    const resume = await createResume(req.auth.user.id, {
      title,
      data,
      meta: ResumeMetaSchema.parse({}),
    })

    return NextResponse.json({ resumeId: String(resume._id) }, { status: 201 })
  } catch (err) {
    if (err instanceof ExtractionError) {
      return NextResponse.json({ error: err.message, code: 'EXTRACTION_FAILED' }, { status: 422 })
    }
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
})
