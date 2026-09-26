// lib/ops-auth.ts
// Shared bearer check for the operational endpoints (the cron trigger and
// /api/health's detailed output). One implementation so the constant-time
// comparison cannot be got right in one place and wrong in another.
import { timingSafeEqual } from 'crypto'

/**
 * Fails closed: with no CRON_SECRET configured, nothing is ever authorised.
 *
 * The length check before timingSafeEqual is required (it throws on unequal
 * lengths) and leaks only the length of the supplied header, not the secret.
 */
export function isValidOpsAuth(authHeader: string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !authHeader) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(authHeader)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
