import { Packer } from 'docx'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { buildCoverLetterDocx } from '@/lib/docx/cover-letter-docx'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import { checkRateLimit, EXPORT_RATE_LIMIT } from '@/lib/rate-limit'
import { letterHeader, parseLetterLanguage } from '@/lib/coverletter/header'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const rate = await checkRateLimit(`${req.auth.user.id}:export`, EXPORT_RATE_LIMIT)
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

    // Anything but 'he' is English, so a bad value cannot reach the renderer.
    const language = parseLetterLanguage((body as { language?: unknown }).language)
    const data = (resume.data ?? {}) as ResumeData
    const meta = resume.meta as ResumeMeta
    const header = letterHeader(data.basics, new Date(), language)
    const doc = buildCoverLetterDocx(
      content,
      { name: header.name || undefined, contact: header.contact || undefined, date: header.date },
      meta?.fontFamily ?? 'Arial',
      language,
    )
    const buffer = await Packer.toBuffer(doc)

    const baseName = resume.title.replace(/[^a-z0-9]/gi, '-')
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${baseName}-Cover-Letter.docx"`,
        'Content-Length': String(buffer.byteLength),
      },
    })
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/cover-letter/export/docx')
  }
})
