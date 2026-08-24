// QStash publish helper for the scheduled scan pipeline (design spec §6).
// Manual "Scan now" (app/api/jobsearch/scan/route.ts) deliberately bypasses
// this and stays synchronous — see this plan's Global Constraints for why.
// QStash's value (avoiding one cron invocation's duration limit while
// fanning out across every active profile) only applies to the scheduled
// path, so only app/api/jobsearch/scan/cron/route.ts calls publishScanJob().
import { Client } from '@upstash/qstash'

function resolveAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export async function publishScanJob(userId: string, profileId: string): Promise<void> {
  // QStash's SDK defaults to the EU region endpoint (qstash.upstash.io) when
  // no baseUrl is given. A US-region (or any non-default-region) QStash
  // instance's token/signing keys only work against that region's own URL
  // (e.g. qstash-us-east-1.upstash.io) — omitting this silently sends every
  // publish call to the wrong region, where the token won't authenticate.
  const client = new Client({ token: process.env.QSTASH_TOKEN, baseUrl: process.env.QSTASH_URL })
  await client.publishJSON({
    url: `${resolveAppUrl()}/api/jobsearch/scan/worker`,
    body: { userId, profileId },
  })
}
