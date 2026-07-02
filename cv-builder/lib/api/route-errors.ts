// lib/api/route-errors.ts
// Shared error responses for API routes: one JSON shape everywhere,
// server-side logging, and Mongoose CastError (malformed ObjectId) → 404.
import { NextResponse } from 'next/server'

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
  retryAfterSeconds?: number
): NextResponse {
  const body: Record<string, unknown> = { error: message, code }
  if (details !== undefined) body.details = details
  const headers: Record<string, string> = {}
  if (status === 429 && retryAfterSeconds !== undefined) {
    headers['Retry-After'] = String(retryAfterSeconds)
  }
  return NextResponse.json(body, { status, headers })
}

export function handleRouteError(err: unknown, routeTag: string): NextResponse {
  console.error(`[${routeTag}]`, err)
  if (err instanceof Error && err.name === 'CastError') {
    return apiError('NOT_FOUND', 'Not found', 404)
  }
  return apiError('INTERNAL_ERROR', 'Internal server error', 500)
}
