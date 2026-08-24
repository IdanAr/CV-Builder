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

  it('passes QSTASH_URL as the client baseUrl when set, for a non-default-region QStash instance', async () => {
    process.env.QSTASH_URL = 'https://qstash-us-east-1.upstash.io'

    await publishScanJob('u1', 'p1')

    expect(Client).toHaveBeenCalledWith({ token: 'test-token', baseUrl: 'https://qstash-us-east-1.upstash.io' })
  })

  it('omits baseUrl (SDK defaults to the EU region) when QSTASH_URL is unset', async () => {
    delete process.env.QSTASH_URL

    await publishScanJob('u1', 'p1')

    expect(Client).toHaveBeenCalledWith({ token: 'test-token', baseUrl: undefined })
  })

  it('forwards the Vercel protection-bypass header when VERCEL_AUTOMATION_BYPASS_SECRET is set', async () => {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'bypass-secret'

    await publishScanJob('u1', 'p1')

    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { 'x-vercel-protection-bypass': 'bypass-secret' } })
    )
  })

  it('omits the bypass header when VERCEL_AUTOMATION_BYPASS_SECRET is unset', async () => {
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET

    await publishScanJob('u1', 'p1')

    expect(mockPublishJSON).toHaveBeenCalledWith(expect.objectContaining({ headers: undefined }))
  })
})
