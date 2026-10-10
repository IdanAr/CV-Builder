import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: null }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(),
}))

vi.mock('@/lib/job-url/safe-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/job-url/safe-fetch')>()
  return { ...actual, fetchPublicPage: vi.fn() }
})

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })) }
})

const longDescription = '<p>' + 'Build and own reliable data pipelines for the analytics team. '.repeat(8) + '</p>'

async function signedIn() {
  const { auth } = await import('@/lib/auth')
  vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }) as never, ctx as never)
  })
}

async function post(body: unknown) {
  const { POST } = await import('./route')
  const req = new Request('http://localhost/api/resumes/abc/job-description', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never)) as Response
}

describe('POST /api/resumes/[id]/job-description', () => {
  beforeEach(async () => {
    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValue({ title: 'CV', data: {}, meta: {} } as never)
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated, without fetching anything', async () => {
    const res = await post({ url: 'https://example.com/job' })
    expect(res.status).toBe(401)
    const { fetchPublicPage } = await import('@/lib/job-url/safe-fetch')
    expect(fetchPublicPage).not.toHaveBeenCalled()
  })

  it("returns 404 for a résumé the user doesn't own", async () => {
    await signedIn()
    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValueOnce(null as never)
    const res = await post({ url: 'https://example.com/job' })
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    await signedIn()
    const { checkRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, retryAfterSeconds: 12 })
    const res = await post({ url: 'https://example.com/job' })
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('12')
  })

  it('returns 400 without a url', async () => {
    await signedIn()
    expect((await post({})).status).toBe(400)
  })

  it('passes the fetcher\'s refusal through with its message (private address)', async () => {
    await signedIn()
    const { fetchPublicPage, JobUrlError } = await import('@/lib/job-url/safe-fetch')
    vi.mocked(fetchPublicPage).mockRejectedValueOnce(new JobUrlError('That address is not a public website.', 400))
    const res = await post({ url: 'http://10.0.0.1/' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('That address is not a public website.')
  })

  it('returns 422 when the page holds no real job description', async () => {
    await signedIn()
    const { fetchPublicPage } = await import('@/lib/job-url/safe-fetch')
    vi.mocked(fetchPublicPage).mockResolvedValueOnce({ finalUrl: 'https://www.linkedin.com/jobs/1', html: '<body>Sign in to continue</body>' })
    const res = await post({ url: 'https://www.linkedin.com/jobs/1' })
    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/paste the text instead/i)
  })

  it('returns the extracted job with the final host', async () => {
    await signedIn()
    const { fetchPublicPage } = await import('@/lib/job-url/safe-fetch')
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'JobPosting', title: 'Data Engineer', hiringOrganization: { name: 'Acme' }, description: longDescription,
    })}</script>`
    vi.mocked(fetchPublicPage).mockResolvedValueOnce({ finalUrl: 'https://www.boards.greenhouse.io/acme/1', html })
    const res = await post({ url: 'https://boards.greenhouse.io/acme/1' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ title: 'Data Engineer', company: 'Acme', source: 'structured', host: 'boards.greenhouse.io' })
    expect(json.text).toContain('Build and own reliable data pipelines')
  })
})
