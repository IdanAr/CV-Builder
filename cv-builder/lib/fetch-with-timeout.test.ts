import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  fetchWithTimeout,
  requestErrorMessage,
  RequestTimeoutError,
  AI_REQUEST_TIMEOUT_MS,
} from './fetch-with-timeout'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchWithTimeout', () => {
  it('returns the response when the request completes before the deadline', async () => {
    const response = { ok: true } as Response
    vi.stubGlobal('fetch', vi.fn(async () => response))

    await expect(fetchWithTimeout('/api/thing')).resolves.toBe(response)
  })

  it("passes the caller's method, headers and body through untouched", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response)
    vi.stubGlobal('fetch', fetchMock)

    await fetchWithTimeout('/api/thing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"a":1}')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('rejects with RequestTimeoutError once the deadline passes', async () => {
    vi.useFakeTimers()
    // A request that never settles on its own — only the deadline can end it.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError'))
            )
          })
      )
    )

    const pending = fetchWithTimeout('/api/slow', {}, 1000)
    const assertion = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError)
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })

  it('aborts the underlying request when the deadline passes', async () => {
    vi.useFakeTimers()
    let seenSignal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        seenSignal = init?.signal ?? undefined
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
        })
      })
    )

    const pending = fetchWithTimeout('/api/slow', {}, 1000).catch(() => null)
    await vi.advanceTimersByTimeAsync(1000)
    await pending

    expect(seenSignal?.aborted).toBe(true)
  })

  it("reports the caller's own abort reason rather than a timeout", async () => {
    const controller = new AbortController()
    const callerReason = new Error('component unmounted')
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError'))
            )
          })
      )
    )

    const pending = fetchWithTimeout('/api/slow', { signal: controller.signal })
    controller.abort(callerReason)

    await expect(pending).rejects.toBe(callerReason)
  })

  it('does not start a request whose signal is already aborted', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response)
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    controller.abort(new Error('already gone'))

    await expect(fetchWithTimeout('/api/thing', { signal: controller.signal })).rejects.toThrow(
      'already gone'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('propagates a genuine network failure unchanged', async () => {
    const networkError = new TypeError('Failed to fetch')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw networkError
      })
    )

    await expect(fetchWithTimeout('/api/thing')).rejects.toBe(networkError)
  })

  it('does not fire a late abort after the request has settled', async () => {
    vi.useFakeTimers()
    let seenSignal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        seenSignal = init?.signal ?? undefined
        return { ok: true } as Response
      })
    )

    await fetchWithTimeout('/api/thing', {}, 1000)
    await vi.advanceTimersByTimeAsync(5000)

    expect(seenSignal?.aborted).toBe(false)
  })

  it('defaults to the shared AI timeout', () => {
    expect(AI_REQUEST_TIMEOUT_MS).toBe(60_000)
  })
})

describe('requestErrorMessage', () => {
  it("replaces a timeout's internal message with actionable wording", () => {
    const message = requestErrorMessage(new RequestTimeoutError(60_000), 'fallback')
    expect(message).not.toMatch(/60000/)
    expect(message).toMatch(/try again/i)
  })

  it('surfaces an API-supplied error message, which is written for humans', () => {
    expect(requestErrorMessage(new Error('Daily limit reached'), 'fallback')).toBe(
      'Daily limit reached'
    )
  })

  it('falls back when the thrown value is not an Error', () => {
    expect(requestErrorMessage('boom', 'Something went wrong.')).toBe('Something went wrong.')
  })
})
