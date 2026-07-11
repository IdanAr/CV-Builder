import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/applications', () => ({
  listActivity: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'user-1' } }
})

describe('GET /api/applications/[id]/activity', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/applications/a1/activity')
    const res = (await GET(req as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('UNAUTHORIZED')
  })

  it('returns the activity list when authenticated', async () => {
    const { listActivity } = await import('@/lib/api/applications')
    vi.mocked(listActivity).mockResolvedValueOnce([{ type: 'created' }] as never)

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/applications/a1/activity')
    const res = (await GET(req as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.activity).toEqual([{ type: 'created' }])
  })
})
