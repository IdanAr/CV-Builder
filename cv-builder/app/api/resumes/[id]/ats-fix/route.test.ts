import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: null }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(),
}))

vi.mock('@/lib/ai/ats-fix-pipeline', () => ({
  runAtsFixPipeline: vi.fn(),
}))

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return {
    ...actual,
    checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })),
  }
})

describe('POST /api/resumes/[id]/ats-fix', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ats-fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missingKeywords: ['react'] }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(401)
  })

  it('returns 400 when missingKeywords is missing', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
    })

    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV', data: {}, meta: {} } as never)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ats-fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(400)
  })

  it('returns 429 with Retry-After when the user is rate limited', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
    })

    const { checkRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, retryAfterSeconds: 42 })

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ats-fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missingKeywords: ['react'] }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    expect(await res.json()).toMatchObject({ code: 'RATE_LIMITED' })
  })
})
