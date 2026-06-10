import { renderToBuffer } from '@react-pdf/renderer'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { ClassicPdfTemplate } from '@/lib/pdf/templates/ClassicPdfTemplate'
import { ModernPdfTemplate } from '@/lib/pdf/templates/ModernPdfTemplate'
import { MinimalPdfTemplate } from '@/lib/pdf/templates/MinimalPdfTemplate'
import { ExecutivePdfTemplate } from '@/lib/pdf/templates/ExecutivePdfTemplate'
import { SidebarPdfTemplate } from '@/lib/pdf/templates/SidebarPdfTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import React from 'react'

function selectTemplate(data: ResumeData, meta: ResumeMeta) {
  switch (meta.templateId) {
    case 'modern':
      return React.createElement(ModernPdfTemplate, { data, meta })
    case 'minimal':
      return React.createElement(MinimalPdfTemplate, { data, meta })
    case 'executive':
      return React.createElement(ExecutivePdfTemplate, { data, meta })
    case 'sidebar':
      return React.createElement(SidebarPdfTemplate, { data, meta })
    default:
      return React.createElement(ClassicPdfTemplate, { data, meta })
  }
}

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { id } = await (ctx?.params as Promise<{ id: string }>)
  const resume = await getResume(req.auth.user.id, id)
  if (!resume) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }

  const data = (resume.data ?? {}) as ResumeData
  const meta = resume.meta as ResumeMeta
  const element = selectTemplate(data, meta)

  const buffer = await renderToBuffer(element as React.ReactElement<never>)

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${resume.title.replace(/[^a-z0-9]/gi, '-')}.pdf"`,
      'Content-Length': String(buffer.byteLength),
    },
  })
})
