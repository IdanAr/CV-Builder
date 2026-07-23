# Next.js 14 → 16 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 5 remaining `npm audit` high-severity findings (Next.js DoS/XSS/cache-poisoning advisories, `postcss`, `glob`'s CLI issue) by upgrading `next` from 14.2.35 to the 16.x line, going through 15 first, with the app fully working (auth, editor, export, application tracking) and the existing 825-test Vitest suite green at every step.

**Architecture:** No feature work — a two-step dependency + codemod migration (14→15, then 15→16), each step run through Next's official `@next/codemod` CLI, followed by manual fix-up of anything the codemod can't handle, followed by the full verification gate (lint, typecheck, test, build, manual smoke test). The highest-risk surface is `middleware.ts` + `auth.config.ts`: Next 16 renames `middleware.ts` → `proxy.ts` and changes its default runtime from Edge to Node.js, and Auth.js v5's documented middleware pattern predates that rename.

**Tech Stack:** Next.js 14.2.35 → 16.x, React 18 → 19 (App Router requires React 19 as of Next 15), `@next/codemod` CLI, existing Vitest 4 suite as the regression net, `next-auth@^5.0.0-beta.31` (Auth.js v5).

## Global Constraints

- All commands run from `cv-builder/` inside this worktree (`/Users/idan/Desktop/Personal/Claude/Code/CV-Builder/.claude/worktrees/nextjs-16-upgrade/cv-builder`) — the repo root `package.json` is an unrelated placeholder (see `CLAUDE.md`).
- Do not proceed to the next task with a red test suite, a failing typecheck, or a failing lint — fix in-task before committing. This mirrors what CI (`.github/workflows/ci.yml`) enforces: `npm run lint` → `npx tsc --noEmit` → `npm run test:run`, all must exit 0.
- Do not remove or alter the existing per-route `auth()` checks in any API route handler — they're defense-in-depth alongside the middleware gate (established in the `ci-middleware-fix` plan).
- `/api/auth/:path*` must never be added to the middleware/proxy matcher.
- Upgrade one major version at a time (14→15, verify, commit; 15→16, verify, commit) — do not jump straight to 16, per Next's own guidance for multi-major jumps.
- Compatibility already checked for this repo's key React-19-sensitive dependencies: `@react-pdf/renderer@4.5.1` supports React 19 since v4.1.0; `framer-motion@^12.42.2` supports React 19 (support landed at 12.0.0-alpha); `@dnd-kit/*` declares `peerDependencies: react >=16.8.0` (permits React 19, not yet explicitly tested upstream — verify via this repo's own drag-and-drop tests in Task 3/6). `radix-ui` and `ogl` are not expected to be React-version-sensitive (Radix ships React 19–compatible releases; `ogl` is a WebGL library with no React dependency).

---

### Task 1: Reinstall in the worktree and re-apply the non-breaking audit fixes

The worktree branched from `origin/main`, so it doesn't include the `npm audit fix` already applied (uncommitted) on the main checkout. Re-apply it here so this branch's baseline matches, before the major-version work begins.

**Files:**
- Modify: `cv-builder/package-lock.json`

- [ ] **Step 1: Confirm current audit state**

Run (from `cv-builder/`): `npm audit`
Expected: 11 vulnerabilities (9 high, 2 critical) — same as the pre-fix state on `main`, since this worktree installed fresh from `origin/main`.

- [ ] **Step 2: Apply the safe fixes**

Run: `npm audit fix`
Expected: exits with "5 high severity vulnerabilities" remaining (all tied to `next`/`postcss`/`glob`, fixable only via `--force` — these are what Tasks 2–7 resolve by upgrading `next` itself).

- [ ] **Step 3: Verify nothing broke**

Run: `npm run test:run`
Expected: `Test Files 97 passed (97)`, `Tests 825 passed (825)`.

- [ ] **Step 4: Commit**

```bash
git add cv-builder/package-lock.json
git commit -m "chore: apply non-breaking npm audit fixes"
```

---

### Task 2: Upgrade to Next.js 15 via the official codemod CLI

