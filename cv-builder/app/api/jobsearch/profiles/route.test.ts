import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request) => {
    return handler(Object.assign(req, { auth: mockSession }))
  }),
}))

vi.mock('@/lib/api/jobsearch-profiles', () => ({
  listJobSearchProfiles: vi.fn(),
  createJobSearchProfile: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'u1' } }
})

describe('GET /api/jobsearch/profiles', () => {
  it("returns the requesting user's profiles", async () => {
    const { listJobSearchProfiles } = await import('@/lib/api/jobsearch-profiles')
    vi.mocked(listJobSearchProfiles).mockResolvedValueOnce([{ _id: 'p1', name: 'Frontend' }] as never)

    const { GET } = await import('./route')
    const res = (await GET(new Request('http://test/api/jobsearch/profiles') as never, {} as never)) as Response
    const body = await res.json()
    expect(listJobSearchProfiles).toHaveBeenCalledWith('u1')
    expect(body.profiles).toEqual([{ _id: 'p1', name: 'Frontend' }])
  })
})

describe('POST /api/jobsearch/profiles', () => {
  it('creates a profile from a valid body', async () => {
    const { createJobSearchProfile } = await import('@/lib/api/jobsearch-profiles')
    vi.mocked(createJobSearchProfile).mockResolvedValueOnce({ _id: 'p1', name: 'Frontend', userId: 'u1' } as never)

    const { POST } = await import('./route')
    const req = new Request('http://test/api/jobsearch/profiles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Frontend' }),
    })
    const res = (await POST(req as never, {} as never)) as Response
    expect(res.status).toBe(201)
    expect(createJobSearchProfile).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Frontend' }))
  })

  it('rejects an invalid body with 400', async () => {
    const { createJobSearchProfile } = await import('@/lib/api/jobsearch-profiles')

    const { POST } = await import('./route')
    const req = new Request('http://test/api/jobsearch/profiles', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    })
    const res = (await POST(req as never, {} as never)) as Response
    expect(res.status).toBe(400)
    expect(createJobSearchProfile).not.toHaveBeenCalled()
  })
})
