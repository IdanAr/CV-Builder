import { describe, it, expect } from 'vitest'
import { apiErrorMessage, isRateLimited } from '../client-errors'

/** A stand-in for a real fetch Response, carrying only what the helper reads. */
function response(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as unknown as Response
}

describe('apiErrorMessage', () => {
  // The whole point. lib/rate-limit.ts computes the exact wait and
  // route-errors.ts sends it as Retry-After; before this, every caller threw it
  // away and showed "please wait a moment" instead.
  it('tells a throttled user how long to wait', async () => {
    const res = response(429, { error: 'Too many AI requests - please wait a moment.', code: 'RATE_LIMITED' }, { 'Retry-After': '42' })
    expect(await apiErrorMessage(res)).toBe('Too many AI requests - please wait a moment. Try again in 42s.')
  })

  it('reads longer waits in minutes rather than three-digit seconds', async () => {
    const res = response(429, { error: 'Too many uploads.' }, { 'Retry-After': '150' })
    expect(await apiErrorMessage(res)).toBe('Too many uploads. Try again in 3 minutes.')
  })

  it('says "1 minute", not "1 minutes"', async () => {
    const res = response(429, { error: 'Slow down.' }, { 'Retry-After': '60' })
    expect(await apiErrorMessage(res)).toContain('Try again in 1 minute.')
  })

  it('rounds a fractional wait up, so the advice is never early', async () => {
    const res = response(429, { error: 'Slow down.' }, { 'Retry-After': '2.4' })
    expect(await apiErrorMessage(res)).toContain('Try again in 3s.')
  })

  // Retry-After also permits an HTTP date. This limiter never sends one, but
  // rendering "Try again in NaNs" would be worse than saying nothing specific.
  it('degrades gracefully when Retry-After is missing or not a number', async () => {
    expect(await apiErrorMessage(response(429, { error: 'Slow down.' }))).toBe('Slow down. Please try again shortly.')
    const dated = response(429, { error: 'Slow down.' }, { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' })
    expect(await apiErrorMessage(dated)).toBe('Slow down. Please try again shortly.')
  })

  it('passes non-429 server messages through untouched', async () => {
    expect(await apiErrorMessage(response(400, { error: 'Résumé title is required.' }))).toBe(
      'Résumé title is required.'
    )
  })

  it('uses the caller fallback when the server said nothing useful', async () => {
    expect(await apiErrorMessage(response(500, {}), 'Could not export.')).toBe('Could not export.')
  })

  // An error response is precisely when a proxy or a crash may return HTML, so
  // res.json() rejecting must not take the error path down with it.
  it('survives a response body that is not JSON', async () => {
    const res = {
      status: 502,
      headers: new Headers(),
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    } as unknown as Response
    expect(await apiErrorMessage(res, 'Export failed.')).toBe('Export failed.')
  })
})

describe('isRateLimited', () => {
  it('distinguishes throttling from other failures', () => {
    expect(isRateLimited(response(429, {}))).toBe(true)
    expect(isRateLimited(response(500, {}))).toBe(false)
  })
})
