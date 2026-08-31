// lib/schemas/__tests__/mongoose-prototype-pollution.test.ts
// Regression guard for GHSA-664h-wqgq-64gw / CVE-2026-73562 (mongoose
// prototype pollution via __proto__-prefixed update paths, fixed in
// mongoose 9.7.2). Reproduces the advisory's own PoC directly against this
// project's installed mongoose version, so a future downgrade or lockfile
// regression is caught here instead of only by `npm audit` in CI.
import { describe, it, expect, afterEach } from 'vitest'
import mongoose from 'mongoose'

afterEach(() => {
  delete (Object.prototype as Record<string, unknown>).$fullPath
  delete (Object.prototype as Record<string, unknown>).$parentSchemaDocArray
})

describe('mongoose prototype-pollution guard (CVE-2026-73562)', () => {
  it('does not pollute Object.prototype via a __proto__-prefixed update path', () => {
    const Model =
      mongoose.models.__CveProbe ?? mongoose.model('__CveProbe', new mongoose.Schema({ name: String }))
    const malicious = JSON.parse('{"$set": {"__proto__.x": "anything"}}')
    const q = Model.updateOne({}, {})
    try {
      // Mirrors the advisory's own PoC, which calls this private method
      // directly — the vulnerability is in cast-time path resolution, before
      // any real query execution or DB connection is needed to observe it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(q as any)._castUpdate(malicious)
    } catch {
      // A patched mongoose may throw here for unrelated reasons (missing
      // query context this minimal repro doesn't set up) — what matters is
      // whether Object.prototype was mutated before that, not whether this
      // call succeeds end-to-end.
    }
    expect((Object.prototype as Record<string, unknown>).$fullPath).toBeUndefined()
  })
})
