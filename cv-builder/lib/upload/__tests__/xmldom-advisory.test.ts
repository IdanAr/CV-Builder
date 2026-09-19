// Regression guard for the @xmldom/xmldom advisories fixed in 0.8.14 —
// GHSA-x4fp-j954-r2f4 (end-tag whitespace-trim ReDoS), GHSA-93r5-fhx6-vmg9
// (quadratic-time parsing via the malformed-input recovery path) and
// GHSA-965w-775f-mr7g (quadratic memory).
//
// This matters here specifically because mammoth.extractRawText() in
// lib/upload/parse-file.ts feeds it *untrusted* user-uploaded .docx bytes,
// and that function's try/catch cannot contain these: a CPU- or
// memory-exhaustion hang is not a thrown error. On a serverless function
// that burns billed wall-clock time until the platform kills it.
//
// A timing-based reproduction of the advisories' own PoCs would be flaky in
// CI, so this pins the version floor instead. `npm audit` is deliberately
// not a CI step (the remaining Next.js advisory needs `--force` and an
// out-of-range upgrade), which means nothing else in this repo would notice
// a lockfile regression that reintroduced a vulnerable xmldom.
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const FIXED_IN: readonly [number, number, number] = [0, 8, 14]

function parseVersion(v: string): [number, number, number] {
  const [major, minor, patch] = v.split('-')[0].split('.').map(Number)
  return [major, minor, patch]
}

function isAtLeast(actual: [number, number, number], min: readonly [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (actual[i] > min[i]) return true
    if (actual[i] < min[i]) return false
  }
  return true
}

describe('@xmldom/xmldom advisory floor (DOCX upload parsing)', () => {
  it('resolves a version at or above the patched 0.8.14 from mammoth', () => {
    // Resolve the way mammoth itself would, rather than assuming the package
    // stays hoisted to the top level of node_modules.
    const req = createRequire(import.meta.url)
    const fromMammoth = createRequire(req.resolve('mammoth'))
    const { version } = fromMammoth('@xmldom/xmldom/package.json') as { version: string }

    expect(isAtLeast(parseVersion(version), FIXED_IN)).toBe(true)
  })

  // Without this, the assertion above would still pass if the comparison were
  // wrong — a version floor that cannot fail guards nothing.
  it('rejects the versions the advisories actually affect', () => {
    expect(isAtLeast(parseVersion('0.8.13'), FIXED_IN)).toBe(false)
    expect(isAtLeast(parseVersion('0.7.99'), FIXED_IN)).toBe(false)
    expect(isAtLeast(parseVersion('0.8.14'), FIXED_IN)).toBe(true)
    expect(isAtLeast(parseVersion('0.9.0'), FIXED_IN)).toBe(true)
  })
})