**Files:**
- Modify: `cv-builder/package.json`, `cv-builder/package-lock.json`
- Modify (codemod-generated, exact paths TBD by codemod output): any file under `cv-builder/app/` using `cookies()`, `headers()`, `draftMode()`, or route `params`/`searchParams` synchronously

**Interfaces:**
- Consumes: nothing from other tasks (first upgrade step).
- Produces: `next@15.x`, `react@19.x`, `react-dom@19.x` installed; codemods applied. Task 3 depends on this being a clean, committed state.

- [ ] **Step 1: Run the automated upgrade CLI**

Run (from `cv-builder/`):
```bash
npx @next/codemod@latest upgrade 15
```
This updates `next`, `react`, and `react-dom` to their v15-compatible versions in `package.json`, runs `npm install`, and applies the `next-async-request-api` codemod (converts synchronous `cookies()`/`headers()`/`draftMode()`/dynamic `params`/`searchParams` access to `await`ed calls, or wraps with `React.use()` where a typecast/manual-review comment is needed).

Expected: command exits 0; `cv-builder/package.json` now shows `"next": "^15.x"`, `"react": "^19.x"`, `"react-dom": "^19.x"`.

- [ ] **Step 2: Search for anything the codemod flagged for manual review**

Run: `grep -rn "// @next-codemod" app/ lib/ components/ 2>/dev/null || true`
Expected: either no matches, or a short list of files the codemod couldn't fully automate — read each one and manually convert the flagged access to `await`, matching the pattern already used in existing routes (e.g. `app/api/resumes/[id]/route.ts`, which already types `params` as `Promise<{ id: string }>` and awaits it).

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors. If errors appear, they are almost always the remaining sync-to-async dynamic API conversions the codemod missed — fix by awaiting the flagged call at its call site.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: same pre-existing warnings as the Task 1 baseline (`components/ui/Plasma.tsx` ref-cleanup warning, `UserProfileButton.test.tsx` `<img>` warning, `UserProfileButton.tsx` ref-cleanup warning), no new errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test:run`
Expected: `825 passed`. If any test fails, read the failure — the most likely causes at this step are (a) a route handler test asserting on a synchronous `params` shape that the codemod changed to async (update the test's mock to `Promise.resolve({...})`, matching the existing pattern in `middleware.test.ts` and `app/api/applications/[id]/route.test.ts`), or (b) a caching-default change (Next 15 makes `fetch()` and GET route handlers uncached by default) breaking a test that assumed a cached response — trace the specific assertion and adjust.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: exits 0, no build-time errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: upgrade to Next.js 15 and React 19 via @next/codemod"
```

---

### Task 3: Manual smoke test on Next.js 15

Codemods and the test suite don't cover everything — the live-preview render path (`@react-pdf/renderer`), drag-and-drop (`@dnd-kit`), and the auth redirect flow are the specific areas flagged as compatibility-sensitive in the Global Constraints.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: starts cleanly on `localhost:3000`, no SWC/native-binary errors, no console errors on first load.

- [ ] **Step 2: Walk the golden path**

Using a browser (or the `claude-in-chrome` tools if available): sign in via GitHub or Google → open the résumé editor → make an edit (confirm live preview updates and autosave fires) → drag-reorder a section (confirms `@dnd-kit` still works under React 19) → export a PDF in both `designed` and `ats` mode (confirms `@react-pdf/renderer` renders under React 19) → visit `/dashboard/applications`, drag a card between board lanes (confirms `@dnd-kit` board interactions).

Expected: no runtime errors in the browser console, no broken interactions. If `@dnd-kit` drag interactions are visibly broken (the one dependency without confirmed React 19 support upstream), stop and report — this would block proceeding to Task 4 until resolved or an alternative confirmed.

- [ ] **Step 3: Stop the dev server, no commit needed for this task** (verification-only)

---

### Task 4: Upgrade to Next.js 16 via the official codemod CLI

**Files:**
- Modify: `cv-builder/package.json`, `cv-builder/package-lock.json`
- Modify: `cv-builder/middleware.ts` → renamed to `cv-builder/proxy.ts`
- Modify: `cv-builder/middleware.test.ts` → renamed to `cv-builder/proxy.test.ts`

