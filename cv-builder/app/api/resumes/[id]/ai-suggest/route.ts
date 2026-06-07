import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { runSuggestionPipeline } from '@/lib/ai/pipeline'
import type { SuggestionField } from '@/lib/ai/pipeline'

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
  const input: string = typeof body.input === 'string' ? body.input.slice(0, 500) : ''
  const field: SuggestionField = body.field === 'summary' ? 'summary' : 'highlight'
  const jobTitle: string | undefined = typeof body.jobTitle === 'string' ? body.jobTitle : undefined
  const company: string | undefined = typeof body.company === 'string' ? body.company : undefined

  if (!input.trim()) {
    return new Response(JSON.stringify({ error: 'Input is required' }), { status: 400 })
  }

  try {
    const result = await runSuggestionPipeline(input, { field, jobTitle, company })
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'AI suggestion failed' }), { status: 500 })
  }
})
