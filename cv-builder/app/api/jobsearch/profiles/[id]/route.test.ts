import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/jobsearch-profiles', () => ({
  getJobSearchProfile: vi.fn(),
  updateJobSearchProfile: vi.fn(),
  deleteJobSearchProfile: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'u1' } }
})

describe('GET /api/jobsearch/profiles/[id]', () => {
  it('returns the profile scoped to the requesting user', async () => {
    const { getJobSearchProfile } = await import('@/lib/api/jobsearch-profiles')
    vi.mocked(getJobSearchProfile).mockResolvedValueOnce({ _id: 'p1', name: 'Frontend' } as never)

    const { GET } = await import('./route')
    const res = (await GET(new Request('http://test/api/jobsearch/profiles/p1') as never, {
      params: Promise.resolve({ id: 'p1' }),
    } as never)) as Response
    const body = await res.json()
    expect(getJobSearchProfile).toHaveBeenCalledWith('u1', 'p1')
    expect(body.profile).toEqual({ _id: 'p1', name: 'Frontend' })
  })

  it('returns 404 when the profile is not found', async () => {
    const { getJobSearchProfile } = await import('@/lib/api/jobsearch-profiles')
    vi.mocked(getJobSearchProfile).mockResolvedValueOnce(null)

    const { GET } = await import('./route')
    const res = (await GET(new Request('http://test/api/jobsearch/profiles/p1') as never, {
      params: Promise.resolve({ id: 'p1' }),
    } as never)) as Response
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/jobsearch/profiles/[id]', () => {
  it('applies a valid partial update', async () => {
    const { updateJobSearchProfile } = await import('@/lib/api/jobsearch-profiles')
    vi.mocked(updateJobSearchProfile).mockResolvedValueOnce({ _id: 'p1', minAtsScore: 80 } as never)

    const { PATCH } = await import('./route')
    const req = new Request('http://test/api/jobsearch/profiles/p1', {
      method: 'PATCH',
      body: JSON.stringify({ minAtsScore: 80 }),
    })
    const res = (await PATCH(req as never, {
      params: Promise.resolve({ id: 'p1' }),
    } as never)) as Response
    expect(res.status).toBe(200)
    expect(updateJobSearchProfile).toHaveBeenCalledWith('u1', 'p1', expect.objectContaining({ minAtsScore: 80 }))
  })

  it('rejects an invalid body with 400', async () => {
    const { updateJobSearchProfile } = await import('@/lib/api/jobsearch-profiles')

    const { PATCH } = await import('./route')
    const req = new Request('http://test/api/jobsearch/profiles/p1', {
      method: 'PATCH',
      body: JSON.stringify({ minAtsScore: 150 }),
    })
    const res = (await PATCH(req as never, {
      params: Promise.resolve({ id: 'p1' }),
    } as never)) as Response
    expect(res.status).toBe(400)
    expect(updateJobSearchProfile).not.toHaveBeenCalled()
  })

  it('returns 404 when nothing matched', async () => {
    const { updateJobSearchProfile } = await import('@/lib/api/jobsearch-profiles')
    vi.mocked(updateJobSearchProfile).mockResolvedValueOnce(null)

    const { PATCH } = await import('./route')
    const req = new Request('http://test/api/jobsearch/profiles/p1', {
      method: 'PATCH',
      body: JSON.stringify({ minAtsScore: 80 }),
    })
    const res = (await PATCH(req as never, {
      params: Promise.resolve({ id: 'p1' }),
    } as never)) as Response
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/jobsearch/profiles/[id]', () => {
  it('returns ok when a profile was deleted', async () => {
    const { deleteJobSearchProfile } = await import('@/lib/api/jobsearch-profiles')
    vi.mocked(deleteJobSearchProfile).mockResolvedValueOnce(true)

    const { DELETE } = await import('./route')
    const res = (await DELETE(new Request('http://test/api/jobsearch/profiles/p1') as never, {
      params: Promise.resolve({ id: 'p1' }),
    } as never)) as Response
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('returns 404 when nothing was deleted', async () => {
    const { deleteJobSearchProfile } = await import('@/lib/api/jobsearch-profiles')
    vi.mocked(deleteJobSearchProfile).mockResolvedValueOnce(false)

    const { DELETE } = await import('./route')
    const res = (await DELETE(new Request('http://test/api/jobsearch/profiles/p1') as never, {
      params: Promise.resolve({ id: 'p1' }),
    } as never)) as Response
    expect(res.status).toBe(404)
  })
})
