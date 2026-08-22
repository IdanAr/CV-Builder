import { describe, it, expect, vi } from 'vitest'

// next-auth's default export pulls in `next-auth/lib/env.js`, which imports
// `next/server` in a way vitest's node test environment cannot resolve
// (verified experimentally: importing proxy.ts unmocked fails with
// "Cannot find module '.../node_modules/next/server'"). Mock next-auth and
// its providers so importing proxy.ts only evaluates the local
// `config` export, not real next-auth internals.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ auth: vi.fn() })),
}))
vi.mock('next-auth/providers/github', () => ({ default: vi.fn() }))
vi.mock('next-auth/providers/google', () => ({ default: vi.fn() }))

describe('proxy matcher', () => {
  it('covers /dashboard, /api/resumes, /api/applications, /api/preview, and /api/jobsearch', async () => {
    const { config } = await import('./proxy')
    expect(config.matcher).toEqual([
      '/dashboard/:path*',
      '/api/resumes/:path*',
      '/api/applications/:path*',
      '/api/preview/:path*',
      '/api/jobsearch/:path*',
    ])
  })

  it('protects /api/jobsearch routes', async () => {
    const { config } = await import('./proxy')
    expect(config.matcher).toContain('/api/jobsearch/:path*')
  })

  it('covers /dashboard/jobsearch via the existing /dashboard/:path* wildcard', async () => {
    const { config } = await import('./proxy')
    expect(config.matcher).toContain('/dashboard/:path*')
  })

  it('does not include the OAuth handshake route', async () => {
    const { config } = await import('./proxy')
    expect(config.matcher).not.toContain('/api/auth/:path*')
  })
})
