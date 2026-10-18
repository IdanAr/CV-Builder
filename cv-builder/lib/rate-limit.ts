// lib/rate-limit.ts
// Rate limiting keyed by an arbitrary string (typically `${userId}:${routeGroup}`).
//
// Production uses a fixed-window counter in MongoDB (models/RateLimitCounter.ts),
// shared by every serverless instance. The previous in-memory token bucket gave
// each Vercel lambda its own Map, so "10 requests/min per user" was really
// "10 per minute per warm instance" -- no limit at all under load, which is
// exactly when it matters (security audit SEC-003).
//
// MongoDB rather than a new Redis: the app already depends on it, so the limit
// is live on deploy with no new service or env vars to forget. The cost is one
// small upsert per limited request.
//
// The in-memory bucket remains as (a) the store under Vitest and (b) the
// fallback when the database call fails, so a database blip degrades to the
// old per-instance limit instead of either letting everything through
// unlimited or failing every request.
import { apiError } from '@/lib/api/route-errors'

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until a request will be allowed again (only when blocked). */
  retryAfterSeconds: number
}

/** AI endpoints (Anthropic-backed): 10 requests/min per user. */
export const AI_RATE_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 }

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_AI_DAILY_LIMIT = 100

/**
 * Interactive AI calls per user per UTC day. The per-minute limit bounds
 * bursts; this bounds the total, so a scripted account cannot run the
 * Anthropic bill up at 10/min around the clock (14,400 calls/day).
 * Background drafting has its own caps in lib/jobsearch/apply.ts.
 *
 * Overridable with AI_DAILY_LIMIT; a missing or invalid value uses the default.
 */
export function aiDailyLimit(env: Record<string, string | undefined> = process.env): RateLimitOptions {
  const parsed = Number.parseInt(env.AI_DAILY_LIMIT ?? '', 10)
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AI_DAILY_LIMIT
  return { limit, windowMs: DAY_MS }
}

/** File upload/parse endpoints: 10 requests/min per user. */
export const UPLOAD_RATE_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 }
/** Preview pagination renders (server-side react-pdf): 30 requests/min per user. */
export const PREVIEW_RATE_LIMIT: RateLimitOptions = { limit: 30, windowMs: 60_000 }
/** Job-search scan endpoint (outbound freehire.me call + bulk scoring): 5 requests/min per user. */
export const SCAN_RATE_LIMIT: RateLimitOptions = { limit: 5, windowMs: 60_000 }
/** Comeet careers-page URL resolver (outbound fetch to a user-supplied comeet.com URL): 10 requests/min per user. */
export const COMEET_RESOLVE_RATE_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 }
/** Job-posting URL import (outbound fetch to a user-supplied public URL): 10 requests/min per user. */
export const JOB_URL_RATE_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 }
/** Résumé/cover-letter PDF & DOCX export (server-side react-pdf/docx render): 20 requests/min per user. */
export const EXPORT_RATE_LIMIT: RateLimitOptions = { limit: 20, windowMs: 60_000 }

// Keyed by client IP rather than user id -- /api/health is deliberately
// unauthenticated so an uptime monitor can reach it. 30/min leaves room for a
// two-second polling interval; requests carrying a valid ops bearer skip the
// limit entirely.
export const HEALTH_RATE_LIMIT: RateLimitOptions = { limit: 30, windowMs: 60_000 }

export interface RateLimitStore {
  hit(key: string, opts: RateLimitOptions): Promise<RateLimitResult>
}

// ---------------------------------------------------------------------------
// In-memory token bucket: test store and database-failure fallback.

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

function memoryHit(key: string, opts: RateLimitOptions): RateLimitResult {
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

export const memoryStore: RateLimitStore = {
  hit: async (key, opts) => memoryHit(key, opts),
}

// ---------------------------------------------------------------------------
// MongoDB fixed window: the production store.

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number } | null)?.code === 11000
}

export const mongoStore: RateLimitStore = {
  async hit(key, opts) {
    // Imported lazily: lib/db.ts throws at module scope without MONGODB_URI,
    // and many modules import this one in environments that never touch the
    // database (tests, the build).
    const [{ default: dbConnect }, { default: RateLimitCounter }] = await Promise.all([
      import('@/lib/db'),
      import('@/models/RateLimitCounter'),
    ])
    await dbConnect()

    const now = Date.now()
    const windowIndex = Math.floor(now / opts.windowMs)
    const windowEnd = (windowIndex + 1) * opts.windowMs
    // windowMs is part of the id so two limits sharing a key prefix can never
    // count into the same row.
    const _id = `${key}:${opts.windowMs}:${windowIndex}`

    const increment = () =>
      RateLimitCounter.findOneAndUpdate(
        { _id },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowEnd) } },
        { upsert: true, new: true }
      ).lean<{ count: number }>()

    let doc: { count: number } | null
    try {
      doc = await increment()
    } catch (err) {
      // Two first hits in the same window can both try to insert; the loser
      // gets E11000, and retrying turns its upsert into a plain update.
      if (!isDuplicateKey(err)) throw err
      doc = await increment()
    }

    const count = doc?.count ?? 1
    if (count <= opts.limit) return { allowed: true, retryAfterSeconds: 0 }
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now) / 1000)) }
  },
}

// ---------------------------------------------------------------------------

let storeOverride: RateLimitStore | null = null

function activeStore(): RateLimitStore {
  if (storeOverride) return storeOverride
  return process.env.VITEST ? memoryStore : mongoStore
}

export async function checkRateLimit(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  const store = activeStore()
  try {
    return await store.hit(key, opts)
  } catch (err) {
    if (store === memoryStore) throw err
    console.error('[rate-limit] shared store failed; falling back to per-instance memory', err)
    return memoryHit(key, opts)
  }
}

export interface AiRateLimitResult extends RateLimitResult {
  /** Which limit refused the request, so the caller can say which. */
  scope?: 'minute' | 'day'
}

/**
 * The single gate for interactive Anthropic-backed calls: the per-minute
 * burst limit, then the per-day total. A request refused by the minute limit
 * does not spend daily budget.
 */
export async function checkAiRateLimit(userId: string): Promise<AiRateLimitResult> {
  const minute = await checkRateLimit(`${userId}:ai`, AI_RATE_LIMIT)
  if (!minute.allowed) return { ...minute, scope: 'minute' }
  const day = await checkRateLimit(`${userId}:ai-daily`, aiDailyLimit())
  if (!day.allowed) return { ...day, scope: 'day' }
  return day
}

/** The 429 every AI route returns when checkAiRateLimit refuses. */
export function aiRateLimitedResponse(rate: AiRateLimitResult) {
  const message =
    rate.scope === 'day'
      ? 'Daily AI limit reached - it resets at midnight UTC.'
      : 'Too many AI requests - please wait a moment.'
  return apiError('RATE_LIMITED', message, 429, undefined, rate.retryAfterSeconds)
}

/** Test-only: choose the store (null restores the default). */
export function _setRateLimitStore(store: RateLimitStore | null): void {
  storeOverride = store
}

/** Test-only: clear all in-memory buckets. */
export function _resetRateLimits(): void {
  buckets.clear()
}
