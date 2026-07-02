import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { scoreResume } from '@/lib/ats/scorer'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import type { ResumeData } from '@/lib/schemas/resume.zod'

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

    const body = await req.json().catch(() => ({}))
    const jobDescription: string = typeof body.jobDescription === 'string' ? body.jobDescription : ''
    const data = (resume.data ?? {}) as ResumeData
    const result = scoreResume(data, jobDescription)

    return NextResponse.json(result)
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/ats-score')
  }
})
