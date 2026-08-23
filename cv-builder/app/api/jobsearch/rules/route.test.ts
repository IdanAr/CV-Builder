import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/jobsearch-rules', () => ({
  listRulesForProfile: vi.fn(),
  createJobSearchRule: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'u1' } }
})

describe('GET /api/jobsearch/rules', () => {
  it('returns rules for the given profileId', async () => {
    const { listRulesForProfile } = await import('@/lib/api/jobsearch-rules')
    vi.mocked(listRulesForProfile).mockResolvedValueOnce([{ _id: 'r1', name: 'High fit' }] as never)

    const { GET } = await import('./route')
    const res = (await GET(new Request('http://test/api/jobsearch/rules?profileId=p1') as never, undefined as never)) as Response
    const body = await res.json()
    expect(listRulesForProfile).toHaveBeenCalledWith('u1', 'p1')
    expect(body.rules).toEqual([{ _id: 'r1', name: 'High fit' }])
  })

  it('rejects a request with no profileId', async () => {
    const { GET } = await import('./route')
    const res = (await GET(new Request('http://test/api/jobsearch/rules') as never, undefined as never)) as Response
    expect(res.status).toBe(400)
  })
})

describe('POST /api/jobsearch/rules', () => {
  it('creates a rule from a valid body', async () => {
    const { createJobSearchRule } = await import('@/lib/api/jobsearch-rules')
    vi.mocked(createJobSearchRule).mockResolvedValueOnce({ _id: 'r1', name: 'High fit', userId: 'u1' } as never)

    const { POST } = await import('./route')
    const req = new Request('http://test/api/jobsearch/rules', {
      method: 'POST',
      body: JSON.stringify({
        profileId: 'p1',
        name: 'High fit',
        conditions: [{ field: 'atsScore', op: 'gte', value: 75 }],
        action: 'notify',
      }),
    })
    const res = (await POST(req as never, undefined as never)) as Response
    expect(res.status).toBe(201)
    expect(createJobSearchRule).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'High fit' }))
  })

  it('rejects an invalid body with 400', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://test/api/jobsearch/rules', {
      method: 'POST',
      body: JSON.stringify({ name: '', conditions: [], action: 'notify' }),
    })
    const res = (await POST(req as never, undefined as never)) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when the service layer rejects an unowned profileId', async () => {
    const { createJobSearchRule } = await import('@/lib/api/jobsearch-rules')
    vi.mocked(createJobSearchRule).mockResolvedValueOnce(null)

    const { POST } = await import('./route')
    const req = new Request('http://test/api/jobsearch/rules', {
      method: 'POST',
      body: JSON.stringify({
        profileId: 'not-mine',
        name: 'High fit',
        conditions: [{ field: 'atsScore', op: 'gte', value: 75 }],
        action: 'notify',
      }),
    })
    const res = (await POST(req as never, undefined as never)) as Response
    expect(res.status).toBe(404)
  })
})
