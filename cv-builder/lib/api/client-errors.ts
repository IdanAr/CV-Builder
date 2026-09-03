/**
 * The client-side counterpart to `route-errors.ts`.
 *
 * Routes already answer a throttled request properly: a 429, a `Retry-After`
 * header, and a JSON body carrying `{ error, code: 'RATE_LIMITED' }`. Nothing
 * read any of it. Every caller did
 *
 *     if (!res.ok) throw new Error(json.error ?? 'Something went wrong')
 *
 * which meant the server's carefully computed retry window was discarded on
 * arrival, and a user who hit the limit was told to "please wait a moment" with
 * no way to know whether that meant two seconds or two minutes.
 */

/** Rendered when the response carries nothing readable at all. */
const GENERIC = 'Something went wrong. Please try again.'

/**
 * Turns a failed `Response` into a sentence worth showing someone.
 *
 * Async because the body has to be read; `res.json()` is guarded because an
 * error response is exactly the case where a proxy or a crash may have sent
 * HTML instead.
 */
export async function apiErrorMessage(res: Response, fallback: string = GENERIC): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string }

  if (res.status === 429) {
    return `${stripTrailingPeriod(body.error ?? 'Too many requests')}. ${retryHint(res.headers.get('Retry-After'))}`
  }

  return body.error ?? fallback
}

/**
 * Converts the `Retry-After` header into the part of the sentence a person
 * actually acts on.
 *
 * The header is defined as either delta-seconds or an HTTP date; this app's
 * limiter only ever sends seconds, but a non-numeric value is treated as absent
 * rather than rendered as `NaN`.
 */
function retryHint(header: string | null): string {
  const seconds = Number(header)
  if (!header || !Number.isFinite(seconds) || seconds <= 0) return 'Please try again shortly.'
  if (seconds < 60) return `Try again in ${Math.ceil(seconds)}s.`
  const minutes = Math.ceil(seconds / 60)
  return `Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

/**
 * The server messages end in a full stop ("Too many AI requests - please wait a
 * moment."), and appending the retry hint to that reads as two sentences with a
 * stray period between them.
 */
function stripTrailingPeriod(text: string): string {
  return text.replace(/[.\s]+$/, '')
}

/** True when a failed response was the rate limiter rather than anything else. */
export function isRateLimited(res: Response): boolean {
  return res.status === 429
}
