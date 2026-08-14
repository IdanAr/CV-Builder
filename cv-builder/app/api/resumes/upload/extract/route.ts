import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { extractResume, ExtractionError } from '@/lib/upload/extract-resume'
import { createResume } from '@/lib/api/resumes'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'
import { checkRateLimit, AI_RATE_LIMIT } from '@/lib/rate-limit'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const rate = checkRateLimit(`${req.auth.user.id}:ai`, AI_RATE_LIMIT)
  if (!rate.allowed) {
    return apiError('RATE_LIMITED', 'Too many AI requests — please wait a moment.', 429, undefined, rate.retryAfterSeconds)
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

    const meta = ResumeMetaSchema.parse({})
    // Only surface built-in sections the parser actually found entries for —
    // an empty section stays available via "+ Add Section" instead of
    // cluttering the accordion. Custom sections are only rendered when their
    // key is in sectionOrder.
    const dataRecord = data as Record<string, unknown[] | undefined>
    meta.sectionOrder = [
      ...meta.sectionOrder.filter((section) => (dataRecord[section]?.length ?? 0) > 0),
      ...(data.customSections ?? []).map((cs) => `custom:${cs.id}`),
    ]

    const resume = await createResume(req.auth.user.id, { title, data, meta, applicationStatus: 'draft' })

    return NextResponse.json({ resumeId: String(resume._id) }, { status: 201 })
  } catch (err) {
    if (err instanceof ExtractionError) {
      return NextResponse.json({ error: err.message, code: 'EXTRACTION_FAILED' }, { status: 422 })
    }
    return handleRouteError(err, 'POST /api/resumes/upload/extract')
  }
})
