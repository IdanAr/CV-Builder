import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }

vi.mock('@/lib/auth', () => ({
  auth: (handler: (req: unknown) => unknown) => (req: unknown) =>
    handler(Object.assign(req as object, { auth: mockSession })),
}))

const { mockListNotifyMatches } = vi.hoisted(() => ({ mockListNotifyMatches: vi.fn() }))
vi.mock('@/lib/api/scraped-jobs', () => ({ listNotifyMatches: mockListNotifyMatches }))

import { GET } from './route'

afterEach(() => {
  vi.clearAllMocks()
  mockSession = { user: { id: 'u1' } }
})

describe('GET /api/jobsearch/notifications', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession = null
    const res = (await GET(new Request('http://test/api/jobsearch/notifications') as never)) as Response
    expect(res.status).toBe(401)
  })

  it('returns this user\'s notify matches', async () => {
    mockListNotifyMatches.mockResolvedValue([{ _id: 'j1', title: 'X' }])
    const res = (await GET(new Request('http://test/api/jobsearch/notifications') as never)) as Response
    const body = await res.json()
    expect(mockListNotifyMatches).toHaveBeenCalledWith('u1')
    expect(body.matches).toEqual([{ _id: 'j1', title: 'X' }])
  })
})
