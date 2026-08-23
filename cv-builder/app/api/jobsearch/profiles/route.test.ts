import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockList, mockCreate } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
}))

vi.mock('@/lib/api/jobsearch-profiles', () => ({
  listJobSearchProfiles: mockList,
  createJobSearchProfile: mockCreate,
}))

vi.mock('@/lib/auth', () => ({
  auth: (handler: (req: unknown) => unknown) => (req: unknown) =>
    handler(Object.assign(req as object, { auth: { user: { id: 'u1' } } })),
}))

import { GET, POST } from './route'

beforeEach(() => vi.clearAllMocks())

describe('GET /api/jobsearch/profiles', () => {
  it("returns the requesting user's profiles", async () => {
    mockList.mockResolvedValue([{ _id: 'p1', name: 'Frontend' }])
    const res = (await GET(new Request('http://test/api/jobsearch/profiles') as never, undefined as never)) as Response
    const body = await res.json()
    expect(mockList).toHaveBeenCalledWith('u1')
    expect(body.profiles).toEqual([{ _id: 'p1', name: 'Frontend' }])
  })
})

describe('POST /api/jobsearch/profiles', () => {
  it('creates a profile from a valid body', async () => {
    mockCreate.mockResolvedValue({ _id: 'p1', name: 'Frontend', userId: 'u1' })
    const req = new Request('http://test/api/jobsearch/profiles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Frontend' }),
    })
    const res = (await POST(req as never, undefined as never)) as Response
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Frontend' }))
  })

  it('rejects an invalid body with 400', async () => {
    const req = new Request('http://test/api/jobsearch/profiles', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    })
    const res = (await POST(req as never, undefined as never)) as Response
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
