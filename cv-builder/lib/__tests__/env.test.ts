import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkEnv, reportEnvOnBoot, formatEnvReport, REQUIRED_ENV_VARS } from '../env'
import type { EnvSource } from '../env'

function completeEnv(overrides: EnvSource = {}): EnvSource {
  return {
    MONGODB_URI: 'mongodb+srv://user:pw@cluster.example.net/db',
    AUTH_SECRET: 'secret',
    AUTH_GITHUB_ID: 'gh-id',
    AUTH_GITHUB_SECRET: 'gh-secret',
    AUTH_GOOGLE_ID: 'goog-id',
    AUTH_GOOGLE_SECRET: 'goog-secret',
    ANTHROPIC_API_KEY: 'sk-ant-test',
    ...overrides,
  }
}

afterEach(() => vi.restoreAllMocks())

describe('checkEnv', () => {
  it('accepts a fully configured environment', () => {
    const report = checkEnv(completeEnv())
    expect(report.ok).toBe(true)
    expect(report.problems).toEqual([])
  })

  it('names every missing required variable at once, not just the first', () => {
    const env = completeEnv()
    delete env.AUTH_SECRET
    delete env.AUTH_GITHUB_ID
    delete env.ANTHROPIC_API_KEY

    const report = checkEnv(env)
    expect(report.ok).toBe(false)
    expect(report.problems.map((p) => p.name).sort()).toEqual([
      'ANTHROPIC_API_KEY', 'AUTH_GITHUB_ID', 'AUTH_SECRET',
    ])
    expect(report.problems.every((p) => p.kind === 'missing')).toBe(true)
  })

  it('covers AUTH_SECRET, which no source file reads', () => {
    // Auth.js reads it internally, so nothing else in the repo mentions it and
    // a deploy without it fails at sign-in rather than at boot.
    expect(REQUIRED_ENV_VARS).toContain('AUTH_SECRET')
  })

  it('treats an empty or whitespace value as missing, not as invalid', () => {
    expect(checkEnv(completeEnv({ AUTH_SECRET: '' })).problems).toEqual([
      { name: 'AUTH_SECRET', kind: 'missing', message: 'not set' },
    ])
    expect(checkEnv(completeEnv({ AUTH_SECRET: '   ' })).problems[0].kind).toBe('missing')
  })

  it('rejects a MONGODB_URI that is set but not a mongo URI', () => {
    const report = checkEnv(completeEnv({ MONGODB_URI: 'postgres://localhost/db' }))
    expect(report.ok).toBe(false)
    expect(report.problems).toEqual([
      { name: 'MONGODB_URI', kind: 'invalid', message: 'must start with mongodb:// or mongodb+srv://' },
    ])
  })

  it('reports a variable once, not twice, when it is absent', () => {
    const env = completeEnv()
    delete env.MONGODB_URI
    expect(checkEnv(env).problems).toHaveLength(1)
  })

  it('lists an entirely unconfigured feature as disabled', () => {
    const report = checkEnv(completeEnv())
    expect(report.disabledFeatures).toContain('Background scan fan-out (QStash)')
    expect(report.partialFeatures).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('flags a half-configured feature, which is worse than an absent one', () => {
    // A token with no signing keys publishes jobs the worker then rejects.
    const report = checkEnv(completeEnv({ QSTASH_TOKEN: 'tok' }))
    expect(report.partialFeatures).toEqual([
      { name: 'Background scan fan-out (QStash)', missing: ['QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY'] },
    ])
    // Still "ok": the app serves requests fine, it is the feature that is broken.
    expect(report.ok).toBe(true)
  })

  it('says nothing about a fully configured optional feature', () => {
    const report = checkEnv(completeEnv({
      QSTASH_TOKEN: 'tok', QSTASH_CURRENT_SIGNING_KEY: 'a', QSTASH_NEXT_SIGNING_KEY: 'b',
    }))
    expect(report.partialFeatures).toEqual([])
    expect(report.disabledFeatures).not.toContain('Background scan fan-out (QStash)')
  })
})

describe('formatEnvReport', () => {
  it('names each problem on its own line', () => {
    const env = completeEnv()
    delete env.AUTH_GOOGLE_ID
    const text = formatEnvReport(checkEnv(env))
    expect(text).toContain('AUTH_GOOGLE_ID: not set')
    expect(text).toContain('1 problem(s)')
  })

  it('explains what a disabled feature costs', () => {
    const text = formatEnvReport(checkEnv(completeEnv()))
    expect(text).toContain('Scheduled job-search scans')
    expect(text).toContain('rejects every request')
  })
})

describe('reportEnvOnBoot', () => {
  it('refuses to start production with a required variable missing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const env = completeEnv({ NODE_ENV: 'production' })
    delete env.MONGODB_URI
    expect(() => reportEnvOnBoot(env)).toThrow(/Refusing to start/)
    expect(() => reportEnvOnBoot(env)).toThrow(/MONGODB_URI/)
  })

  it('does not throw during next build, which runs with placeholder values', () => {
    // CI's build step supplies only a placeholder MONGODB_URI. Throwing here
    // would fail every CI run for a process that never serves a request.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const env = completeEnv({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' })
    delete env.AUTH_SECRET
    expect(() => reportEnvOnBoot(env)).not.toThrow()
    expect(errors).toHaveBeenCalled()
  })

  it('lets a partially configured development environment start, loudly', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const env = completeEnv({ NODE_ENV: 'development' })
    delete env.ANTHROPIC_API_KEY
    expect(() => reportEnvOnBoot(env)).not.toThrow()
    expect(errors.mock.calls[0][0]).toContain('ANTHROPIC_API_KEY')
  })

  it('warns rather than errors when only optional features are off', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warns = vi.spyOn(console, 'warn').mockImplementation(() => {})
    reportEnvOnBoot(completeEnv({ NODE_ENV: 'production' }))
    expect(errors).not.toHaveBeenCalled()
    expect(warns).toHaveBeenCalled()
  })
})
