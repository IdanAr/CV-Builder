import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockRunJob } = vi.hoisted(() => ({ mockRunJob: vi.fn() }))
vi.mock('@/lib/ai/cover-letter/job', () => ({ runCoverLetterJob: mockRunJob }))

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

function req(headers?: Record<string, string>) {
  return new Request('http://test/api/cover-letters/worker', {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId: 'u1', letterId: 'l1' }),
  })
}

describe('POST /api/cover-letters/worker signature verification', () => {
  it('rejects an unsigned request with 401 before running the job', async () => {
    const res = await POST(req() as never, undefined as never)

    expect(res.status).toBe(401)
    expect(mockRunJob).not.toHaveBeenCalled()
  })

  it('rejects an invalid Upstash-Signature header with 401', async () => {
    const res = await POST(req({ 'Upstash-Signature': 'not-a-real-signature' }) as never, undefined as never)

    expect(res.status).toBe(401)
    expect(mockRunJob).not.toHaveBeenCalled()
  })

  it('fails cleanly with 401 when the signing-key env vars are entirely unset', async () => {
    delete process.env.QSTASH_CURRENT_SIGNING_KEY
    delete process.env.QSTASH_NEXT_SIGNING_KEY
    delete process.env.QSTASH_REGION

    // The verified handler is built once per module instance, so load a fresh
    // one to hit the construction-time throw.
    vi.resetModules()
    const { POST: freshPost } = await import('./route')
    const res = await freshPost(req({ 'Upstash-Signature': 'not-a-real-signature' }) as never, undefined as never)

    expect(res.status).toBe(401)
    expect(mockRunJob).not.toHaveBeenCalled()
  })
})
