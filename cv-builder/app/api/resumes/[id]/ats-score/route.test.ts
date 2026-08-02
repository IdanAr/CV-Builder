import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

vi.mock('@/lib/ai/jd-extraction-pipeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/jd-extraction-pipeline')>()
  return {
    ...actual,
    extractJdRequirements: vi.fn(),
  }
})

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return {
    ...actual,
    checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })),
  }
})

async function authedRequest(body: unknown) {
  const { auth } = await import('@/lib/auth')
  vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
  })

  const { getResume } = await import('@/lib/api/resumes')
  vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV', data: {}, meta: {} } as never)

  const { POST } = await import('./route')
  const req = new Request('http://localhost/api/resumes/abc/ats-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
  const json = await res.json()
  return { res, json }
}

describe('POST /api/resumes/[id]/ats-score', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
    const { scoreResume } = await import('@/lib/ats/scorer')
    const { res } = await authedRequest({ jobDescription: 'React developer', semanticMatches: ['kubernetes'], jdKeywords: ['react'] })
    expect(res.status).toBe(200)
    expect(scoreResume).toHaveBeenCalledWith({}, 'React developer', [], ['kubernetes'], ['react'])
  })

  it('defaults semanticMatches to an empty array when omitted', async () => {
    const { scoreResume } = await import('@/lib/ats/scorer')
    await authedRequest({ jobDescription: 'React developer', jdKeywords: ['react'] })
    expect(scoreResume).toHaveBeenCalledWith({}, 'React developer', [], [], ['react'])
  })

  it('uses cached jdKeywords from the body without calling the rate limiter or AI extraction', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const { extractJdRequirements } = await import('@/lib/ai/jd-extraction-pipeline')
    const { scoreResume } = await import('@/lib/ats/scorer')

    const { res } = await authedRequest({ jobDescription: 'React developer', jdKeywords: ['react', 'typescript'] })

    expect(res.status).toBe(200)
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(extractJdRequirements).not.toHaveBeenCalled()
    expect(scoreResume).toHaveBeenCalledWith({}, 'React developer', [], [], ['react', 'typescript'])
  })

  it('extracts fresh jdKeywords via AI when none are cached and the job description is non-blank', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const { extractJdRequirements } = await import('@/lib/ai/jd-extraction-pipeline')
    vi.mocked(extractJdRequirements).mockResolvedValueOnce([
      { term: 'mixpanel', priority: 'nice-to-have' },
      { term: 'amplitude', priority: 'nice-to-have' },
    ])
    const { scoreResume } = await import('@/lib/ats/scorer')

    const { res, json } = await authedRequest({ jobDescription: 'Analytics role' })

    expect(res.status).toBe(200)
    expect(checkRateLimit).toHaveBeenCalledWith('user-1:ai', expect.any(Object))
    expect(extractJdRequirements).toHaveBeenCalledWith('Analytics role')
    expect(scoreResume).toHaveBeenCalledWith({}, 'Analytics role', [], [], ['mixpanel', 'amplitude'])
    expect(json.keywordPriorities).toEqual({ mixpanel: 'nice-to-have', amplitude: 'nice-to-have' })
  })

  it('reuses cached keywordPriorities from the body instead of recomputing them, when jdKeywords is also cached', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const { extractJdRequirements } = await import('@/lib/ai/jd-extraction-pipeline')

    const { res, json } = await authedRequest({
      jobDescription: 'React developer',
      jdKeywords: ['react', 'kubernetes'],
      keywordPriorities: { react: 'must', kubernetes: 'ambiguous' },
    })

    expect(res.status).toBe(200)
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(extractJdRequirements).not.toHaveBeenCalled()
    expect(json.keywordPriorities).toEqual({ react: 'must', kubernetes: 'ambiguous' })
  })

  it('normalizes malformed cached priority values instead of trusting the client blindly', async () => {
    const { res, json } = await authedRequest({
      jobDescription: 'React developer',
      jdKeywords: ['react'],
      keywordPriorities: { react: 'not-a-real-priority' },
    })

    expect(res.status).toBe(200)
    expect(json.keywordPriorities).toEqual({ react: 'ambiguous' })
  })

  it('falls back to an empty override and empty priorities (regex extraction inside scoreResume) when rate limited, and still returns 200', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, retryAfterSeconds: 42 })
    const { extractJdRequirements } = await import('@/lib/ai/jd-extraction-pipeline')
    const { scoreResume } = await import('@/lib/ats/scorer')

    const { res, json } = await authedRequest({ jobDescription: 'React developer' })

    expect(res.status).toBe(200)
    expect(extractJdRequirements).not.toHaveBeenCalled()
    expect(scoreResume).toHaveBeenCalledWith({}, 'React developer', [], [], [])
    expect(json.keywordPriorities).toEqual({})
  })

  it('falls back to an empty override and empty priorities when AI extraction throws, and still returns 200', async () => {
    const { extractJdRequirements } = await import('@/lib/ai/jd-extraction-pipeline')
    vi.mocked(extractJdRequirements).mockRejectedValueOnce(new Error('Anthropic API error'))
    const { scoreResume } = await import('@/lib/ats/scorer')

    const { res, json } = await authedRequest({ jobDescription: 'React developer' })

    expect(res.status).toBe(200)
    expect(scoreResume).toHaveBeenCalledWith({}, 'React developer', [], [], [])
    expect(json.keywordPriorities).toEqual({})
  })

  it('does not attempt AI extraction when the job description is blank', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const { extractJdRequirements } = await import('@/lib/ai/jd-extraction-pipeline')
    const { scoreResume } = await import('@/lib/ats/scorer')

    const { res, json } = await authedRequest({})

    expect(res.status).toBe(200)
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(extractJdRequirements).not.toHaveBeenCalled()
    expect(scoreResume).toHaveBeenCalledWith({}, '', [], [], [])
    expect(json.keywordPriorities).toEqual({})
  })
})
