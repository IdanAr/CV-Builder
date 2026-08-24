import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } }

vi.mock('@/lib/auth', () => ({
  auth: (handler: (req: unknown) => unknown) => (req: unknown) =>
    handler(Object.assign(req as object, { auth: mockSession })),
}))

const { mockMarkRead } = vi.hoisted(() => ({ mockMarkRead: vi.fn() }))
vi.mock('@/lib/api/scraped-jobs', () => ({ markNotifyMatchesRead: mockMarkRead }))

import { POST } from './route'

afterEach(() => {
  vi.clearAllMocks()
  mockSession = { user: { id: 'u1' } }
})

describe('POST /api/jobsearch/notifications/mark-read', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession = null
    const req = new Request('http://test/api/jobsearch/notifications/mark-read', {
      method: 'POST',
    })
    const res = (await POST(req as never, undefined as never)) as Response
    expect(res.status).toBe(401)
  })

  it('marks this user\'s notify matches as read', async () => {
    mockMarkRead.mockResolvedValue(undefined)
    const req = new Request('http://test/api/jobsearch/notifications/mark-read', {
      method: 'POST',
    })
    const res = (await POST(req as never, undefined as never)) as Response
    const body = await res.json()
    expect(mockMarkRead).toHaveBeenCalledWith('u1')
    expect(body.ok).toBe(true)
  })
})
