import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { runAtsFixPipeline } from '@/lib/ai/ats-fix-pipeline'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { id } = await (ctx?.params as Promise<{ id: string }>)
  const resume = await getResume(req.auth.user.id, id)
  if (!resume) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const missingKeywords: string[] = Array.isArray(body.missingKeywords)
    ? body.missingKeywords.filter((k: unknown) => typeof k === 'string').slice(0, 20)
    : []

  if (missingKeywords.length === 0) {
    return new Response(JSON.stringify({ error: 'missingKeywords array is required' }), { status: 400 })
  }

  try {
    const data = (resume.data ?? {}) as ResumeData
    const fixes = await runAtsFixPipeline(data, missingKeywords)
    return new Response(JSON.stringify(fixes), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Fix generation failed' }), { status: 500 })
  }
})
