import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkRateLimit, _resetRateLimits } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    _resetRateLimits()
    vi.useRealTimers()
  })

  it('allows requests under the limit', () => {
    const opts = { limit: 3, windowMs: 60_000 }
    expect(checkRateLimit('user-1:ai', opts).allowed).toBe(true)
    expect(checkRateLimit('user-1:ai', opts).allowed).toBe(true)
    expect(checkRateLimit('user-1:ai', opts).allowed).toBe(true)
  })

  it('blocks the request that exceeds the limit', () => {
    const opts = { limit: 2, windowMs: 60_000 }
    checkRateLimit('user-1:ai', opts)
    checkRateLimit('user-1:ai', opts)
    const result = checkRateLimit('user-1:ai', opts)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('tracks keys independently', () => {
    const opts = { limit: 1, windowMs: 60_000 }
    expect(checkRateLimit('user-1:ai', opts).allowed).toBe(true)
    expect(checkRateLimit('user-2:ai', opts).allowed).toBe(true)
    expect(checkRateLimit('user-1:upload', opts).allowed).toBe(true)
  })

  it('allows again after the window elapses', () => {
    vi.useFakeTimers()
    const opts = { limit: 1, windowMs: 10_000 }
    expect(checkRateLimit('user-1:ai', opts).allowed).toBe(true)
    expect(checkRateLimit('user-1:ai', opts).allowed).toBe(false)
    vi.advanceTimersByTime(10_001)
    expect(checkRateLimit('user-1:ai', opts).allowed).toBe(true)
  })

  it('refills gradually rather than all at once', () => {
    vi.useFakeTimers()
    const opts = { limit: 4, windowMs: 40_000 } // one token per 10s
    for (let i = 0; i < 4; i++) checkRateLimit('u:k', opts)
    expect(checkRateLimit('u:k', opts).allowed).toBe(false)
    vi.advanceTimersByTime(10_001) // one token refilled
    expect(checkRateLimit('u:k', opts).allowed).toBe(true)
    expect(checkRateLimit('u:k', opts).allowed).toBe(false)
  })
})
