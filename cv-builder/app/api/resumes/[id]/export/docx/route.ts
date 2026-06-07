import { Packer } from 'docx'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { buildDocx } from '@/lib/docx/resume-docx'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

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
  const doc = buildDocx(data, meta)
  const buffer = await Packer.toBuffer(doc)

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${resume.title.replace(/[^a-z0-9]/gi, '-')}.docx"`,
      'Content-Length': String(buffer.byteLength),
    },
  })
})
