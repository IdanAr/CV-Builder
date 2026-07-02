import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('getAnthropic', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('throws when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const { getAnthropic } = await import('@/lib/ai/models')
    expect(() => getAnthropic()).toThrow('ANTHROPIC_API_KEY')
  })

  it('configures a 30 second request timeout', async () => {
    const { getAnthropic } = await import('@/lib/ai/models')
    const client = getAnthropic()
    expect(client.timeout).toBe(30_000)
  })

  it('limits retries to 1 so requests fail fast', async () => {
    const { getAnthropic } = await import('@/lib/ai/models')
    const client = getAnthropic()
    expect(client.maxRetries).toBe(1)
  })
})
