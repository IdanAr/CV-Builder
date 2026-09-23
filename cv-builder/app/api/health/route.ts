// app/api/health/route.ts
// Unauthenticated liveness/readiness probe. Deliberately reachable without a
// session (proxy.ts's matcher does not cover /api/health) so an uptime monitor
// or a deploy check can use it.
import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import { checkEnv, ENV_FEATURES } from '@/lib/env'
import { isValidOpsAuth } from '@/lib/ops-auth'
import { checkRateLimit, HEALTH_RATE_LIMIT } from '@/lib/rate-limit'
import { apiError } from '@/lib/api/route-errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

/**
 * Bounded well under maxDuration, because mongoose's own
 * serverSelectionTimeoutMS defaults to 30s -- without this an unreachable
 * database would hold the function open until the platform killed it, and the
 * probe would time out rather than answer "unreachable".
 *
 * 12s, not the 3s this first had. Measured against this project's Atlas
 * cluster from a cold Node process: connect+ping took **7262ms** the first
 * time (mongodb+srv SRV lookup, TLS handshake, server selection) and ~700ms
 * on every subsequent run once DNS was warm. Vercel pays that cold cost on
 * every cold lambda, so a ceiling anywhere near it would mark healthy deploys
 * "degraded" -- precisely the false alarm an uptime monitor must not produce.
 *
 * A slow-but-working database should read as ok with a high latencyMs, not as
 * unreachable; alert on the latency instead.
 */
const DB_PING_TIMEOUT_MS = 12_000

async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      (async () => {
        await dbConnect()
        // A real round-trip. readyState alone would report "connected" from a
        // cached handle whose server has since gone away.
        await mongoose.connection.db?.admin().ping()
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`ping did not answer within ${DB_PING_TIMEOUT_MS}ms`)),
          DB_PING_TIMEOUT_MS
        )
      }),
    ])
    return { ok: true, latencyMs: Date.now() - started }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    // Without this the pending timer keeps the event loop alive for the rest
    // of the window on a fast, successful ping.
    if (timer) clearTimeout(timer)
  }
}

export const HEALTH_TIMING = { maxDurationSeconds: maxDuration, dbPingTimeoutMs: DB_PING_TIMEOUT_MS }

export async function GET(req: Request): Promise<NextResponse> {
  const authorized = isValidOpsAuth(req.headers.get('authorization'))

  if (!authorized) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rate = checkRateLimit(`${ip}:health`, HEALTH_RATE_LIMIT)
    if (!rate.allowed) {
      return apiError('RATE_LIMITED', 'Too many health checks.', 429, undefined, rate.retryAfterSeconds)
    }
  }

  const env = checkEnv()
  const db = await pingDatabase()
  const ok = env.ok && db.ok

  // The public shape names no variable and carries no error text: knowing
  // *which* credential a deploy is missing is useful to an operator and
  // useful to an attacker. Detail requires the ops bearer.
  const body: Record<string, unknown> = {
    status: ok ? 'ok' : 'degraded',
    checks: {
      config: env.ok ? 'ok' : 'incomplete',
      database: db.ok ? 'ok' : 'unreachable',
    },
  }

  if (authorized) {
    body.details = {
      problems: env.problems,
      partialFeatures: env.partialFeatures,
      disabledFeatures: env.disabledFeatures,
      knownFeatures: ENV_FEATURES.map((f) => f.name),
      databaseError: db.ok ? null : db.error,
      databaseLatencyMs: db.latencyMs,
    }
  }

  return NextResponse.json(body, { status: ok ? 200 : 503 })
}
