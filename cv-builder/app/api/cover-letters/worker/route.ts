import { NextResponse } from 'next/server'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { runCoverLetterJob } from '@/lib/ai/cover-letter/job'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

// QStash callback target (see lib/ai/cover-letter/queue.ts). It runs the
// cover letter writer, which costs real AI spend, so it must never be
// reachable by an unsigned POST: verifySignatureAppRouter rejects any request
// whose `Upstash-Signature` does not verify before the handler runs.
// The writer is given a 55 s budget (lib/ai/cover-letter/job.ts); 60 is the
// ceiling available on every Vercel plan.
export const maxDuration = 60

async function handler(req: Request) {
  try {
    let body: { userId?: unknown; letterId?: unknown }
    try {
      body = await req.json()
    } catch {
      return apiError('VALIDATION_ERROR', 'Body must be JSON', 400)
    }
    if (typeof body?.userId !== 'string' || body.userId.length === 0) {
      return apiError('VALIDATION_ERROR', 'userId is required', 400)
    }
    if (typeof body.letterId !== 'string' || body.letterId.length === 0) {
      return apiError('VALIDATION_ERROR', 'letterId is required', 400)
    }
    // 200 for every outcome, "failed" and "gone" included: the job already ran
    // or cannot run, and a non-2xx would make QStash redeliver it. Only an
    // exception before the letter was claimed (a database error) is a 500.
    const outcome = await runCoverLetterJob(body.userId, body.letterId)
    return NextResponse.json({ outcome })
  } catch (err) {
    return handleRouteError(err, 'POST /api/cover-letters/worker')
  }
}

// Built on the first request, not at import: verifySignatureAppRouter reads
// the signing keys when it is called and throws if none are set, which must
// become a clean 401 rather than an import-time crash. Same as the scan worker.
let verifiedHandler: ((request: Request, params?: unknown) => Promise<Response>) | undefined

export async function POST(request: Request, params?: unknown) {
  // The QStash wrapper answers 403 to a missing signature; say 401 for both cases.
  if (!request.headers.get('upstash-signature')) {
    return apiError('UNAUTHORIZED', 'Invalid signature', 401)
  }
  try {
    if (!verifiedHandler) {
      verifiedHandler = verifySignatureAppRouter(handler)
    }
    return await verifiedHandler(request, params)
  } catch (err) {
    // A malformed Upstash-Signature makes the Receiver throw; that is still "not verified".
    console.error('[POST /api/cover-letters/worker] signature verification failed', err)
    return apiError('UNAUTHORIZED', 'Invalid signature', 401)
  }
}
