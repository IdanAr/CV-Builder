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

  it('does not bypass a lookalike path that merely starts with the same prefix', () => {
    const result = authConfig.callbacks!.authorized!({
      request: reqFor('/api/jobsearch/scan/cronjobs'),
      auth: null,
    })
    expect(result).toBe(false)
  })

  it.each(['/dashboard', '/dashboard/cvs', '/dashboard/resumes/abc'])(
    'requires a session for %s',
    (path) => {
      const authorized = authConfig.callbacks!.authorized!
      expect(authorized({ request: reqFor(path), auth: null })).toBe(false)
      expect(
        authorized({ request: reqFor(path), auth: { user: { id: 'u1' } } as never })
      ).toBe(true)
    }
  )
})

// Regression tests for security audit SEC-002: a provider-reported email must
// never be enough to enter an existing account.
describe('account linking (SEC-002)', () => {
  it('does not auto-link provider accounts by email', async () => {
    const GitHub = (await import('next-auth/providers/github')).default as unknown as ReturnType<typeof vi.fn>
    const Google = (await import('next-auth/providers/google')).default as unknown as ReturnType<typeof vi.fn>
    for (const provider of [GitHub, Google]) {
      expect(provider).toHaveBeenCalled()
      for (const [options] of provider.mock.calls) {
        expect(options).not.toHaveProperty('allowDangerousEmailAccountLinking')
      }
    }
  })
})

describe('authConfig.callbacks.signIn', () => {
  const signInCb = (provider: string, profile: Record<string, unknown> | undefined) =>
    authConfig.callbacks!.signIn!({
      account: { provider, type: 'oidc', providerAccountId: 'x' },
      profile,
      user: { id: 'u' },
    } as never)

  it('refuses a Google profile whose email is not verified', async () => {
    expect(await signInCb('google', { email: 'a@b.c', email_verified: false })).toBe(
      '/signin?error=GoogleEmailUnverified'
    )
  })

  it('refuses a Google profile that does not say whether the email is verified', async () => {
    expect(await signInCb('google', { email: 'a@b.c' })).toBe('/signin?error=GoogleEmailUnverified')
  })

  it('allows a Google profile with a verified email', async () => {
    expect(await signInCb('google', { email: 'a@b.c', email_verified: true })).toBe(true)
  })

  it('allows GitHub, which only exposes verified emails', async () => {
    expect(await signInCb('github', { email: 'a@b.c' })).toBe(true)
  })
})
