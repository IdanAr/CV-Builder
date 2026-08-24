import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRunScan } = vi.hoisted(() => ({ mockRunScan: vi.fn() }))

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (handler: unknown) => handler,
}))
vi.mock('@/lib/jobsearch/scan', () => ({ runScanForProfile: mockRunScan }))

import { POST } from './route'

beforeEach(() => {
  vi.clearAllMocks()
})

function req(body: unknown) {
  return new Request('http://test/api/jobsearch/scan/worker', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/jobsearch/scan/worker', () => {
  it('runs a scan for the given userId/profileId and returns the result', async () => {
    mockRunScan.mockResolvedValue({
      fetched: 3, created: 2, skippedExisting: 1, drafted: 0, pruned: 0, degraded: false,
    })

    const res = (await POST(req({ userId: 'u1', profileId: 'p1' }) as never, undefined as never)) as Response
    const body = await res.json()

    expect(mockRunScan).toHaveBeenCalledWith('u1', 'p1')
    expect(body.result).toEqual({
      fetched: 3, created: 2, skippedExisting: 1, drafted: 0, pruned: 0, degraded: false,
    })
  })

  it('rejects a missing userId with 400', async () => {
    const res = (await POST(req({ profileId: 'p1' }) as never, undefined as never)) as Response
    expect(res.status).toBe(400)
    expect(mockRunScan).not.toHaveBeenCalled()
  })

  it('rejects a missing profileId with 400', async () => {
    const res = (await POST(req({ userId: 'u1' }) as never, undefined as never)) as Response
    expect(res.status).toBe(400)
    expect(mockRunScan).not.toHaveBeenCalled()
  })
})
