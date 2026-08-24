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
  // If Vercel Deployment Protection (SSO/password) is enabled on this
  // project, every request — including QStash's own callback — gets
  // redirected to a login page before our route ever runs. Vercel
  // auto-injects VERCEL_AUTOMATION_BYPASS_SECRET once a "Protection Bypass
  // for Automation" secret exists for the project; forwarding it as a
  // header (which QStash preserves on delivery) lets the callback through.
  // Absent locally and on unprotected deployments — harmlessly omitted.
  const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
    : undefined
  // TEMPORARY diagnostic — remove once the Deployment Protection bypass is
  // confirmed working end-to-end. Logs presence only, never the value.
  console.log(
    '[publishScanJob] VERCEL_AUTOMATION_BYPASS_SECRET present:',
    !!process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  )
  await client.publishJSON({
    url: `${resolveAppUrl()}/api/jobsearch/scan/worker`,
    body: { userId, profileId },
    headers,
  })
}
