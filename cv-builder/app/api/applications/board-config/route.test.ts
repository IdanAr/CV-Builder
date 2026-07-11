import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

const { mockFindOne, mockCreate, mockFindOneAndUpdate } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockCreate: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/models/BoardConfig', () => ({
  default: {
    findOne: mockFindOne,
    create: mockCreate,
    findOneAndUpdate: mockFindOneAndUpdate,
  },
}))

import { defaultBoardColumns } from '@/lib/schemas/application.zod'

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'user-1' } }
})

describe('GET /api/applications/board-config', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { GET } = await import('./route')
    const res = (await GET(
      new Request('http://localhost/api/applications/board-config') as never,
      {} as never
    )) as Response
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('UNAUTHORIZED')
  })

  it('auto-creates and returns the default config on first call', async () => {
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const created = { userId: 'user-1', columns: defaultBoardColumns(), sort: [] }
    mockCreate.mockResolvedValue({ toObject: () => created })

    const { GET } = await import('./route')
    const res = (await GET(
      new Request('http://localhost/api/applications/board-config') as never,
      {} as never
    )) as Response

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.boardConfig.columns.map((c: { key: string }) => c.key)).toEqual([
      'company',
      'role',
      'status',
      'resumeId',
      'createdAt',
    ])
  })
})

describe('PATCH /api/applications/board-config', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/board-config', {
      method: 'PATCH',
      body: JSON.stringify({ sort: [] }),
    })
    const res = (await PATCH(req as never, {} as never)) as Response
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('UNAUTHORIZED')
  })

  it('returns 400 with the invariant message when a built-in column is deleted', async () => {
    const { PATCH } = await import('./route')
    const columns = defaultBoardColumns().filter((c) => c.id !== 'company')
    const req = new Request('http://localhost/api/applications/board-config', {
      method: 'PATCH',
      body: JSON.stringify({ columns }),
    })

    const res = (await PATCH(req as never, {} as never)) as Response

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/built-in/i)
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 on a shape-invalid body', async () => {
    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/board-config', {
      method: 'PATCH',
      body: JSON.stringify({ sort: [{ columnId: 'x', direction: 'sideways' }] }),
    })
    const res = (await PATCH(req as never, {} as never)) as Response
    expect(res.status).toBe(400)
  })

  it('persists a valid sort patch', async () => {
    mockFindOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ userId: 'user-1', columns: [], sort: [] }),
    })

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/board-config', {
      method: 'PATCH',
      body: JSON.stringify({ sort: [{ columnId: 'company', direction: 'desc' }] }),
    })
    const res = (await PATCH(req as never, {} as never)) as Response

    expect(res.status).toBe(200)
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1' },
      { $set: { sort: [{ columnId: 'company', direction: 'desc' }] } },
      { new: true }
    )
  })
})
