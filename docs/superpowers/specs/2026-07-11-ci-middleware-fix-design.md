# CI Pipeline + Middleware Auth Coverage — Design Spec
Date: 2026-07-11
Branch: feature/ci-middleware-fix

## Problem Statement

Two structural gaps identified in a codebase health review:

1. **No CI pipeline.** The repo has 228 commits over 5.5 weeks (~40 commits/week) and 94 test files, but nothing automated runs lint, type-check, or tests before code lands on `main`. Regressions are only caught if a developer remembers to run checks locally.
2. **Incomplete auth middleware coverage.** `middleware.ts`'s matcher covers `/dashboard/:path*` and `/api/resumes/:path*`, but not `/api/applications/:path*` or `/api/preview/:path*`. Those routes are currently safe — each handler individually calls `auth()` — but protection depends entirely on every future route author remembering to add that check themselves, rather than a blanket gate.

## Scope

### In scope
- New GitHub Actions workflow: lint + type-check + test on every PR and every push to `main`.
- Widen `middleware.ts`'s `matcher` to add `/api/applications/:path*` and `/api/preview/:path*`.
- (Optional, only with explicit go-ahead at implementation time) Enable branch protection on `main` requiring the CI check to pass before merge.

### Out of scope
- Removing or refactoring the existing per-route `auth()` checks — they stay as defense-in-depth, untouched.
- `next build` as a CI step (deferred — lint + typecheck + tests already cover the regressions seen in this repo's history; a full build step can be added later if build-only failures start occurring).
- Rate limiter production-safety fix (separate, already-identified issue — not part of this spec).
- Job-description tailoring feature (separate spec, planned next).

## Architecture

### CI Workflow

New file: `.github/workflows/ci.yml`.

- **Triggers**: `pull_request` (any branch targeting `main`) and `push` to `main`.
- **Job**: single job, sequential steps (the app is small enough that splitting into parallel jobs wouldn't meaningfully reduce wall-clock time, and a single job keeps the workflow simple to read/maintain):
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4`, Node version pinned to match `@types/node ^20` (Node 20.x), with built-in npm caching (`cache: 'npm'`, `cache-dependency-path: cv-builder/package-lock.json`)
  3. `npm ci` — working directory `cv-builder/` (that's where `package.json` lives; the repo-root `package.json` is a placeholder)
  4. `npm run lint`
  5. `tsc --noEmit`
  6. `npm run test:run`
- Any step failing fails the job; GitHub shows a red X on the PR/commit.

### Branch Protection

Enabling "require status checks to pass before merging" on `main` is a GitHub repo-settings change, not a file in the repo — it's applied via the GitHub UI (Settings → Branches) or `gh api repos/{owner}/{repo}/branches/main/protection`, at implementation time, with explicit confirmation before it's applied (it changes how every future push/merge to `main` behaves for anyone with write access).

### Middleware Fix

`middleware.ts`:

```diff
 export const config = {
-  matcher: ['/dashboard/:path*', '/api/resumes/:path*'],
+  matcher: ['/dashboard/:path*', '/api/resumes/:path*', '/api/applications/:path*', '/api/preview/:path*'],
 }
```

`/api/auth/:path*` deliberately stays uncovered — it's the OAuth handshake endpoint itself and must remain publicly reachable.

No other files change. Existing per-route `auth()` checks inside `app/api/applications/**/route.ts` and `app/api/preview/pagination/route.ts` are left in place unchanged.

## Testing

- CI workflow: verified by opening a throwaway PR (or pushing a deliberately broken commit to a branch) and confirming the workflow triggers and reports status correctly; no new test files needed since this isn't application code.
- Middleware: existing route-handler tests already cover the auth-required behavior of the newly-matched routes (verified in the codebase review — each handler has test coverage for the unauthenticated-request case). No new tests required; this is confirmed by running the existing suite after the matcher change and confirming no regressions.
