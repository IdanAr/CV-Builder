import { renderToBuffer } from '@react-pdf/renderer'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { parseExportMode } from '@/lib/export-mode'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import type React from 'react'

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { id } = await (ctx?.params as Promise<{ id: string }>)
  const resume = await getResume(req.auth.user.id, id)
  if (!resume) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const mode = parseExportMode((body as { mode?: unknown } | null)?.mode)

  const data = (resume.data ?? {}) as ResumeData
  const meta = resume.meta as ResumeMeta
  const element = selectPdfTemplate(data, meta, mode, resume.title)

  const buffer = await renderToBuffer(element as React.ReactElement<never>)

  const baseName = resume.title.replace(/[^a-z0-9]/gi, '-')
  const templateName = meta.templateId.charAt(0).toUpperCase() + meta.templateId.slice(1)
  const modeSuffix = mode === 'ats' ? '-ATS' : ''
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${baseName}-${templateName}${modeSuffix}.pdf"`,
      'Content-Length': String(buffer.byteLength),
    },
  })
})
