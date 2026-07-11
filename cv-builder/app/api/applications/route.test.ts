import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/applications', () => ({
  listApplications: vi.fn(),
  createApplication: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'user-1' } }
})

describe('GET /api/applications', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { GET } = await import('./route')
    const res = (await GET(new Request('http://localhost/api/applications') as never, {} as never)) as Response
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('UNAUTHORIZED')
  })
})

describe('POST /api/applications', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/applications', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = (await POST(req as never, {} as never)) as Response
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('UNAUTHORIZED')
  })
})
