import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockPublishJSON, mockAfter, mockRunJob } = vi.hoisted(() => ({
  mockPublishJSON: vi.fn(),
  mockAfter: vi.fn(),
  mockRunJob: vi.fn(),
}))

vi.mock('@upstash/qstash', () => ({
  Client: vi.fn(function () {
    return { publishJSON: mockPublishJSON }
  }),
}))
vi.mock('next/server', () => ({ after: mockAfter }))
vi.mock('../job', () => ({ runCoverLetterJob: mockRunJob }))

import { Client } from '@upstash/qstash'
import { enqueueCoverLetter } from '../queue'

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  mockPublishJSON.mockResolvedValue({ messageId: 'msg1' })
  mockRunJob.mockResolvedValue('written')
  delete process.env.QSTASH_TOKEN
  delete process.env.QSTASH_URL
  delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  process.env.APP_URL = 'https://example.com'
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('enqueueCoverLetter', () => {
  it('runs the job in after() when QSTASH_TOKEN is not set', async () => {
    await enqueueCoverLetter('u1', 'l1')

    expect(mockPublishJSON).not.toHaveBeenCalled()
    expect(mockAfter).toHaveBeenCalledTimes(1)
    expect(mockRunJob).not.toHaveBeenCalled()

    await mockAfter.mock.calls[0][0]()
    expect(mockRunJob).toHaveBeenCalledWith('u1', 'l1')
  })

  it('logs and swallows a job that throws inside after()', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRunJob.mockRejectedValue(new Error('db down'))
    await enqueueCoverLetter('u1', 'l1')

    await expect(mockAfter.mock.calls[0][0]()).resolves.toBeUndefined()
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it('publishes to the worker with one retry when QSTASH_TOKEN is set', async () => {
    process.env.QSTASH_TOKEN = 'test-token'
    process.env.QSTASH_URL = 'https://qstash-us-east-1.upstash.io'

    await enqueueCoverLetter('u1', 'l1')

    expect(Client).toHaveBeenCalledWith({ token: 'test-token', baseUrl: 'https://qstash-us-east-1.upstash.io' })
    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: 'https://example.com/api/cover-letters/worker',
      body: { userId: 'u1', letterId: 'l1' },
      retries: 1,
      headers: undefined,
    })
    expect(mockAfter).not.toHaveBeenCalled()
  })

  it('forwards the Vercel protection bypass header', async () => {
    process.env.QSTASH_TOKEN = 'test-token'
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'bypass-secret'

    await enqueueCoverLetter('u1', 'l1')

    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { 'x-vercel-protection-bypass': 'bypass-secret' } })
    )
  })
})
