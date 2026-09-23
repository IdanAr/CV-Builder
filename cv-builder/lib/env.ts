// lib/env.ts
// One description of what this app needs from its environment, checked once
// at boot and reported by /api/health.
//
// Before this, a missing variable surfaced as whatever the first consumer
// happened to do with it: lib/db.ts throws at module scope, lib/ai/models.ts
// throws lazily on the first AI call, and auth.config.ts non-null-asserts the
// four OAuth values, so a deploy missing AUTH_GITHUB_ID booted fine and then
// failed inside the provider with an opaque error. A misconfigured deploy
// should say so at startup, naming every problem at once.
import { z } from 'zod'

/**
 * Variables the app cannot serve a request without.
 *
 * AUTH_SECRET is here even though no source file reads it: Auth.js reads it
 * internally, so nothing else in this repo would ever mention it.
 */
const RequiredEnvSchema = z.object({
  MONGODB_URI: z
    .string()
    .min(1)
    .refine(
      (v) => v.startsWith('mongodb://') || v.startsWith('mongodb+srv://'),
      'must start with mongodb:// or mongodb+srv://'
    ),
  AUTH_SECRET: z.string().min(1),
  AUTH_GITHUB_ID: z.string().min(1),
  AUTH_GITHUB_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
})

export const REQUIRED_ENV_VARS = Object.keys(RequiredEnvSchema.shape) as Array<
  keyof typeof RequiredEnvSchema.shape
>

/**
 * Optional features and the variables each one needs.
 *
 * Grouped rather than listed flat because a half-configured feature is worse
 * than an unconfigured one: QStash with a token but no signing keys publishes
 * jobs the worker then rejects, and nothing logs why.
 */
export interface EnvFeature {
  name: string
  vars: string[]
  /** What happens when the feature is off. */
  whenAbsent: string
}

export const ENV_FEATURES: EnvFeature[] = [
  {
    name: 'Scheduled job-search scans',
    vars: ['CRON_SECRET'],
    whenAbsent: '/api/jobsearch/scan/cron rejects every request, so nothing is ever scanned on a schedule',
  },
  {
    name: 'Background scan fan-out (QStash)',
    vars: ['QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY'],
    whenAbsent: 'scans run inline on the request instead of being fanned out to the worker route',
  },
  {
    name: 'Absolute URL resolution',
    vars: ['APP_URL'],
    whenAbsent: 'falls back to VERCEL_PROJECT_PRODUCTION_URL, then VERCEL_URL, then localhost',
  },
]

export interface EnvProblem {
  name: string
  /** 'missing' — not set at all. 'invalid' — set but unusable. */
  kind: 'missing' | 'invalid'
  message: string
}

export interface EnvReport {
  ok: boolean
  /** Required variables that are absent or unusable. */
  problems: EnvProblem[]
  /** Features switched off entirely because none of their vars are set. */
  disabledFeatures: string[]
  /** Features with some but not all of their vars set — almost always a mistake. */
  partialFeatures: Array<{ name: string; missing: string[] }>
}

/**
 * Deliberately not NodeJS.ProcessEnv: Next declares NODE_ENV as required on
 * that type, so describing a synthetic deploy in a test would not compile.
 */
export type EnvSource = Record<string, string | undefined>

function isSet(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/**
 * Inspects an environment without touching process.env directly, so tests can
 * describe a deploy rather than mutate the one they run in.
 */
export function checkEnv(env: EnvSource = process.env): EnvReport {
  const problems: EnvProblem[] = []

  const present: Record<string, string> = {}
  for (const name of REQUIRED_ENV_VARS) {
    const value = env[name]
    if (!isSet(value)) {
      problems.push({ name, kind: 'missing', message: 'not set' })
      continue
    }
    present[name] = value
  }

  // Only shape-check what is actually present; a missing var is already
  // reported above and would otherwise be counted twice.
  const parsed = RequiredEnvSchema.partial().safeParse(present)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = String(issue.path[0])
      if (problems.some((p) => p.name === name)) continue
      problems.push({ name, kind: 'invalid', message: issue.message })
    }
  }

  const disabledFeatures: string[] = []
  const partialFeatures: Array<{ name: string; missing: string[] }> = []
  for (const feature of ENV_FEATURES) {
    const missing = feature.vars.filter((name) => !isSet(env[name]))
    if (missing.length === feature.vars.length) disabledFeatures.push(feature.name)
    else if (missing.length > 0) partialFeatures.push({ name: feature.name, missing })
  }

  return { ok: problems.length === 0, problems, disabledFeatures, partialFeatures }
}

/** The multi-line block reportEnvOnBoot prints and assertEnv throws with. */
export function formatEnvReport(report: EnvReport): string {
  const lines: string[] = []

  if (report.problems.length > 0) {
    lines.push(`Environment is not usable - ${report.problems.length} problem(s):`)
    for (const p of report.problems) lines.push(`  - ${p.name}: ${p.message}`)
  }

  for (const { name, missing } of report.partialFeatures) {
    const feature = ENV_FEATURES.find((f) => f.name === name)
    lines.push(`Partially configured: ${name} - missing ${missing.join(', ')}.`)
    if (feature) lines.push(`  Configure the rest or unset the others; ${feature.whenAbsent}.`)
  }

  for (const name of report.disabledFeatures) {
    const feature = ENV_FEATURES.find((f) => f.name === name)
    lines.push(`Disabled: ${name} - ${feature?.whenAbsent ?? 'not configured'}.`)
  }

  return lines.join('\n')
}

/**
 * Boot-time check.
 *
 * Throws only when a required variable is unusable *and* we are serving
 * production traffic. A development or test process still starts, because a
 * contributor working on export formatting should not need OAuth credentials
 * to run the app -- they just get told, loudly, what is missing.
 */
export function reportEnvOnBoot(env: EnvSource = process.env): EnvReport {
  const report = checkEnv(env)
  const text = formatEnvReport(report)

  if (!report.ok) {
    console.error(`[env]\n${text}`)
    // NEXT_PHASE is set while `next build` collects page data. The build runs
    // with a placeholder MONGODB_URI and no other secrets (see the Build step
    // in .github/workflows/ci.yml), so throwing there would fail every CI run
    // for an environment that is never asked to serve a request.
    const isBuild = env.NEXT_PHASE === 'phase-production-build'
    if (env.NODE_ENV === 'production' && !isBuild) {
      throw new Error(`Refusing to start: ${text}`)
    }
    return report
  }

  if (text) console.warn(`[env]\n${text}`)
  else console.log('[env] all required variables set')
  return report
}
