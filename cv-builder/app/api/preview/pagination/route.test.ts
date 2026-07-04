import { describe, it, expect, vi, beforeEach } from 'vitest'
import { _resetRateLimits } from '@/lib/rate-limit'

let mockSession: { user: { id: string } } | null = null

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn(() => Buffer.from('fake-pdf')),
}))

vi.mock('@/lib/pdf/extract-pagination', () => ({
  extractPagination: vi.fn(async () => ({ pageCount: 3, anchors: ['anchor one', 'anchor two'] })),
}))

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/preview/pagination', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/preview/pagination', () => {
  beforeEach(() => {
    _resetRateLimits()
    mockSession = { user: { id: 'user-1' } }
  })

  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { POST } = await import('./route')
    const res = (await POST(makeRequest({ data: {}, meta: {} }) as never, undefined as never)) as Response
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid payload', async () => {
    const { POST } = await import('./route')
    const res = (await POST(makeRequest({ data: { work: 'not-an-array' } }) as never, undefined as never)) as Response
    expect(res.status).toBe(400)
  })

  it('returns pagination truth for a valid payload', async () => {
    const { POST } = await import('./route')
    const res = (await POST(makeRequest({ data: {}, meta: {} }) as never, undefined as never)) as Response
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ pageCount: 3, anchors: ['anchor one', 'anchor two'] })
  })

  it('returns 400 when the payload exceeds the size cap', async () => {
    const { POST } = await import('./route')
    const oversized = JSON.stringify({ data: { basics: { summary: 'x'.repeat(1_100_000) } }, meta: {} })
    const req = new Request('http://localhost/api/preview/pagination', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: oversized,
    })
    const res = (await POST(req as never, undefined as never)) as Response
    expect(res.status).toBe(400)
  })

  it('rate limits after 30 requests per minute', async () => {
    const { POST } = await import('./route')
    for (let i = 0; i < 30; i++) {
      const res = (await POST(makeRequest({ data: {}, meta: {} }) as never, undefined as never)) as Response
      expect(res.status).toBe(200)
    }
    const res = (await POST(makeRequest({ data: {}, meta: {} }) as never, undefined as never)) as Response
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })
})
