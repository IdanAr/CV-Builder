import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// A stand-in for the RateLimitCounter collection: one Map shared by every
// caller, the way one MongoDB is shared by every Vercel instance. Each test
// that exercises mongoStore reads and writes it through findOneAndUpdate,
// exactly the call the store makes.
const counters = new Map<string, { count: number; expiresAt: Date }>()
const findOneAndUpdate = vi.fn()

vi.mock('@/lib/db', () => ({ default: vi.fn(async () => undefined) }))
vi.mock('@/models/RateLimitCounter', () => ({ default: { findOneAndUpdate } }))

import {
  checkRateLimit,
  checkAiRateLimit,
  aiDailyLimit,
  aiRateLimitedResponse,
  mongoStore,
  memoryStore,
  _setRateLimitStore,
  _resetRateLimits,
  type RateLimitStore,
} from '@/lib/rate-limit'

function realisticFindOneAndUpdate(
  filter: { _id: string },
  update: { $inc: { count: number }; $setOnInsert: { expiresAt: Date } }
) {
  return {
    lean: async () => {
      const row = counters.get(filter._id) ?? { count: 0, expiresAt: update.$setOnInsert.expiresAt }
      row.count += update.$inc.count
      counters.set(filter._id, row)
      return { count: row.count }
    },
  }
}

