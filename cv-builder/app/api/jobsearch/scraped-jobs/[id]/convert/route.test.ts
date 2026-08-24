import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/scraped-jobs', () => ({
  convertScrapedJobToApplication: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'u1' } }
})

describe('POST /api/jobsearch/scraped-jobs/[id]/convert', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession = null
    const { POST } = await import('./route')
    const res = (await POST(
      new Request('http://test/api/jobsearch/scraped-jobs/j1/convert', { method: 'POST' }) as never,
      { params: Promise.resolve({ id: 'j1' }) } as never
    )) as Response
    expect(res.status).toBe(401)
  })

  it('returns 201 with the application on success', async () => {
    const { convertScrapedJobToApplication } = await import('@/lib/api/scraped-jobs')
    vi.mocked(convertScrapedJobToApplication).mockResolvedValueOnce({
      ok: true,
      application: { _id: 'app1' },
    } as never)

    const { POST } = await import('./route')
    const res = (await POST(
      new Request('http://test/api/jobsearch/scraped-jobs/j1/convert', { method: 'POST' }) as never,
      { params: Promise.resolve({ id: 'j1' }) } as never
    )) as Response

    expect(res.status).toBe(201)
    expect((await res.json()).application).toEqual({ _id: 'app1' })
    expect(convertScrapedJobToApplication).toHaveBeenCalledWith('u1', 'j1')
  })

  it('returns 404 when the job is not found', async () => {
    const { convertScrapedJobToApplication } = await import('@/lib/api/scraped-jobs')
    vi.mocked(convertScrapedJobToApplication).mockResolvedValueOnce({
      ok: false, code: 'NOT_FOUND', message: 'Not found',
    } as never)

    const { POST } = await import('./route')
    const res = (await POST(
      new Request('http://test/api/jobsearch/scraped-jobs/missing/convert', { method: 'POST' }) as never,
      { params: Promise.resolve({ id: 'missing' }) } as never
    )) as Response

    expect(res.status).toBe(404)
  })

  it('returns 400 when pending approvals remain unresolved', async () => {
    const { convertScrapedJobToApplication } = await import('@/lib/api/scraped-jobs')
    vi.mocked(convertScrapedJobToApplication).mockResolvedValueOnce({
      ok: false, code: 'PENDING_APPROVALS', message: 'Resolve the flagged claims on this draft before marking it applied.',
    } as never)

    const { POST } = await import('./route')
    const res = (await POST(
      new Request('http://test/api/jobsearch/scraped-jobs/j1/convert', { method: 'POST' }) as never,
      { params: Promise.resolve({ id: 'j1' }) } as never
    )) as Response

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('PENDING_APPROVALS')
  })
})
