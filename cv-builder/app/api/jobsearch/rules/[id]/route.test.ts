import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/jobsearch-rules', () => ({
  getJobSearchRule: vi.fn(),
  updateJobSearchRule: vi.fn(),
  deleteJobSearchRule: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'u1' } }
})

describe('GET /api/jobsearch/rules/[id]', () => {
  it('returns the rule when found', async () => {
    const { getJobSearchRule } = await import('@/lib/api/jobsearch-rules')
    vi.mocked(getJobSearchRule).mockResolvedValueOnce({ _id: 'r1', name: 'High fit' } as never)

    const { GET } = await import('./route')
    const res = (await GET(
      new Request('http://test/api/jobsearch/rules/r1') as never,
      { params: Promise.resolve({ id: 'r1' }) } as never
    )) as Response
    expect((await res.json()).rule).toEqual({ _id: 'r1', name: 'High fit' })
  })

  it('returns 404 when not found', async () => {
    const { getJobSearchRule } = await import('@/lib/api/jobsearch-rules')
    vi.mocked(getJobSearchRule).mockResolvedValueOnce(null)

    const { GET } = await import('./route')
    const res = (await GET(
      new Request('http://test/api/jobsearch/rules/r1') as never,
      { params: Promise.resolve({ id: 'r1' }) } as never
    )) as Response
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/jobsearch/rules/[id]', () => {
  it('applies a valid patch', async () => {
    const { updateJobSearchRule } = await import('@/lib/api/jobsearch-rules')
    vi.mocked(updateJobSearchRule).mockResolvedValueOnce({ _id: 'r1', isActive: false } as never)

    const { PATCH } = await import('./route')
    const req = new Request('http://test/api/jobsearch/rules/r1', { method: 'PATCH', body: JSON.stringify({ isActive: false }) })
    const res = (await PATCH(
      req as never,
      { params: Promise.resolve({ id: 'r1' }) } as never
    )) as Response
    expect(res.status).toBe(200)
    expect(updateJobSearchRule).toHaveBeenCalledWith('u1', 'r1', { isActive: false })
  })

  it('rejects an invalid patch with 400', async () => {
    const { PATCH } = await import('./route')
    const req = new Request('http://test/api/jobsearch/rules/r1', { method: 'PATCH', body: JSON.stringify({ conditions: [] }) })
    const res = (await PATCH(
      req as never,
      { params: Promise.resolve({ id: 'r1' }) } as never
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when the rule does not exist', async () => {
    const { updateJobSearchRule } = await import('@/lib/api/jobsearch-rules')
    vi.mocked(updateJobSearchRule).mockResolvedValueOnce(null)

    const { PATCH } = await import('./route')
    const req = new Request('http://test/api/jobsearch/rules/r1', { method: 'PATCH', body: JSON.stringify({ isActive: false }) })
    const res = (await PATCH(
      req as never,
      { params: Promise.resolve({ id: 'r1' }) } as never
    )) as Response
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/jobsearch/rules/[id]', () => {
  it('deletes and returns ok', async () => {
    const { deleteJobSearchRule } = await import('@/lib/api/jobsearch-rules')
    vi.mocked(deleteJobSearchRule).mockResolvedValueOnce(true)

    const { DELETE } = await import('./route')
    const res = (await DELETE(
      new Request('http://test/api/jobsearch/rules/r1', { method: 'DELETE' }) as never,
      { params: Promise.resolve({ id: 'r1' }) } as never
    )) as Response
    expect(res.status).toBe(200)
  })

  it('returns 404 when nothing was deleted', async () => {
    const { deleteJobSearchRule } = await import('@/lib/api/jobsearch-rules')
    vi.mocked(deleteJobSearchRule).mockResolvedValueOnce(false)

    const { DELETE } = await import('./route')
    const res = (await DELETE(
      new Request('http://test/api/jobsearch/rules/r1', { method: 'DELETE' }) as never,
      { params: Promise.resolve({ id: 'r1' }) } as never
    )) as Response
    expect(res.status).toBe(404)
  })
})
