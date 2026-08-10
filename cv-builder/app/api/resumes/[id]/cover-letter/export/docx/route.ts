import { Packer } from 'docx'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { buildCoverLetterDocx } from '@/lib/docx/cover-letter-docx'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
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
    const doc = buildCoverLetterDocx(content, data.basics?.name, meta?.fontFamily ?? 'Arial')
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
