import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }), ctx)
  }),
}))

vi.mock('@/lib/api/applications', () => ({
  patchApplication: vi.fn(),
  deleteApplication: vi.fn(),
  listActivity: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('PATCH /api/applications/[id]', () => {
  it('validates the body and returns 400 on a bad patch', async () => {
    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/a1', {
      method: 'PATCH',
      body: JSON.stringify({ customFields: { 'col-1': { nested: true } } }),
    })
    const res = (await PATCH(req as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when the application does not exist', async () => {
    const { patchApplication } = await import('@/lib/api/applications')
    vi.mocked(patchApplication).mockResolvedValueOnce(null)

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/a1', {
      method: 'PATCH',
      body: JSON.stringify({ company: 'Acme' }),
    })
    const res = (await PATCH(req as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response
    expect(res.status).toBe(404)
  })

  it('passes the parsed patch through and returns the updated application', async () => {
    const { patchApplication } = await import('@/lib/api/applications')
    vi.mocked(patchApplication).mockResolvedValueOnce({ _id: 'a1', company: 'Globex' } as never)

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/a1', {
      method: 'PATCH',
      body: JSON.stringify({ company: 'Globex', status: 'offer' }),
    })
    const res = (await PATCH(req as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response

    expect(res.status).toBe(200)
    expect(patchApplication).toHaveBeenCalledWith('user-1', 'a1', {
      company: 'Globex',
      status: 'offer',
    })
  })

  it('returns 404 (not 500) for a malformed ObjectId (CastError)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { patchApplication } = await import('@/lib/api/applications')
    const castError = Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' })
    vi.mocked(patchApplication).mockRejectedValueOnce(castError)

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/nope', {
      method: 'PATCH',
      body: JSON.stringify({ company: 'X' }),
    })
    const res = (await PATCH(req as never, {
      params: Promise.resolve({ id: 'nope' }),
    } as never)) as Response
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/applications/[id]', () => {
  it('returns success when deleted and 404 when missing', async () => {
    const { deleteApplication } = await import('@/lib/api/applications')
    vi.mocked(deleteApplication).mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    const { DELETE } = await import('./route')
    const makeReq = () =>
      new Request('http://localhost/api/applications/a1', { method: 'DELETE' })

    const ok = (await DELETE(makeReq() as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response
    expect(ok.status).toBe(200)

    const missing = (await DELETE(makeReq() as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response
    expect(missing.status).toBe(404)
  })
})
