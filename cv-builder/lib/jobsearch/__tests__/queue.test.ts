import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockPublishJSON } = vi.hoisted(() => ({ mockPublishJSON: vi.fn() }))

vi.mock('@upstash/qstash', () => ({
  Client: vi.fn(function() { return { publishJSON: mockPublishJSON } }),
}))

import { Client } from '@upstash/qstash'
import { publishScanJob } from '../queue'

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  mockPublishJSON.mockResolvedValue({ messageId: 'msg1' })
  process.env.QSTASH_TOKEN = 'test-token'
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('publishScanJob', () => {
  it('publishes to the worker route with userId and profileId in the body', async () => {
    process.env.APP_URL = 'https://example.com'

    await publishScanJob('u1', 'p1')

    expect(Client).toHaveBeenCalledWith({ token: 'test-token' })
    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: 'https://example.com/api/jobsearch/scan/worker',
      body: { userId: 'u1', profileId: 'p1' },
    })
  })

  it('falls back to VERCEL_URL when APP_URL is unset', async () => {
    delete process.env.APP_URL
    process.env.VERCEL_URL = 'my-app.vercel.app'

    await publishScanJob('u1', 'p1')

    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://my-app.vercel.app/api/jobsearch/scan/worker' })
    )
  })

  it('falls back to localhost when neither APP_URL nor VERCEL_URL is set', async () => {
    delete process.env.APP_URL
    delete process.env.VERCEL_URL

    await publishScanJob('u1', 'p1')

    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://localhost:3000/api/jobsearch/scan/worker' })
    )
  })
})
