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
  const client = new Client({ token: process.env.QSTASH_TOKEN })
  await client.publishJSON({
    url: `${resolveAppUrl()}/api/jobsearch/scan/worker`,
    body: { userId, profileId },
  })
}
