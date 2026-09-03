import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string; name?: string; email?: string } } | null = {
  user: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
}

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

const exportUserData = vi.fn(async () => ({ exportedAt: '2026-09-03T00:00:00.000Z', resumes: [] }))
vi.mock('@/lib/api/account', () => ({ exportUserData: (...a: unknown[]) => exportUserData(...(a as [])) }))

afterEach(() => {
  vi.clearAllMocks()
  mockSession = { user: { id: 'user-1', name: 'Ada', email: 'ada@example.com' } }
})

const req = () => new Request('http://localhost/api/account/export')

describe('GET /api/account/export', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { GET } = await import('./route')
    const res = (await GET(req() as never, {} as never)) as Response
    expect(res.status).toBe(401)
    expect(exportUserData).not.toHaveBeenCalled()
  })

  it('exports only the requesting user', async () => {
    const { GET } = await import('./route')
    await GET(req() as never, {} as never)
    expect(exportUserData).toHaveBeenCalledWith('user-1', { name: 'Ada', email: 'ada@example.com' })
  })

  it('is served as a download, not painted into a tab', async () => {
    const { GET } = await import('./route')
    const res = (await GET(req() as never, {} as never)) as Response
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="cv-builder-export-\d{4}-\d{2}-\d{2}\.json"$/)
    expect(res.headers.get('Content-Type')).toBe('application/json')
  })

  // This is the whole of someone's résumé and application history. It has no
  // business sitting in a shared proxy or in the browser's disk cache after
  // they sign out.
  it('is never cached', async () => {
    const { GET } = await import('./route')
    const res = (await GET(req() as never, {} as never)) as Response
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})
