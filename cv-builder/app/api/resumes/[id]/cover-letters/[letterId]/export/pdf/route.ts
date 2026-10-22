import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { auth } from '@/lib/auth'
import { loadLetterForExport } from '@/lib/api/cover-letter-export'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import { checkRateLimit, EXPORT_RATE_LIMIT } from '@/lib/rate-limit'
import { CoverLetterPdfTemplate } from '@/lib/pdf/templates/CoverLetterPdfTemplate'
import { contentDisposition } from '@/lib/coverletter/export-input'

export const POST = auth(async (req, ctx) => {
  const userId = req.auth?.user?.id
  if (!userId) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const rate = await checkRateLimit(`${userId}:export`, EXPORT_RATE_LIMIT)
  if (!rate.allowed) {
    return apiError('RATE_LIMITED', 'Too many export requests - please wait a moment.', 429, undefined, rate.retryAfterSeconds)
  }

  try {
    const { id, letterId } = await (ctx?.params as Promise<{ id: string; letterId: string }>)
    const loaded = await loadLetterForExport(userId, id, letterId, new Date())
    if (!loaded.ok) return loaded.response

    const element = React.createElement(CoverLetterPdfTemplate, loaded.input)
    const buffer = await renderToBuffer(element as React.ReactElement<never>)

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition(loaded.input.title, 'pdf'),
        'Content-Length': String(buffer.byteLength),
      },
    })
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/cover-letters/[letterId]/export/pdf')
  }
})
