import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockResolve, mockCheckRateLimit } = vi.hoisted(() => ({
  mockResolve: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}))

vi.mock('@/lib/jobsearch/sources/comeet-resolve', () => ({ resolveComeetCompanyFromUrl: mockResolve }))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  COMEET_RESOLVE_RATE_LIMIT: { limit: 10, windowMs: 60_000 },
}))

vi.mock('@/lib/auth', () => ({
  auth: (handler: (req: unknown) => unknown) => (req: unknown) =>
    handler(Object.assign(req as object, { auth: { user: { id: 'u1' } } })),
}))

import { POST } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
})

describe('POST /api/jobsearch/comeet/resolve', () => {
  it('resolves a valid careers page URL and returns the company', async () => {
    mockResolve.mockResolvedValue({ ok: true, company: { name: 'DealHub', uid: '86.005', token: 'tok_1' } })
    const req = new Request('http://test/api/jobsearch/comeet/resolve', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.comeet.com/jobs/dealhub/86.005' }),
    })

    const res = (await POST(req as never, undefined as never)) as Response
    const body = await res.json()

    expect(mockResolve).toHaveBeenCalledWith('https://www.comeet.com/jobs/dealhub/86.005')
    expect(body.company).toEqual({ name: 'DealHub', uid: '86.005', token: 'tok_1' })
  })

  it('rejects a missing url with 400', async () => {
    const req = new Request('http://test/api/jobsearch/comeet/resolve', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const res = (await POST(req as never, undefined as never)) as Response

    expect(res.status).toBe(400)
    expect(mockResolve).not.toHaveBeenCalled()
  })

  it('returns 422 with the resolver error when resolution fails', async () => {
    mockResolve.mockResolvedValue({ ok: false, error: 'Could not find company data on that page.' })
    const req = new Request('http://test/api/jobsearch/comeet/resolve', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.comeet.com/jobs/nope/1' }),
    })

    const res = (await POST(req as never, undefined as never)) as Response
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toBe('Could not find company data on that page.')
  })

  it('returns 429 without resolving when rate-limited', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 42 })
    const req = new Request('http://test/api/jobsearch/comeet/resolve', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.comeet.com/jobs/x/1' }),
    })

    const res = (await POST(req as never, undefined as never)) as Response

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    expect(mockResolve).not.toHaveBeenCalled()
  })
})
