import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { extractPagination } from '@/lib/pdf/extract-pagination'
import { checkRateLimit, PREVIEW_RATE_LIMIT } from '@/lib/rate-limit'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import { ResumeDataSchema, ResumeMetaSchema } from '@/lib/schemas/resume.zod'
import type React from 'react'

// Paginates the caller's *current* editor state (request body, not the DB)
// so unsaved edits are reflected. Always 'designed' mode: the Live Preview
// mirrors the designed export.
const BodySchema = z.object({
  data: ResumeDataSchema,
  meta: ResumeMetaSchema,
})

export const POST = auth(async (req) => {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const rate = checkRateLimit(`${req.auth.user.id}:preview-pagination`, PREVIEW_RATE_LIMIT)
  if (!rate.allowed) {
    return apiError('RATE_LIMITED', 'Too many preview renders — please wait a moment.', 429, undefined, rate.retryAfterSeconds)
  }

  try {
    const body = await req.json().catch(() => null)
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return apiError('BAD_REQUEST', 'Invalid resume payload', 400)
    }

    const element = selectPdfTemplate(parsed.data.data, parsed.data.meta, 'designed')
    const buffer = Buffer.from(await renderToBuffer(element as React.ReactElement<never>))
    const pagination = await extractPagination(buffer)
    return NextResponse.json(pagination)
  } catch (err) {
    return handleRouteError(err, 'POST /api/preview/pagination')
  }
})
