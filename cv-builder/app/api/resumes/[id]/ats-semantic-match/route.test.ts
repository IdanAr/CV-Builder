import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: null }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(),
}))

vi.mock('@/lib/ai/keyword-analysis-pipeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/keyword-analysis-pipeline')>()
  return { ...actual, runSemanticKeywordAnalysis: vi.fn() }
})

// The cache module's real key function is used; only its database calls are stubbed.
vi.mock('@/lib/db', () => ({ default: vi.fn(async () => undefined) }))

vi.mock('@/lib/api/ai-cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/ai-cache')>()
  return {
    aiCacheKey: actual.aiCacheKey,
    readAiCache: vi.fn(async () => null),
    writeAiCache: vi.fn(async () => undefined),
  }
})

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return {
    ...actual,
    checkAiRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
  }
})

describe('POST /api/resumes/[id]/ats-semantic-match', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ats-semantic-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missingKeywords: ['kubernetes'] }),
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
    const req = new Request('http://localhost/api/resumes/abc/ats-semantic-match', {
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

    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV', data: { basics: { summary: 'k8s' } }, meta: {} } as never)
    const { checkAiRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkAiRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 42, scope: 'minute' })

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ats-semantic-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missingKeywords: ['kubernetes'] }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    expect(await res.json()).toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('returns confirmedMatches from the pipeline, built from the resume text', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
    })

    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValueOnce({
      title: 'My CV',
      data: { basics: { name: 'Jane', summary: 'Ran production workloads on k8s.' } },
      meta: {},
    } as never)

    const { runSemanticKeywordAnalysis } = await import('@/lib/ai/keyword-analysis-pipeline')
    vi.mocked(runSemanticKeywordAnalysis).mockResolvedValueOnce([{ keyword: 'kubernetes', evidence: 'workloads on k8s' }])

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ats-semantic-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missingKeywords: ['kubernetes', 'docker'] }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ confirmedMatches: ['kubernetes'], evidence: { kubernetes: 'workloads on k8s' } })
    expect(runSemanticKeywordAnalysis).toHaveBeenCalledWith(
      expect.stringContaining('k8s'),
      ['kubernetes', 'docker']
    )
  })

  async function authedPost(body: unknown, summary = 'Ran production workloads on k8s.') {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
    })
    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV', data: { basics: { summary } }, meta: {} } as never)
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ats-semantic-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
  }

  it('answers an unchanged CV from the cache, without the rate limiter or AI, in the spelling asked for', async () => {
    const { readAiCache } = await import('@/lib/api/ai-cache')
    vi.mocked(readAiCache).mockResolvedValueOnce([{ keyword: 'kubernetes', evidence: 'k8s' }])
    const { checkAiRateLimit } = await import('@/lib/rate-limit')
    const { runSemanticKeywordAnalysis } = await import('@/lib/ai/keyword-analysis-pipeline')

    const res = await authedPost({ missingKeywords: ['Kubernetes', 'docker'] })

    expect(await res.json()).toEqual({ confirmedMatches: ['Kubernetes'], evidence: { Kubernetes: 'k8s' } })
    expect(checkAiRateLimit).not.toHaveBeenCalled()
    expect(runSemanticKeywordAnalysis).not.toHaveBeenCalled()
  })

  it('keys the cache on the CV text and the keyword set, whatever their order or case', async () => {
    const { readAiCache } = await import('@/lib/api/ai-cache')
    const { runSemanticKeywordAnalysis } = await import('@/lib/ai/keyword-analysis-pipeline')
    vi.mocked(runSemanticKeywordAnalysis).mockResolvedValue([])
    await authedPost({ missingKeywords: ['docker', 'Kubernetes'] })
    await authedPost({ missingKeywords: ['kubernetes', 'docker'] })
    await authedPost({ missingKeywords: ['kubernetes', 'docker'] }, 'A different CV.')
    const keys = vi.mocked(readAiCache).mock.calls.map((c) => c[2])
    expect(keys[0]).toBe(keys[1])
    expect(keys[2]).not.toBe(keys[0])
  })

  it('saves confirmed matches, but not an empty answer', async () => {
    const { writeAiCache } = await import('@/lib/api/ai-cache')
    const { runSemanticKeywordAnalysis } = await import('@/lib/ai/keyword-analysis-pipeline')
    vi.mocked(runSemanticKeywordAnalysis).mockResolvedValueOnce([{ keyword: 'kubernetes', evidence: 'k8s' }])
    await authedPost({ missingKeywords: ['kubernetes'] })
    expect(writeAiCache).toHaveBeenCalledWith('user-1', 'synonym-matches', expect.any(String), [{ keyword: 'kubernetes', evidence: 'k8s' }])

    vi.mocked(writeAiCache).mockClear()
    vi.mocked(runSemanticKeywordAnalysis).mockResolvedValueOnce([])
    await authedPost({ missingKeywords: ['docker'] })
    expect(writeAiCache).not.toHaveBeenCalled()
  })
})
