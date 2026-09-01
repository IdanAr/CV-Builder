import { describe, it, expect, vi, beforeEach } from 'vitest'
import { _resetRateLimits } from '@/lib/rate-limit'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(async () => ({
    title: 'My Resume',
    data: {},
    meta: { templateId: 'classic' },
  })),
}))

vi.mock('docx', () => ({
  Packer: { toBuffer: vi.fn(async () => Buffer.from('fake-docx')) },
}))

vi.mock('@/lib/docx/resume-docx', () => ({
  buildDocx: vi.fn(() => ({})),
}))

function req(): Request {
  return new Request('http://localhost/api/resumes/abc/export/docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

describe('POST /api/resumes/[id]/export/docx', () => {
  beforeEach(() => {
    _resetRateLimits()
    mockSession = { user: { id: 'user-1' } }
  })

  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { POST } = await import('./route')
    const res = await POST(req() as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(401)
  })

  it('rate limits after the export budget is exhausted', async () => {
    const { POST } = await import('./route')
    const { EXPORT_RATE_LIMIT } = await import('@/lib/rate-limit')
    for (let i = 0; i < EXPORT_RATE_LIMIT.limit; i++) {
      const res = await POST(req() as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
      expect(res.status).toBe(200)
    }
    const res = await POST(req() as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })
})
