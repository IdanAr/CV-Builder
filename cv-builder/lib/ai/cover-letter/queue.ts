// lib/ai/cover-letter/queue.ts
// Hands a stored "writing" letter to the job. With QStash configured the job
// is delivered to the signature-verified worker route, which gets its own
// invocation and duration budget; without it (local dev, or a deploy that has
// not set it up) the job runs after the response in the same invocation.
import { after } from 'next/server'
import { Client } from '@upstash/qstash'
import { resolveAppUrl } from '@/lib/jobsearch/queue'
import { runCoverLetterJob } from './job'

const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i

/**
 * startedAt is when the create request began: on the after() path the job
 * runs inside that request, so its time counts against the job's budget.
 */
export async function enqueueCoverLetter(
  userId: string,
  letterId: string,
  { startedAt }: { startedAt?: number } = {}
): Promise<void> {
  // QStash cannot call back to localhost (only the local QStash dev server,
  // itself on localhost, can), so a dev setup with a real token would leave
  // every letter to go stale.
  const appUrl = resolveAppUrl()
  const unreachable = LOCAL_HOST.test(appUrl) && !LOCAL_HOST.test(process.env.QSTASH_URL ?? '')
  if (process.env.QSTASH_TOKEN && unreachable) {
    console.warn(`[cover-letter queue] QStash cannot reach ${appUrl}; writing the letter in after() instead`)
  }
  if (!process.env.QSTASH_TOKEN || unreachable) {
    // The create route's maxDuration has to cover the job on this path.
    after(() =>
      runCoverLetterJob(userId, letterId, startedAt === undefined ? {} : { startedAt }).then(
        () => undefined,
        (err) => console.error('[cover-letter queue] job threw', err instanceof Error ? err.name : 'unknown')
      )
    )
    return
  }
  // baseUrl and the bypass header: see publishScanJob in lib/jobsearch/queue.ts.
  const client = new Client({ token: process.env.QSTASH_TOKEN, baseUrl: process.env.QSTASH_URL })
  const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
    : undefined
  await client.publishJSON({
    url: `${appUrl}/api/cover-letters/worker`,
    body: { userId, letterId },
    // One redelivery if the first fails before the job could claim the letter;
    // the claim makes any later delivery a no-op.
    retries: 1,
    headers,
  })
}
