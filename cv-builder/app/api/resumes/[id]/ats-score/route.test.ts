import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: null }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(),
}))

vi.mock('@/lib/ats/scorer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ats/scorer')>()
  return {
    ...actual,
    scoreResume: vi.fn(actual.scoreResume),
  }
})

describe('POST /api/resumes/[id]/ats-score', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ats-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: 'React developer needed' }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(401)
  })

  it('forwards semanticMatches to scoreResume, defaulting to an empty array', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
    })

    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV', data: {}, meta: {} } as never)

    const { scoreResume } = await import('@/lib/ats/scorer')

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ats-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: 'React developer', semanticMatches: ['kubernetes'] }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(200)
    expect(scoreResume).toHaveBeenCalledWith({}, 'React developer', [], ['kubernetes'])
  })

  it('defaults semanticMatches to an empty array when omitted', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
    })

    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV', data: {}, meta: {} } as never)

    const { scoreResume } = await import('@/lib/ats/scorer')

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ats-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: 'React developer' }),
    })
    await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never)
    expect(scoreResume).toHaveBeenCalledWith({}, 'React developer', [], [])
  })
})