**Interfaces:**
- Consumes: the Next 15 state committed in Task 2.
- Produces: `next@16.x` installed, `proxy.ts` replacing `middleware.ts`. Task 5 depends on this.

- [ ] **Step 1: Run the automated upgrade CLI**

Run (from `cv-builder/`):
```bash
npx @next/codemod@latest upgrade 16
```
Expected: updates `next` to `^16.x` in `package.json`, runs `npm install`, and applies available v16 codemods (removing `unstable_` prefixes from now-stable APIs, migrating any remaining sync dynamic-API access, migrating `next.config.js`/`next.config.mjs` Turbopack options if present).

- [ ] **Step 2: Rename `middleware.ts` to `proxy.ts`**

Next 16 deprecates the `middleware.ts` convention in favor of `proxy.ts` (same matcher-based config, but the file/export convention changes and the default runtime moves from Edge to Node.js — check whether the codemod handled this rename automatically first; if `cv-builder/middleware.ts` still exists after Step 1, do it manually).

Read the current file first:
```bash
cat cv-builder/middleware.ts
```
It currently reads:
```typescript
import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/resumes/:path*',
    '/api/applications/:path*',
    '/api/preview/:path*',
  ],
}
```

Create `cv-builder/proxy.ts` with the same logic under the v16 convention — consult the fetched Next 16 upgrade guide for the exact export name required (`proxy` export replacing `middleware`), keep the `authConfig` import and matcher identical, then delete the old `cv-builder/middleware.ts`.

- [ ] **Step 3: Check for an Auth.js v5 / Next 16 peer-dependency conflict**

Run: `npm ls next-auth`
Expected: resolves cleanly. If `npm install` in Step 1 produced peer-dependency warnings or errors for `next-auth`, check the installed `next-auth` version against Auth.js's current Next 16 guidance — if a newer `next-auth@5.x` stable/beta release with confirmed Next 16 + `proxy.ts` support exists, upgrade it explicitly:
```bash
npm install next-auth@latest
```
and re-run Step 2's rename against the updated API if the export name changed.

- [ ] **Step 4: Update the test file to match the rename**

Rename `cv-builder/middleware.test.ts` to `cv-builder/proxy.test.ts`, updating only the import path (`./middleware` → `./proxy`) and the `describe` block title; the assertions themselves (matcher contents, no `/api/auth/:path*` entry) stay the same:

```typescript
// cv-builder/proxy.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ auth: vi.fn() })),
}))
vi.mock('next-auth/providers/github', () => ({ default: vi.fn() }))
vi.mock('next-auth/providers/google', () => ({ default: vi.fn() }))

describe('proxy matcher', () => {
  it('covers /dashboard, /api/resumes, /api/applications, and /api/preview', async () => {
    const { config } = await import('./proxy')
    expect(config.matcher).toEqual([
      '/dashboard/:path*',
      '/api/resumes/:path*',
      '/api/applications/:path*',
      '/api/preview/:path*',
    ])
  })

  it('does not include the OAuth handshake route', async () => {
    const { config } = await import('./proxy')
    expect(config.matcher).not.toContain('/api/auth/:path*')
  })
})
```

- [ ] **Step 5: Run this test in isolation first**

Run: `npx vitest run proxy.test.ts`
Expected: PASS, 2 tests. If it fails on the mock not matching the new file's actual imports (e.g. if the v16 `proxy.ts` convention imports something beyond `next-auth`/`authConfig`), adjust the `vi.mock` calls to match what `proxy.ts` actually imports — same principle as the original `middleware.test.ts` comment explains (mock next-auth internals so only the local `config` export gets evaluated).

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: same baseline warnings as Task 2 Step 4, no new errors.

- [ ] **Step 8: Run the full test suite**

