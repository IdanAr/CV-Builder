import { describe, it, expect, vi, afterEach } from 'vitest'

// A module exports several auth()-wrapped handlers, so the session is read when a
// request arrives instead of being consumed once when the module is imported.
const session = vi.hoisted(() => ({ current: null as { user: { id: string } } | null }))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: session.current }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(),
}))

vi.mock('@/lib/api/cover-letters', () => ({
  listCoverLetters: vi.fn(),
  createCoverLetter: vi.fn(),
  latestNotes: vi.fn(),
  suggestedPostingFor: vi.fn(),
  failWritingLetter: vi.fn(),
  START_FAILED_MESSAGE: 'Could not start this letter. Please try again.',
}))

vi.mock('@/lib/ai/cover-letter/queue', () => ({
  enqueueCoverLetter: vi.fn(),
}))

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return {
    ...actual,
    checkAiRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
  }
})

const ctx = { params: Promise.resolve({ id: 'cv-1' }) } as never

function signIn() {
  session.current = { user: { id: 'user-1' } }
}

function post(body: unknown) {
  return new Request('http://localhost/api/resumes/cv-1/cover-letters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const VALID_BODY = { company: 'Globex', role: 'Frontend Engineer', jobText: 'We need a frontend engineer.' }

describe('/api/resumes/[id]/cover-letters', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    session.current = null
  })

  describe('GET', () => {
    it('returns 401 when not authenticated', async () => {
      const { GET } = await import('./route')
      const res = (await GET(new Request('http://localhost/x') as never, ctx)) as Response
      expect(res.status).toBe(401)
    })

    it('returns 404 when the CV is not the users', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce(null as never)
      const { listCoverLetters } = await import('@/lib/api/cover-letters')

      const { GET } = await import('./route')
      const res = (await GET(new Request('http://localhost/x') as never, ctx)) as Response
      expect(res.status).toBe(404)
      expect(getResume).toHaveBeenCalledWith('user-1', 'cv-1')
      expect(listCoverLetters).not.toHaveBeenCalled()
    })

    it('returns the letters, the prefill notes and the suggested posting', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV' } as never)
      const api = await import('@/lib/api/cover-letters')
      const letter = { id: 'l1', company: 'Globex', role: 'Frontend Engineer', status: 'ready', content: 'Hello' }
      vi.mocked(api.listCoverLetters).mockResolvedValueOnce([letter] as never)
      vi.mocked(api.latestNotes).mockResolvedValueOnce({ explain: 'Career change' })
      const posting = { company: 'Globex', role: 'Frontend Engineer', jobText: 'Cleaned text', scrapedJobId: 'job-1' }
      vi.mocked(api.suggestedPostingFor).mockResolvedValueOnce(posting)

      const { GET } = await import('./route')
      const res = (await GET(new Request('http://localhost/x') as never, ctx)) as Response
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual({ letters: [letter], notes: { explain: 'Career change' }, suggestedPosting: posting })
      expect(JSON.stringify(json.letters)).not.toContain('jobText')
      expect(api.listCoverLetters).toHaveBeenCalledWith('user-1', 'cv-1')
      expect(api.suggestedPostingFor).toHaveBeenCalledWith('user-1', 'cv-1')
    })

    it('returns a null suggestedPosting for a CV that was not drafted from a job', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV' } as never)
      const api = await import('@/lib/api/cover-letters')
      vi.mocked(api.listCoverLetters).mockResolvedValueOnce([])
      vi.mocked(api.latestNotes).mockResolvedValueOnce({})
      vi.mocked(api.suggestedPostingFor).mockResolvedValueOnce(null)

      const { GET } = await import('./route')
      const res = (await GET(new Request('http://localhost/x') as never, ctx)) as Response
      expect(await res.json()).toEqual({ letters: [], notes: {}, suggestedPosting: null })
    })

    it('never creates a letter or calls the writer', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV' } as never)
      const api = await import('@/lib/api/cover-letters')
      vi.mocked(api.listCoverLetters).mockResolvedValueOnce([])
      vi.mocked(api.latestNotes).mockResolvedValueOnce({})
      vi.mocked(api.suggestedPostingFor).mockResolvedValueOnce(null)
      const { enqueueCoverLetter } = await import('@/lib/ai/cover-letter/queue')
      const { checkAiRateLimit } = await import('@/lib/rate-limit')

      const { GET } = await import('./route')
      await GET(new Request('http://localhost/x') as never, ctx)
      expect(api.createCoverLetter).not.toHaveBeenCalled()
      expect(enqueueCoverLetter).not.toHaveBeenCalled()
      expect(checkAiRateLimit).not.toHaveBeenCalled()
    })
  })

  describe('POST', () => {
    it('exports a maxDuration that covers the after() job', async () => {
      const mod = await import('./route')
      expect(mod.maxDuration).toBe(60)
    })

    it('returns 401 when not authenticated', async () => {
      const { POST } = await import('./route')
      const res = (await POST(post(VALID_BODY) as never, ctx)) as Response
      expect(res.status).toBe(401)
    })

    it('returns 404 when the CV is not the users', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce(null as never)
      const { checkAiRateLimit } = await import('@/lib/rate-limit')

      const { POST } = await import('./route')
      const res = (await POST(post(VALID_BODY) as never, ctx)) as Response
      expect(res.status).toBe(404)
      expect(checkAiRateLimit).not.toHaveBeenCalled()
    })

    it('returns 400 with the Zod issues for an invalid body, without spending the AI allowance', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV' } as never)
      const { checkAiRateLimit } = await import('@/lib/rate-limit')
      const api = await import('@/lib/api/cover-letters')

      const { POST } = await import('./route')
      const res = (await POST(post({ company: 'Globex', role: '', jobText: 'x' }) as never, ctx)) as Response
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json).toMatchObject({ code: 'VALIDATION_ERROR' })
      expect(Array.isArray(json.details)).toBe(true)
      expect(json.details[0]).toMatchObject({ path: ['role'] })
      expect(checkAiRateLimit).not.toHaveBeenCalled()
      expect(api.createCoverLetter).not.toHaveBeenCalled()
    })

    it('returns 400 for a body that is not JSON', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV' } as never)

      const { POST } = await import('./route')
      const res = (await POST(post('{not json') as never, ctx)) as Response
      expect(res.status).toBe(400)
    })

    it('returns 429 with Retry-After when the AI limit is reached, and creates and enqueues nothing', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV' } as never)
      const { checkAiRateLimit } = await import('@/lib/rate-limit')
      vi.mocked(checkAiRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 42, scope: 'minute' })
      const api = await import('@/lib/api/cover-letters')
      const { enqueueCoverLetter } = await import('@/lib/ai/cover-letter/queue')

      const { POST } = await import('./route')
      const res = (await POST(post(VALID_BODY) as never, ctx)) as Response
      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBe('42')
      expect(await res.json()).toMatchObject({ code: 'RATE_LIMITED' })
      expect(api.createCoverLetter).not.toHaveBeenCalled()
      expect(enqueueCoverLetter).not.toHaveBeenCalled()
    })

    it('creates a writing letter, enqueues it once and answers 202', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV' } as never)
      const api = await import('@/lib/api/cover-letters')
      const letter = { id: 'l1', company: 'Globex', role: 'Frontend Engineer', status: 'writing' }
      vi.mocked(api.createCoverLetter).mockResolvedValueOnce(letter as never)
      const { enqueueCoverLetter } = await import('@/lib/ai/cover-letter/queue')
      const { checkAiRateLimit } = await import('@/lib/rate-limit')

      const { POST } = await import('./route')
      const res = (await POST(post(VALID_BODY) as never, ctx)) as Response
      expect(res.status).toBe(202)
      expect(await res.json()).toEqual({ letter })
      expect(checkAiRateLimit).toHaveBeenCalledTimes(1)
      expect(api.createCoverLetter).toHaveBeenCalledWith('user-1', 'cv-1', VALID_BODY)
      expect(enqueueCoverLetter).toHaveBeenCalledTimes(1)
      expect(enqueueCoverLetter).toHaveBeenCalledWith('user-1', 'l1', { startedAt: expect.any(Number) })
    })

    it('answers 500 when enqueueing throws after the letter was created', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV' } as never)
      const api = await import('@/lib/api/cover-letters')
      vi.mocked(api.createCoverLetter).mockResolvedValueOnce({ id: 'l1', status: 'writing' } as never)
      const { enqueueCoverLetter } = await import('@/lib/ai/cover-letter/queue')
      vi.mocked(enqueueCoverLetter).mockRejectedValueOnce(new Error('qstash down'))
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const { POST } = await import('./route')
      const res = (await POST(post(VALID_BODY) as never, ctx)) as Response
      expect(res.status).toBe(500)
      // Failed at once, not left "writing" for the stale rule to find 90 s later.
      expect(api.failWritingLetter).toHaveBeenCalledWith('user-1', 'cv-1', 'l1', 'Could not start this letter. Please try again.')
    })

    it('still answers 500 when marking the letter failed throws too', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV' } as never)
      const api = await import('@/lib/api/cover-letters')
      vi.mocked(api.createCoverLetter).mockResolvedValueOnce({ id: 'l1', status: 'writing' } as never)
      vi.mocked(api.failWritingLetter).mockRejectedValueOnce(new Error('db down'))
      const { enqueueCoverLetter } = await import('@/lib/ai/cover-letter/queue')
      vi.mocked(enqueueCoverLetter).mockRejectedValueOnce(new Error('qstash down'))
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const { POST } = await import('./route')
      const res = (await POST(post(VALID_BODY) as never, ctx)) as Response
      expect(res.status).toBe(500)
    })
  })
})
