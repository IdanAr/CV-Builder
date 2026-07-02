import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(),
  patchResume: vi.fn(),
  deleteResume: vi.fn(),
}))

describe('GET /api/resumes/[id]', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('returns 404 (not 500) when the id is a malformed ObjectId', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getResume } = await import('@/lib/api/resumes')
    const castError = Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' })
    vi.mocked(getResume).mockRejectedValueOnce(castError)

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/resumes/not-an-objectid')
    const res = await GET(req as never, { params: Promise.resolve({ id: 'not-an-objectid' }) } as never) as Response
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found', code: 'NOT_FOUND' })
  })

  it('logs and returns 500 for unexpected errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockRejectedValueOnce(new Error('db down'))

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc')
    const res = await GET(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(500)
    expect(spy).toHaveBeenCalled()
  })
})
