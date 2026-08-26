import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { approveScrapedJob } from '@/lib/api/scraped-jobs'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  NO_PENDING_APPROVALS: 400,
}

export const POST = auth(async function POST(req, { params }: { params: Promise<{ id: string }> }) {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const { id } = await params
    const result = await approveScrapedJob(req.auth.user.id, id)
    if (!result.ok) {
      return apiError(result.code, result.message, STATUS_BY_CODE[result.code] ?? 400)
    }
    return NextResponse.json({ status: result.status })
  } catch (err) {
    return handleRouteError(err, 'POST /api/jobsearch/scraped-jobs/[id]/approve')
  }
})
