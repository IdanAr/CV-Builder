import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRunScan } = vi.hoisted(() => ({ mockRunScan: vi.fn() }))

vi.mock('@/lib/jobsearch/scan', () => ({ runScanForProfile: mockRunScan }))

vi.mock('@/lib/auth', () => ({
  auth: (handler: (req: unknown) => unknown) => (req: unknown) =>
    handler(Object.assign(req as object, { auth: { user: { id: 'u1' } } })),
}))

import { POST } from './route'

beforeEach(() => vi.clearAllMocks())

describe('POST /api/jobsearch/scan', () => {
  it('runs a scan for the given profileId and returns the result', async () => {
    mockRunScan.mockResolvedValue({ fetched: 3, created: 2, skippedExisting: 1, degraded: false })
    const req = new Request('http://test/api/jobsearch/scan', {
      method: 'POST',
      body: JSON.stringify({ profileId: 'p1' }),
    })

    const res = (await POST(req as never, undefined as never)) as Response
    const body = await res.json()

    expect(mockRunScan).toHaveBeenCalledWith('u1', 'p1')
    expect(body.result).toEqual({ fetched: 3, created: 2, skippedExisting: 1, degraded: false })
  })

  it('rejects a missing profileId with 400', async () => {
    const req = new Request('http://test/api/jobsearch/scan', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const res = (await POST(req as never, undefined as never)) as Response

    expect(res.status).toBe(400)
    expect(mockRunScan).not.toHaveBeenCalled()
  })
})
