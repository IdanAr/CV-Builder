import { describe, it, expect, vi } from 'vitest'

vi.mock('next-auth/providers/github', () => ({ default: vi.fn() }))
vi.mock('next-auth/providers/google', () => ({ default: vi.fn() }))

import { authConfig } from './auth.config'
import type { NextRequest } from 'next/server'

function reqFor(pathname: string): NextRequest {
  return { nextUrl: { pathname } } as unknown as NextRequest
}

describe('authConfig.callbacks.authorized', () => {
  it('allows the QStash cron trigger through without a session', () => {
    const result = authConfig.callbacks!.authorized!({
      request: reqFor('/api/jobsearch/scan/cron'),
      auth: null,
    })
    expect(result).toBe(true)
  })

  it('allows the QStash worker callback through without a session', () => {
    const result = authConfig.callbacks!.authorized!({
      request: reqFor('/api/jobsearch/scan/worker'),
      auth: null,
    })
    expect(result).toBe(true)
  })

  it('still requires a session for every other /api/jobsearch route', () => {
    const result = authConfig.callbacks!.authorized!({
      request: reqFor('/api/jobsearch/profiles'),
      auth: null,
    })
    expect(result).toBe(false)
  })

  it('still allows an authenticated session through for a normal jobsearch route', () => {
    const session = { user: { id: 'u1' } } as never
    const result = authConfig.callbacks!.authorized!({
      request: reqFor('/api/jobsearch/profiles'),
      auth: session,
    })
    expect(result).toBe(true)
  })
})
