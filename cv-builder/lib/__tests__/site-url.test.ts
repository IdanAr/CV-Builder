import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveSiteUrl } from '../site-url'

const KEYS = ['APP_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'] as const
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
  KEYS.forEach((k) => delete process.env[k])
})
afterEach(() => {
  KEYS.forEach((k) => {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  })
})

describe('resolveSiteUrl', () => {
  it('prefers an explicit APP_URL', () => {
    process.env.APP_URL = 'https://cv.example.com'
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'prod.vercel.app'
    process.env.VERCEL_URL = 'deploy-abc123.vercel.app'
    expect(resolveSiteUrl()).toBe('https://cv.example.com')
  })

  // The distinction this helper exists for. A preview deployment has to emit
  // *production* canonical URLs and sitemap entries; if it named its own
  // per-deployment hostname, every preview would compete with production in
  // search results. `lib/jobsearch/queue.ts` deliberately resolves the other
  // way, because a QStash callback must reach the deployment that sent it.
  it('prefers the stable production alias over the per-deployment hostname', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'prod.vercel.app'
    process.env.VERCEL_URL = 'deploy-abc123.vercel.app'
    expect(resolveSiteUrl()).toBe('https://prod.vercel.app')
  })

  it('falls back to the deployment hostname when no production alias is set', () => {
    process.env.VERCEL_URL = 'deploy-abc123.vercel.app'
    expect(resolveSiteUrl()).toBe('https://deploy-abc123.vercel.app')
  })

  it('falls back to localhost outside Vercel', () => {
    expect(resolveSiteUrl()).toBe('http://localhost:3000')
  })

  // `${base}/terms` is string concatenation, so a configured trailing slash
  // would emit `https://x.com//terms` into the sitemap.
  it('strips trailing slashes so concatenated paths stay single-slashed', () => {
    process.env.APP_URL = 'https://cv.example.com///'
    expect(resolveSiteUrl()).toBe('https://cv.example.com')
    expect(`${resolveSiteUrl()}/terms`).toBe('https://cv.example.com/terms')
  })
})
