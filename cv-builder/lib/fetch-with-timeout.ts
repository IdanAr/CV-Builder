/**
 * `fetch` with a deadline.
 *
 * The AI endpoints (bullet-point suggestions, cover letters, ATS analysis and
 * fixes, semantic matching) call out to Claude and can stall well past any
 * useful wait. None of the callers bounded the request, so a hung upstream left
 * a spinner running indefinitely with no way out but reloading the page — which
 * also loses whatever job description the user had pasted in.
 *
 * Aborting the request is what makes the failure *recoverable*: the caller's
 * existing catch runs, the spinner clears, and an error message can offer a
 * retry.
 */

/** Generous enough for a slow multi-step AI pipeline, short enough to not read as "hung". */
export const AI_REQUEST_TIMEOUT_MS = 60_000

/**
 * Thrown when the deadline is hit, so callers can tell a timeout apart from a
 * network error or a deliberate cancellation and word the message accordingly.
 */
export class RequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`)
    this.name = 'RequestTimeoutError'
  }
}

/**
 * Turns a caught error into something worth showing a user.
 *
 * Callers already surface `err.message` for API-supplied errors, which is
 * right — those are written for humans. A timeout's own message is not, so it
 * is replaced with wording that says what happened and what to do next.
 */
export function requestErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof RequestTimeoutError) {
    return 'This took longer than expected and was stopped. Please try again.'
  }
  return err instanceof Error ? err.message : fallback
}

/**
 * Runs `fetch` with an abort deadline, honouring any `signal` the caller
 * already passes (e.g. an unmount abort) — whichever fires first wins.
 *
 * Rejects with {@link RequestTimeoutError} on the deadline, and re-throws the
 * caller's own abort reason untouched when the caller cancelled, so an
 * unmount-driven abort is never mislabelled as a timeout.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const external = init.signal ?? undefined

  // If the caller's signal is already aborted, don't even start the request.
  if (external?.aborted) throw external.reason ?? new DOMException('Aborted', 'AbortError')

  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const forwardAbort = () => controller.abort()
  external?.addEventListener('abort', forwardAbort)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    // The caller cancelling takes precedence: report their reason, not ours.
    if (external?.aborted) throw external.reason ?? err
    if (timedOut) throw new RequestTimeoutError(timeoutMs)
    throw err
  } finally {
    clearTimeout(timer)
    external?.removeEventListener('abort', forwardAbort)
  }
}
