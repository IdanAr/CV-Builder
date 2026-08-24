import { NextResponse } from 'next/server'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { runScanForProfile } from '@/lib/jobsearch/scan'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

// QStash callback target (see lib/jobsearch/queue.ts's publishScanJob and
// vercel.json's cron route). verifySignatureAppRouter rejects any request
// whose `Upstash-Signature` header doesn't verify against
// QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY before this handler
// body ever runs — this route triggers real AI spend via
// runScanForProfile()'s apply pipeline, so it must never be reachable by an
// unsigned POST (design spec §6/§12 risk 3).
async function handler(req: Request) {
  try {
    const body = await req.json()
    if (typeof body.userId !== 'string' || body.userId.length === 0) {
      return apiError('VALIDATION_ERROR', 'userId is required', 400)
    }
    if (typeof body.profileId !== 'string' || body.profileId.length === 0) {
      return apiError('VALIDATION_ERROR', 'profileId is required', 400)
    }
    const result = await runScanForProfile(body.userId, body.profileId)
    return NextResponse.json({ result })
  } catch (err) {
    return handleRouteError(err, 'POST /api/jobsearch/scan/worker')
  }
}

// verifySignatureAppRouter() reads QSTASH_CURRENT_SIGNING_KEY /
// QSTASH_NEXT_SIGNING_KEY from process.env at the moment it's *called*, not
// lazily per-request. Calling it eagerly at module-import time is fine in
// production (env vars are set before the process starts handling
// requests), but it means the wrapped handler is built once and reused —
// so we defer that one-time build to the first incoming request instead of
// module load. This keeps identical runtime behavior while avoiding an
// import-time crash in any environment where the signing-key env vars
// aren't set until after this module has already been imported (e.g. a
// test that configures them in `beforeEach`).
//
// The construction itself happens inside the request's try/catch below
// (not just the call to the built handler) because verifySignatureAppRouter()
// also throws synchronously, at construction time, when none of
// QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY / QSTASH_REGION are
// set — e.g. a deployer who forgot to configure the QStash env vars. Without
// the construction inside the try block, that throw would propagate as an
// unhandled crash (a generic Next.js 500) instead of this route's intended
// clean 401.
let verifiedHandler: ((request: Request, params?: unknown) => Promise<Response>) | undefined

export async function POST(request: Request, params?: unknown) {
  try {
    if (!verifiedHandler) {
      verifiedHandler = verifySignatureAppRouter(handler)
    }
    return await verifiedHandler(request, params)
  } catch (err) {
    // The underlying Receiver throws (rather than returning a rejecting
    // Response) when the `Upstash-Signature` header is present but
    // malformed (e.g. not a valid compact JWS) — that must still be
    // treated as "not verified", not as an unhandled crash that could let
    // the request fall through.
    console.error('[POST /api/jobsearch/scan/worker] signature verification failed', err)
    return apiError('UNAUTHORIZED', 'Invalid signature', 401)
  }
}
