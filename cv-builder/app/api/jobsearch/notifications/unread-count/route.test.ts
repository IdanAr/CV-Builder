import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }

vi.mock('@/lib/auth', () => ({
  auth: (handler: (req: unknown) => unknown) => (req: unknown) =>
    handler(Object.assign(req as object, { auth: mockSession })),
}))

const { mockCountUnread, mockCountStages } = vi.hoisted(() => ({
  mockCountUnread: vi.fn(),
  mockCountStages: vi.fn(),
}))
vi.mock('@/lib/api/scraped-jobs', () => ({
  countUnreadNotifyMatches: mockCountUnread,
  countPipelineStages: mockCountStages,
}))

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
    mockCountStages.mockResolvedValue({ found: 0, matched: 5, drafted: 1, ready: 2, applied: 0, waiting: 8 })
    const req = new Request('http://test/api/jobsearch/notifications/unread-count', {
      method: 'GET',
    })
    const res = (await GET(req as never, undefined as never)) as Response
    const body = await res.json()
    expect(mockCountUnread).toHaveBeenCalledWith('u1')
    expect(body).toEqual({ count: 5, waiting: 8 })
    expect(mockCountStages).toHaveBeenCalledWith('u1')
  })
})
