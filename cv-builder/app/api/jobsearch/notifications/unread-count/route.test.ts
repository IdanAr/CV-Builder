import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }

vi.mock('@/lib/auth', () => ({
  auth: (handler: (req: unknown) => unknown) => (req: unknown) =>
    handler(Object.assign(req as object, { auth: mockSession })),
}))

const { mockCountUnread } = vi.hoisted(() => ({ mockCountUnread: vi.fn() }))
vi.mock('@/lib/api/scraped-jobs', () => ({ countUnreadNotifyMatches: mockCountUnread }))

import { GET } from './route'

afterEach(() => {
  vi.clearAllMocks()
  mockSession = { user: { id: 'u1' } }
})

describe('GET /api/jobsearch/notifications/unread-count', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession = null
    const req = new Request('http://test/api/jobsearch/notifications/unread-count', {
      method: 'GET',
    })
    const res = (await GET(req as never, undefined as never)) as Response
    expect(res.status).toBe(401)
  })

  it('returns this user\'s unread count', async () => {
    mockCountUnread.mockResolvedValue(5)
    const req = new Request('http://test/api/jobsearch/notifications/unread-count', {
      method: 'GET',
    })
    const res = (await GET(req as never, undefined as never)) as Response
    const body = await res.json()
    expect(mockCountUnread).toHaveBeenCalledWith('u1')
    expect(body.count).toBe(5)
  })
})
