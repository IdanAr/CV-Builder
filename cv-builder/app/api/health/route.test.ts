import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockDbConnect, mockPing } = vi.hoisted(() => ({
  mockDbConnect: vi.fn(),
  mockPing: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ default: mockDbConnect }))
vi.mock('mongoose', () => ({
  default: { connection: { db: { admin: () => ({ ping: mockPing }) } } },
}))

import { GET, HEALTH_TIMING } from './route'
import { _resetRateLimits } from '@/lib/rate-limit'

const REQUIRED = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
  AUTH_SECRET: 's', AUTH_GITHUB_ID: 'a', AUTH_GITHUB_SECRET: 'b',
  AUTH_GOOGLE_ID: 'c', AUTH_GOOGLE_SECRET: 'd', ANTHROPIC_API_KEY: 'e',
}
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  vi.clearAllMocks()
  _resetRateLimits()
  mockDbConnect.mockResolvedValue(undefined)
  mockPing.mockResolvedValue({ ok: 1 })
  for (const [k, v] of Object.entries({ ...REQUIRED, CRON_SECRET: 'ops-secret' })) {
    saved[k] = process.env[k]
    process.env[k] = v
  }
})

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

function req(opts: { auth?: string; ip?: string } = {}) {
  const headers = new Headers()
  if (opts.auth) headers.set('authorization', opts.auth)
  headers.set('x-forwarded-for', opts.ip ?? '203.0.113.1')
  return new Request('http://test/api/health', { headers })
}

describe('GET /api/health', () => {
  it('reports ok when config is complete and the database answers', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      status: 'ok',
      checks: { config: 'ok', database: 'ok' },
    })
  })

  it('round-trips to the database rather than trusting a cached handle', async () => {
    // readyState alone would say "connected" from a pooled connection whose
    // server has since gone away.
    await GET(req())
    expect(mockPing).toHaveBeenCalledTimes(1)
  })

  it('returns 503 and names no variable when the database is unreachable', async () => {
    mockDbConnect.mockRejectedValue(new Error('ECONNREFUSED 10.0.0.1:27017'))
    const res = await GET(req())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toEqual({ status: 'degraded', checks: { config: 'ok', database: 'unreachable' } })
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED')
  })

  it('returns 503 when a required variable is missing', async () => {
    delete process.env.AUTH_SECRET
    const res = await GET(req())
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      status: 'degraded',
      checks: { config: 'incomplete', database: 'ok' },
    })
  })

  it('never leaks which variable is missing to an unauthenticated caller', async () => {
    delete process.env.AUTH_GITHUB_SECRET
    const body = JSON.stringify(await (await GET(req())).json())
    expect(body).not.toContain('AUTH_GITHUB_SECRET')
    expect(body).not.toContain('details')
  })

  it('gives an operator the detail once they present the ops bearer', async () => {
    delete process.env.AUTH_GITHUB_SECRET
    const res = await GET(req({ auth: 'Bearer ops-secret' }))
    const body = await res.json()
    expect(body.details.problems).toEqual([
      { name: 'AUTH_GITHUB_SECRET', kind: 'missing', message: 'not set' },
    ])
    expect(body.details.knownFeatures).toContain('Scheduled job-search scans')
  })

  it('includes the database error only for an authorised caller', async () => {
    mockDbConnect.mockRejectedValue(new Error('ECONNREFUSED 10.0.0.1:27017'))
    const body = await (await GET(req({ auth: 'Bearer ops-secret' }))).json()
    expect(body.details.databaseError).toContain('ECONNREFUSED')
  })

  it('rejects a wrong bearer without revealing detail', async () => {
    const body = await (await GET(req({ auth: 'Bearer nope' }))).json()
    expect(body.details).toBeUndefined()
  })

  it('rate-limits anonymous callers per IP', async () => {
    for (let i = 0; i < 30; i++) expect((await GET(req({ ip: '198.51.100.7' }))).status).toBe(200)
    expect((await GET(req({ ip: '198.51.100.7' }))).status).toBe(429)
    // A different prober is unaffected.
    expect((await GET(req({ ip: '198.51.100.8' }))).status).toBe(200)
  })

  it('does not rate-limit an authorised caller', async () => {
    for (let i = 0; i < 40; i++) {
      expect((await GET(req({ auth: 'Bearer ops-secret', ip: '198.51.100.9' }))).status).toBe(200)
    }
  })

  it('reports how long the database round-trip took, to an operator', async () => {
    const body = await (await GET(req({ auth: 'Bearer ops-secret' }))).json()
    expect(typeof body.details.databaseLatencyMs).toBe('number')
  })

  it('stays closed when no CRON_SECRET is configured', async () => {
    delete process.env.CRON_SECRET
    const body = await (await GET(req({ auth: 'Bearer undefined' }))).json()
    expect(body.details).toBeUndefined()
  })
})

describe('health probe timing', () => {
  // Slowest cold connect+ping actually observed against this project's Atlas
  // cluster (SRV lookup, TLS handshake, server selection). Warm calls are
  // 80-720ms. Vercel pays the cold cost on every cold lambda, so a ceiling
  // near this marks healthy deploys "degraded" -- three earlier candidates
  // (3s, 8s, 12s) all did. Lowering dbPingTimeoutMs below it is the
  // regression this guards.
  const SLOWEST_OBSERVED_COLD_CONNECT_MS = 10_460

  it('allows longer than the slowest cold connect observed', () => {
    expect(HEALTH_TIMING.dbPingTimeoutMs).toBeGreaterThan(SLOWEST_OBSERVED_COLD_CONNECT_MS)
  })

  it('still answers before the platform kills the function', () => {
    // Room left over for serialising and returning the response.
    expect(HEALTH_TIMING.dbPingTimeoutMs).toBeLessThan(HEALTH_TIMING.maxDurationSeconds * 1000)
  })
})
