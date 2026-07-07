import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  duplicateResume: vi.fn(),
}))

describe('POST /api/resumes/[id]/duplicate', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('passes targetCompany/targetRole from the request body through to duplicateResume', async () => {
    const { duplicateResume } = await import('@/lib/api/resumes')
    vi.mocked(duplicateResume).mockResolvedValueOnce({ _id: 'r2' } as never)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/r1/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCompany: 'Acme Inc', targetRole: 'Engineer' }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'r1' }) } as never) as Response

    expect(res.status).toBe(201)
    expect(duplicateResume).toHaveBeenCalledWith('user-1', 'r1', {
      targetCompany: 'Acme Inc',
      targetRole: 'Engineer',
    })
  })

  it('passes undefined overrides when no body is sent', async () => {
    const { duplicateResume } = await import('@/lib/api/resumes')
    vi.mocked(duplicateResume).mockResolvedValueOnce({ _id: 'r2' } as never)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/r1/duplicate', { method: 'POST' })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'r1' }) } as never) as Response

    expect(res.status).toBe(201)
    expect(duplicateResume).toHaveBeenCalledWith('user-1', 'r1', {
      targetCompany: undefined,
      targetRole: undefined,
    })
  })

  it('caps overly long targetCompany/targetRole values to 200 characters', async () => {
    const { duplicateResume } = await import('@/lib/api/resumes')
    vi.mocked(duplicateResume).mockResolvedValueOnce({ _id: 'r2' } as never)

    const longCompany = 'A'.repeat(500)
    const longRole = 'B'.repeat(500)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/r1/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCompany: longCompany, targetRole: longRole }),
    })
    await POST(req as never, { params: Promise.resolve({ id: 'r1' }) } as never)

    const call = vi.mocked(duplicateResume).mock.calls[0]
    expect((call[2] as { targetCompany?: string }).targetCompany?.length).toBe(200)
    expect((call[2] as { targetRole?: string }).targetRole?.length).toBe(200)
  })

  it('ignores non-string targetCompany/targetRole values', async () => {
    const { duplicateResume } = await import('@/lib/api/resumes')
    vi.mocked(duplicateResume).mockResolvedValueOnce({ _id: 'r2' } as never)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/r1/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCompany: 123, targetRole: { nested: true } }),
    })
    await POST(req as never, { params: Promise.resolve({ id: 'r1' }) } as never)

    expect(duplicateResume).toHaveBeenCalledWith('user-1', 'r1', {
      targetCompany: undefined,
      targetRole: undefined,
    })
  })

  it('returns 404 when source resume not found', async () => {
    const { duplicateResume } = await import('@/lib/api/resumes')
    vi.mocked(duplicateResume).mockResolvedValueOnce(null)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/nope/duplicate', { method: 'POST' })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'nope' }) } as never) as Response

    expect(res.status).toBe(404)
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: null }) as never, ctx as never)
    })

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/r1/duplicate', { method: 'POST' })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'r1' }) } as never) as Response

    expect(res.status).toBe(401)
  })
})
