import { Packer } from 'docx'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { buildDocx } from '@/lib/docx/resume-docx'
import { parseExportMode } from '@/lib/export-mode'
import { checkRateLimit, EXPORT_RATE_LIMIT } from '@/lib/rate-limit'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
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
    const mode = parseExportMode((body as { mode?: unknown } | null)?.mode)

    const data = (resume.data ?? {}) as ResumeData
    const meta = resume.meta as ResumeMeta
    const doc = buildDocx(data, meta, mode)
    const buffer = await Packer.toBuffer(doc)

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${resume.title.replace(/[^a-z0-9]/gi, '-')}-${(meta.templateId ?? 'classic').charAt(0).toUpperCase() + (meta.templateId ?? 'classic').slice(1)}${mode === 'ats' ? '-ATS' : ''}.docx"`,
        'Content-Length': String(buffer.byteLength),
      },
    })
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/export/docx')
  }
})
