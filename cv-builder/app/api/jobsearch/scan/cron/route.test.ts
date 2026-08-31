import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockListAllActive, mockPublishScanJob } = vi.hoisted(() => ({
  mockListAllActive: vi.fn(),
  mockPublishScanJob: vi.fn(),
}))

vi.mock('@/lib/api/jobsearch-profiles', () => ({ listAllActiveJobSearchProfiles: mockListAllActive }))
vi.mock('@/lib/jobsearch/queue', () => ({ publishScanJob: mockPublishScanJob }))

import { GET } from './route'

const originalCronSecret = process.env.CRON_SECRET

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
})

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret
})

function req(authHeader?: string) {
  const headers = new Headers()
  if (authHeader !== undefined) headers.set('authorization', authHeader)
  return new Request('http://test/api/jobsearch/scan/cron', { headers })
}

describe('GET /api/jobsearch/scan/cron', () => {
  it('rejects a request missing the CRON_SECRET bearer header', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(mockListAllActive).not.toHaveBeenCalled()
  })

  it('rejects a request with the wrong bearer token', async () => {
    const res = await GET(req('Bearer wrong'))
    expect(res.status).toBe(401)
  })

  it('rejects a bearer token of a different length without throwing', async () => {
    const res = await GET(req('Bearer x'))
    expect(res.status).toBe(401)
  })

  it('publishes one scan job per active profile and reports the count', async () => {
    mockListAllActive.mockResolvedValue([
      { _id: 'p1', userId: 'u1' },
      { _id: 'p2', userId: 'u2' },
    ])
    mockPublishScanJob.mockResolvedValue(undefined)

    const res = await GET(req('Bearer test-secret'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockPublishScanJob).toHaveBeenCalledWith('u1', 'p1')
    expect(mockPublishScanJob).toHaveBeenCalledWith('u2', 'p2')
    expect(body).toEqual({ queued: 2, failed: 0, total: 2 })
  })

  it('counts a failed publish without aborting the rest of the fan-out', async () => {
    mockListAllActive.mockResolvedValue([
      { _id: 'p1', userId: 'u1' },
      { _id: 'p2', userId: 'u2' },
    ])
    mockPublishScanJob
      .mockRejectedValueOnce(new Error('qstash unreachable'))
      .mockResolvedValueOnce(undefined)

    const res = await GET(req('Bearer test-secret'))
    const body = await res.json()

    expect(body).toEqual({ queued: 1, failed: 1, total: 2 })
  })
})
