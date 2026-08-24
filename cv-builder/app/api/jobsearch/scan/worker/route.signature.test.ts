import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockRunScan } = vi.hoisted(() => ({ mockRunScan: vi.fn() }))
vi.mock('@/lib/jobsearch/scan', () => ({ runScanForProfile: mockRunScan }))

import { POST } from './route'

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.QSTASH_CURRENT_SIGNING_KEY = 'sig_test_current_signing_key_1234567890'
  process.env.QSTASH_NEXT_SIGNING_KEY = 'sig_test_next_signing_key_1234567890'
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('POST /api/jobsearch/scan/worker signature verification', () => {
  it('rejects a request with no Upstash-Signature header before calling runScanForProfile', async () => {
    const req = new Request('http://test/api/jobsearch/scan/worker', {
      method: 'POST',
      body: JSON.stringify({ userId: 'u1', profileId: 'p1' }),
    })

    const res = await POST(req as never, undefined as never)

    expect(res.status).not.toBe(200)
    expect(mockRunScan).not.toHaveBeenCalled()
  })

  it('rejects a request with an invalid Upstash-Signature header', async () => {
    const req = new Request('http://test/api/jobsearch/scan/worker', {
      method: 'POST',
      headers: { 'Upstash-Signature': 'not-a-real-signature' },
      body: JSON.stringify({ userId: 'u1', profileId: 'p1' }),
    })

    const res = await POST(req as never, undefined as never)

    expect(res.status).not.toBe(200)
    expect(mockRunScan).not.toHaveBeenCalled()
  })

  it('fails cleanly (not an unhandled crash) when the QStash signing-key env vars are entirely unset', async () => {
    delete process.env.QSTASH_CURRENT_SIGNING_KEY
    delete process.env.QSTASH_NEXT_SIGNING_KEY
    delete process.env.QSTASH_REGION

    // The route module caches its verifySignatureAppRouter()-wrapped handler
    // in a module-scoped variable built lazily on first request. Earlier
    // tests in this file already built it with valid keys, so re-import a
    // fresh module instance here to actually exercise the construction-time
    // throw (verifySignatureAppRouter throws synchronously when none of the
    // signing-key / region env vars are set).
    vi.resetModules()
    const { POST: freshPost } = await import('./route')

    const req = new Request('http://test/api/jobsearch/scan/worker', {
      method: 'POST',
      body: JSON.stringify({ userId: 'u1', profileId: 'p1' }),
    })

    const res = await freshPost(req as never, undefined as never)

    expect(res).toBeInstanceOf(Response)
    expect(res.status).not.toBe(200)
    expect(mockRunScan).not.toHaveBeenCalled()
  })
})
