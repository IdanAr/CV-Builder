import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: null }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(),
}))

vi.mock('@/lib/ai/cover-letter-pipeline', () => ({
  generateCoverLetter: vi.fn(),
}))

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return {
    ...actual,
    checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })),
  }
})

describe('POST /api/resumes/[id]/cover-letter', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/cover-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: 'We need a frontend engineer.' }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(401)
  })

  it('returns 400 when jobDescription is missing', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
    })

    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV', data: {}, meta: {} } as never)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/cover-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(400)
  })

  it('returns 400 when jobDescription is an empty string', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
    })

    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV', data: {}, meta: {} } as never)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/cover-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: '   ' }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when the resume is not found or not owned by the user', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
    })

    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValueOnce(null as never)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/cover-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: 'We need a frontend engineer.' }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(404)
  })

  it('returns 429 with Retry-After when the user is rate limited', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
    })

    const { checkRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, retryAfterSeconds: 42 })

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/cover-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: 'We need a frontend engineer.' }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    expect(await res.json()).toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('returns the pipeline result for a valid request', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
    })

    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV', data: { basics: { name: 'Jane' } }, meta: {} } as never)

    const { generateCoverLetter } = await import('@/lib/ai/cover-letter-pipeline')
    vi.mocked(generateCoverLetter).mockResolvedValueOnce({
      content: 'Dear Hiring Manager, ...',
      pendingApprovals: [],
    })

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/cover-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: 'We need a frontend engineer.', companyName: 'Globex', roleName: 'Frontend Engineer' }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ content: 'Dear Hiring Manager, ...', pendingApprovals: [] })
    expect(generateCoverLetter).toHaveBeenCalledWith(
      { basics: { name: 'Jane' } },
      'We need a frontend engineer.',
      { companyName: 'Globex', roleName: 'Frontend Engineer' }
    )
  })
})
