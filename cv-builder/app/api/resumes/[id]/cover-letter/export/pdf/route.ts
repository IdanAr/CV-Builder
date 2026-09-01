import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import { checkRateLimit, EXPORT_RATE_LIMIT } from '@/lib/rate-limit'
import { CoverLetterPdfTemplate } from '@/lib/pdf/templates/CoverLetterPdfTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const rate = checkRateLimit(`${req.auth.user.id}:export`, EXPORT_RATE_LIMIT)
  if (!rate.allowed) {
    return apiError('RATE_LIMITED', 'Too many export requests - please wait a moment.', 429, undefined, rate.retryAfterSeconds)
  }

  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>)
    const resume = await getResume(req.auth.user.id, id)
    if (!resume) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }

    const body = await req.json().catch(() => null)
    const content = (body as { content?: unknown } | null)?.content
    if (typeof content !== 'string' || !content.trim()) {
      return apiError('VALIDATION_ERROR', 'content is required', 400)
    }

    const data = (resume.data ?? {}) as ResumeData
    const meta = resume.meta as ResumeMeta
    const element = React.createElement(CoverLetterPdfTemplate, {
      content,
      name: data.basics?.name,
      font: meta?.fontFamily,
    })
    const buffer = await renderToBuffer(element as React.ReactElement<never>)

    const baseName = resume.title.replace(/[^a-z0-9]/gi, '-')
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${baseName}-Cover-Letter.pdf"`,
        'Content-Length': String(buffer.byteLength),
      },
    })
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/cover-letter/export/pdf')
  }
})