Run: `npm run test:run`
Expected: `825 passed` (same count — `middleware.test.ts`'s 2 tests now live in `proxy.test.ts`, no net change).

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: upgrade to Next.js 16, migrate middleware.ts to proxy.ts"
```

---

### Task 5: Manual smoke test on Next.js 16, with emphasis on auth

Task 4 touches the auth gate directly (`proxy.ts` replacing `middleware.ts`) — this is the task where an auth regression is most likely to surface, and it's the one class of bug the automated test suite mocks around (see the `middleware.test.ts`/`proxy.test.ts` comment: next-auth internals are mocked out, so the test only proves the matcher list, not that Auth.js actually authenticates through the new file under real Next.js routing).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: starts cleanly, no errors about `proxy.ts` not being recognized.

- [ ] **Step 2: Test the auth gate specifically**

- Visit `/dashboard` while signed out → expect a redirect to `/signin` (proves `proxy.ts`'s `authorized` callback still gates the route).
- Sign in via GitHub or Google → expect a successful redirect back to `/dashboard`.
- With `curl` or the browser network tab, hit `/api/resumes` while signed out → expect `401` with `{ error: 'Unauthorized', code: 'UNAUTHORIZED' }` (proves the per-route `auth()` checks still work independently of the proxy gate, per the Global Constraints defense-in-depth requirement).
- Confirm `/api/auth/...` (the OAuth handshake itself) is still reachable while signed out (it must never be behind the proxy matcher).

Expected: all four checks pass. If the redirect-to-signin loop breaks or `/api/auth` becomes gated, this is the single highest-priority thing to fix before proceeding — re-check the matcher list in `proxy.ts` and the `authorized` callback in `auth.config.ts`.

- [ ] **Step 3: Re-run the same golden path as Task 3**

Editor edit → live preview → drag-reorder → PDF export (both modes) → applications board drag-and-drop.

Expected: same as Task 3 — no regressions introduced by the React 19 / Next 16 combination specifically (Task 3 already validated React 19; this pass is a regression check, not a new compatibility check).

---

### Task 6: Final audit verification

**Files:**
- None modified — verification only.

- [ ] **Step 1: Confirm the vulnerabilities are resolved**

Run (from `cv-builder/`): `npm audit`
Expected: `found 0 vulnerabilities`. The 5 that were only fixable via `--force` in the original report (`next`, `postcss`, `glob`'s CLI issue) should now be resolved as a side effect of `next` itself being on 16.x, which pulls in patched transitive versions.

- [ ] **Step 2: If any vulnerabilities remain**

Run: `npm audit fix` (non-breaking only — do not use `--force` again without checking what it would change first, since we're already past the breaking upgrade this was gating on).

- [ ] **Step 3: Full verification gate one more time**

Run in sequence, confirm each exits 0:
```bash
npm run lint
npx tsc --noEmit
npm run test:run
npm run build
```

- [ ] **Step 4: Commit if Step 2 changed the lockfile**

```bash
git add cv-builder/package-lock.json
git commit -m "chore: final npm audit cleanup post Next.js 16 upgrade"
```

---

## Plan Self-Review Notes

- **Spec coverage**: incremental 14→15→16 upgrade ✅ (Tasks 2, 4), codemod usage ✅ (Tasks 2 Step 1, 4 Step 1), `middleware.ts`→`proxy.ts` migration flagged as highest-risk and given its own dedicated steps with the exact current file contents shown ✅ (Task 4 Steps 2–5), React 19 dependency compatibility pre-checked for the repo's actual dependencies rather than left as a vague TODO ✅ (Global Constraints), auth regression risk called out explicitly with concrete manual checks since the test suite mocks around it ✅ (Task 5 Step 2), final audit resolution verified against the original 5-vulnerability gap ✅ (Task 6).
- **Placeholder scan**: no "TBD"/"handle appropriately"-style filler. Two spots necessarily reference "consult the fetched upgrade guide" (Task 4 Step 2) and "codemod output, exact paths TBD" (Task 2 file list) because the precise codemod diff can't be known until it's actually run against this codebase — this is inherent to a major-version migration, not a plan gap, and each such spot is paired with a concrete verification command (`grep`, `tsc --noEmit`, `test:run`) that will surface exactly what needs fixing.
- **Type consistency**: `proxy.ts`'s matcher array and the `proxy.test.ts` assertions use identical string literals to the current `middleware.ts`/`middleware.test.ts` pair (verified against the actual file contents read from the repo, not reconstructed from memory).
