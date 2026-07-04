// lib/rate-limit.ts
// In-memory token bucket rate limiter, keyed by an arbitrary string
// (typically `${userId}:${routeGroup}`). Suitable for a single-process
// deployment; swap for a shared store (e.g. Upstash) if scaling out.

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the next token is available (only when blocked). */
  retryAfterSeconds: number
}

/** AI endpoints (Anthropic-backed): 10 requests/min per user. */
export const AI_RATE_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 }
/** File upload/parse endpoints: 10 requests/min per user. */
export const UPLOAD_RATE_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 }
/** Preview pagination renders (server-side react-pdf): 30 requests/min per user. */
export const PREVIEW_RATE_LIMIT: RateLimitOptions = { limit: 30, windowMs: 60_000 }

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const refillRate = opts.limit / opts.windowMs // tokens per ms

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: opts.limit, lastRefill: now }
    buckets.set(key, bucket)
  } else {
    const elapsed = now - bucket.lastRefill
    bucket.tokens = Math.min(opts.limit, bucket.tokens + elapsed * refillRate)
    bucket.lastRefill = now
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const msUntilToken = (1 - bucket.tokens) / refillRate
  return { allowed: false, retryAfterSeconds: Math.ceil(msUntilToken / 1000) }
}

/** Test-only: clear all buckets. */
export function _resetRateLimits(): void {
  buckets.clear()
}
