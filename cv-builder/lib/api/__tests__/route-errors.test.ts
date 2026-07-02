import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

describe('apiError', () => {
  it('returns a JSON response with error, code, and status', async () => {
    const res = apiError('NOT_FOUND', 'Not found', 404)
    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Type')).toContain('application/json')
    expect(await res.json()).toEqual({ error: 'Not found', code: 'NOT_FOUND' })
  })

  it('includes details when provided', async () => {
    const res = apiError('VALIDATION_ERROR', 'Validation failed', 400, [{ path: ['email'] }])
    expect(await res.json()).toEqual({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: [{ path: ['email'] }],
    })
  })

  it('sets Retry-After header for 429 responses when retryAfterSeconds given', () => {
    const res = apiError('RATE_LIMITED', 'Too many requests', 429, undefined, 30)
    expect(res.headers.get('Retry-After')).toBe('30')
  })
})

describe('handleRouteError', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps Mongoose CastError to 404', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const castError = Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' })
    const res = handleRouteError(castError, 'GET /api/resumes/[id]')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found', code: 'NOT_FOUND' })
  })

  it('returns 500 with INTERNAL_ERROR for unknown errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = handleRouteError(new Error('boom'), 'GET /api/resumes')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
  })

  it('logs the error with the route tag', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('boom')
    handleRouteError(err, 'POST /api/resumes')
    expect(spy).toHaveBeenCalledWith('[POST /api/resumes]', err)
  })
})
