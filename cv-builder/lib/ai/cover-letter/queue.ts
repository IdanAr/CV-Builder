// lib/ai/cover-letter/queue.ts
// Hands a stored "writing" letter to the job. With QStash configured the job
// is delivered to the signature-verified worker route, which gets its own
// invocation and duration budget; without it (local dev, or a deploy that has
// not set it up) the job runs after the response in the same invocation.
import { after } from 'next/server'
import { Client } from '@upstash/qstash'
import { resolveAppUrl } from '@/lib/jobsearch/queue'
import { runCoverLetterJob } from './job'

export async function enqueueCoverLetter(userId: string, letterId: string): Promise<void> {
  if (!process.env.QSTASH_TOKEN) {
    // The create route's maxDuration has to cover the job on this path.
    after(() =>
      runCoverLetterJob(userId, letterId).then(
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
    url: `${resolveAppUrl()}/api/cover-letters/worker`,
    body: { userId, letterId },
    // One redelivery if the first fails before the job could claim the letter;
    // the claim makes any later delivery a no-op.
    retries: 1,
    headers,
  })
}
