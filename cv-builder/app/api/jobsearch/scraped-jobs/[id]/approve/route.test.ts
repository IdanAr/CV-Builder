import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/scraped-jobs', () => ({
  approveScrapedJob: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'u1' } }
})

describe('POST /api/jobsearch/scraped-jobs/[id]/approve', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession = null
    const { POST } = await import('./route')
    const res = (await POST(
      new Request('http://test/api/jobsearch/scraped-jobs/j1/approve', { method: 'POST' }) as never,
      { params: Promise.resolve({ id: 'j1' }) } as never
    )) as Response
    expect(res.status).toBe(401)
  })

  it('returns 200 with the resulting status on success', async () => {
    const { approveScrapedJob } = await import('@/lib/api/scraped-jobs')
    vi.mocked(approveScrapedJob).mockResolvedValueOnce({ ok: true, status: 'queued' } as never)

    const { POST } = await import('./route')
    const res = (await POST(
      new Request('http://test/api/jobsearch/scraped-jobs/j1/approve', { method: 'POST' }) as never,
      { params: Promise.resolve({ id: 'j1' }) } as never
    )) as Response

    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('queued')
    expect(approveScrapedJob).toHaveBeenCalledWith('u1', 'j1')
  })

  it('returns 404 when the job is not found', async () => {
    const { approveScrapedJob } = await import('@/lib/api/scraped-jobs')
    vi.mocked(approveScrapedJob).mockResolvedValueOnce({
      ok: false, code: 'NOT_FOUND', message: 'Not found',
    } as never)

    const { POST } = await import('./route')
    const res = (await POST(
      new Request('http://test/api/jobsearch/scraped-jobs/missing/approve', { method: 'POST' }) as never,
      { params: Promise.resolve({ id: 'missing' }) } as never
    )) as Response

    expect(res.status).toBe(404)
  })

  it('returns 400 when there are no pending approvals to clear', async () => {
    const { approveScrapedJob } = await import('@/lib/api/scraped-jobs')
    vi.mocked(approveScrapedJob).mockResolvedValueOnce({
      ok: false, code: 'NO_PENDING_APPROVALS', message: 'Nothing to approve on this posting.',
    } as never)

    const { POST } = await import('./route')
    const res = (await POST(
      new Request('http://test/api/jobsearch/scraped-jobs/j1/approve', { method: 'POST' }) as never,
      { params: Promise.resolve({ id: 'j1' }) } as never
    )) as Response

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('NO_PENDING_APPROVALS')
  })
})
