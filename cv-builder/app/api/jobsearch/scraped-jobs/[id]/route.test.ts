import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/scraped-jobs', () => ({
  setScrapedJobDismissed: vi.fn(),
  deleteScrapedJob: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'u1' } }
})

function req(body: unknown, method = 'PATCH') {
  return new Request('http://test/api/jobsearch/scraped-jobs/j1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never
}

describe('PATCH /api/jobsearch/scraped-jobs/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession = null
    const { PATCH } = await import('./route')
    const res = (await PATCH(req({ dismissed: true }), { params: Promise.resolve({ id: 'j1' }) } as never)) as Response
    expect(res.status).toBe(401)
  })

  it('returns 400 when dismissed is missing or not a boolean', async () => {
    const { PATCH } = await import('./route')
    const res = (await PATCH(req({}), { params: Promise.resolve({ id: 'j1' }) } as never)) as Response
    expect(res.status).toBe(400)
  })

  it('sets dismissed and returns ok on success', async () => {
    const { setScrapedJobDismissed } = await import('@/lib/api/scraped-jobs')
    vi.mocked(setScrapedJobDismissed).mockResolvedValueOnce(true)

    const { PATCH } = await import('./route')
    const res = (await PATCH(req({ dismissed: true }), { params: Promise.resolve({ id: 'j1' }) } as never)) as Response

    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(setScrapedJobDismissed).toHaveBeenCalledWith('u1', 'j1', true)
  })

  it('returns 404 when the job cannot be toggled (not found or terminal state)', async () => {
    const { setScrapedJobDismissed } = await import('@/lib/api/scraped-jobs')
    vi.mocked(setScrapedJobDismissed).mockResolvedValueOnce(false)

    const { PATCH } = await import('./route')
    const res = (await PATCH(req({ dismissed: false }), { params: Promise.resolve({ id: 'j1' }) } as never)) as Response

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/jobsearch/scraped-jobs/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession = null
    const { DELETE } = await import('./route')
    const res = (await DELETE(req(undefined, 'DELETE'), { params: Promise.resolve({ id: 'j1' }) } as never)) as Response
    expect(res.status).toBe(401)
  })

  it('deletes and returns ok on success', async () => {
    const { deleteScrapedJob } = await import('@/lib/api/scraped-jobs')
    vi.mocked(deleteScrapedJob).mockResolvedValueOnce(true)

    const { DELETE } = await import('./route')
    const res = (await DELETE(req(undefined, 'DELETE'), { params: Promise.resolve({ id: 'j1' }) } as never)) as Response

    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(deleteScrapedJob).toHaveBeenCalledWith('u1', 'j1')
  })

  it('returns 404 when nothing was deleted', async () => {
    const { deleteScrapedJob } = await import('@/lib/api/scraped-jobs')
    vi.mocked(deleteScrapedJob).mockResolvedValueOnce(false)

    const { DELETE } = await import('./route')
    const res = (await DELETE(req(undefined, 'DELETE'), { params: Promise.resolve({ id: 'missing' }) } as never)) as Response

    expect(res.status).toBe(404)
  })
})