describe('checkRateLimit (in-memory store)', () => {
  beforeEach(() => {
    _setRateLimitStore(memoryStore)
    _resetRateLimits()
    vi.useRealTimers()
  })
  afterEach(() => _setRateLimitStore(null))

  it('allows requests under the limit', async () => {
    const opts = { limit: 3, windowMs: 60_000 }
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(true)
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(true)
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(true)
  })

  it('blocks the request that exceeds the limit', async () => {
    const opts = { limit: 2, windowMs: 60_000 }
    await checkRateLimit('user-1:ai', opts)
    await checkRateLimit('user-1:ai', opts)
    const result = await checkRateLimit('user-1:ai', opts)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('tracks keys independently', async () => {
    const opts = { limit: 1, windowMs: 60_000 }
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(true)
    expect((await checkRateLimit('user-2:ai', opts)).allowed).toBe(true)
    expect((await checkRateLimit('user-1:upload', opts)).allowed).toBe(true)
  })

  it('allows again after the window elapses', async () => {
    vi.useFakeTimers()
    const opts = { limit: 1, windowMs: 10_000 }
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(true)
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(false)
    vi.advanceTimersByTime(10_001)
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(true)
  })

  it('refills gradually rather than all at once', async () => {
    vi.useFakeTimers()
    const opts = { limit: 4, windowMs: 40_000 } // one token per 10s
    for (let i = 0; i < 4; i++) await checkRateLimit('u:k', opts)
    expect((await checkRateLimit('u:k', opts)).allowed).toBe(false)
    vi.advanceTimersByTime(10_001) // one token refilled
    expect((await checkRateLimit('u:k', opts)).allowed).toBe(true)
    expect((await checkRateLimit('u:k', opts)).allowed).toBe(false)
  })
})

describe('mongoStore (shared fixed window)', () => {
  beforeEach(() => {
    counters.clear()
    findOneAndUpdate.mockReset()
    findOneAndUpdate.mockImplementation(realisticFindOneAndUpdate)
    _setRateLimitStore(mongoStore)
    _resetRateLimits()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T10:00:05Z'))
  })
  afterEach(() => {
    _setRateLimitStore(null)
    vi.useRealTimers()
  })

  // Regression test for SEC-003: the old limiter kept its count in the
  // module's own memory, so a second serverless instance started from zero.
  // Clearing the in-memory buckets between calls simulates a request landing
  // on a fresh instance; the count must survive it.
  it('enforces one limit across instances, not one per instance', async () => {
    const opts = { limit: 2, windowMs: 60_000 }
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(true)
    _resetRateLimits()
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(true)
    _resetRateLimits()
    const third = await checkRateLimit('user-1:ai', opts)
    expect(third.allowed).toBe(false)
    expect(third.retryAfterSeconds).toBe(55) // window closes at 10:01:00
  })

  it('starts a fresh count in the next window', async () => {
    const opts = { limit: 1, windowMs: 60_000 }
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(true)
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(false)
    vi.setSystemTime(new Date('2026-10-18T10:01:00Z'))
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(true)
  })

  it('sets each counter to expire when its window closes', async () => {
    await checkRateLimit('user-1:ai', { limit: 5, windowMs: 60_000 })
    const [row] = [...counters.values()]
    expect(row.expiresAt.toISOString()).toBe('2026-10-18T10:01:00.000Z')
  })

  it('keeps limits with different windows apart even for the same key', async () => {
    await checkRateLimit('user-1:ai', { limit: 1, windowMs: 60_000 })
    expect((await checkRateLimit('user-1:ai', { limit: 1, windowMs: 86_400_000 })).allowed).toBe(true)
  })

  it('retries once when two first hits race on the insert', async () => {
    findOneAndUpdate
      .mockImplementationOnce(() => ({
        lean: async () => {
          throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
        },
      }))
      .mockImplementation(realisticFindOneAndUpdate)
    expect((await checkRateLimit('user-1:ai', { limit: 5, windowMs: 60_000 })).allowed).toBe(true)
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2)
  })

  it('falls back to the per-instance limit when the database fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    findOneAndUpdate.mockImplementation(() => ({
      lean: async () => {
        throw new Error('connection reset')
      },
    }))
    const opts = { limit: 1, windowMs: 60_000 }
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(true)
    expect((await checkRateLimit('user-1:ai', opts)).allowed).toBe(false)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('checkAiRateLimit', () => {
  const calls: string[] = []
  const recording = (limits: Record<string, number>): RateLimitStore => {
    const used = new Map<string, number>()
    return {
      hit: async (key) => {
        calls.push(key)
        const n = (used.get(key) ?? 0) + 1
        used.set(key, n)
        const suffix = key.slice(key.lastIndexOf(':') + 1)
        return n <= limits[suffix] ? { allowed: true, retryAfterSeconds: 0 } : { allowed: false, retryAfterSeconds: 7 }
      },
    }
  }

  beforeEach(() => {
    calls.length = 0
  })
  afterEach(() => _setRateLimitStore(null))

  it('checks the minute limit, then the daily limit', async () => {
    _setRateLimitStore(recording({ ai: 10, 'ai-daily': 10 }))
    expect(await checkAiRateLimit('u1')).toEqual({ allowed: true, retryAfterSeconds: 0 })
    expect(calls).toEqual(['u1:ai', 'u1:ai-daily'])
  })

  it('refuses with scope "day" once the daily total is spent', async () => {
    _setRateLimitStore(recording({ ai: 10, 'ai-daily': 1 }))
    await checkAiRateLimit('u1')
    expect(await checkAiRateLimit('u1')).toMatchObject({ allowed: false, scope: 'day' })
  })

  it('does not spend daily budget on a request the minute limit refused', async () => {
    _setRateLimitStore(recording({ ai: 0, 'ai-daily': 5 }))
    expect(await checkAiRateLimit('u1')).toMatchObject({ allowed: false, scope: 'minute' })
    expect(calls).toEqual(['u1:ai'])
  })

  it('tells the user which limit they hit', async () => {
    const day = await aiRateLimitedResponse({ allowed: false, retryAfterSeconds: 3600, scope: 'day' }).json()
    const minute = await aiRateLimitedResponse({ allowed: false, retryAfterSeconds: 5, scope: 'minute' }).json()
    expect(day.error).toMatch(/daily/i)
    expect(minute.error).toMatch(/wait a moment/i)
    expect(aiRateLimitedResponse({ allowed: false, retryAfterSeconds: 5 }).headers.get('Retry-After')).toBe('5')
  })
})

describe('aiDailyLimit', () => {
  it('defaults to 100 per day', () => {
    expect(aiDailyLimit({})).toEqual({ limit: 100, windowMs: 86_400_000 })
  })
  it('reads AI_DAILY_LIMIT', () => {
    expect(aiDailyLimit({ AI_DAILY_LIMIT: '25' }).limit).toBe(25)
  })
  it('ignores an invalid value rather than disabling the cap', () => {
    expect(aiDailyLimit({ AI_DAILY_LIMIT: '0' }).limit).toBe(100)
    expect(aiDailyLimit({ AI_DAILY_LIMIT: 'lots' }).limit).toBe(100)
  })
})
