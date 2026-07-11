# CI Pipeline + Middleware Auth Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions CI pipeline (lint + typecheck + test, required on every PR and push to `main`) and close the auth-middleware coverage gap on `/api/applications/*` and `/api/preview/*`, backed by explicit unauthenticated-request test coverage.

**Architecture:** No new runtime code paths — this is entirely test coverage, one config-array edit, and one new workflow file. Test coverage comes first (establishes a safety net proving the existing per-route `auth()` checks work before the blanket middleware gate is added), then the middleware matcher is widened, then CI is added to enforce both going forward.

**Tech Stack:** Vitest 4 (existing `vi.mock` pattern for `@/lib/auth`), Next.js 14 middleware config, GitHub Actions.

## Global Constraints

- App source lives in `cv-builder/` (repo root `package.json` is an unrelated placeholder) — every `npm`/`npx` command and every CI step runs with working directory `cv-builder/`.
- Node version for CI: 20.x (matches `@types/node ^20` in `cv-builder/package.json`).
- Do not remove or alter the existing per-route `auth()` checks in any route handler — they stay as defense-in-depth.
- `/api/auth/:path*` must never be added to the middleware matcher — it's the OAuth handshake endpoint and must stay public.
- Follow the existing test mock pattern already used in `app/api/preview/pagination/route.test.ts`: a module-level mutable `mockSession` variable that `vi.mock('@/lib/auth', ...)` reads on each call, reset to an authenticated default in `afterEach`.
- Every route's `apiError('UNAUTHORIZED', 'Unauthorized', 401)` response body has shape `{ error: 'Unauthorized', code: 'UNAUTHORIZED' }` — assert on `.code`, not just `.status`.

---

### Task 1: Add unauthenticated-request tests for `/api/applications` (GET, POST)

**Files:**
- Create: `cv-builder/app/api/applications/route.test.ts`

**Interfaces:**
- Consumes: `GET`, `POST` exports from `cv-builder/app/api/applications/route.ts` (existing, unchanged — both already check `req.auth?.user?.id` and return `apiError('UNAUTHORIZED', 'Unauthorized', 401)` before touching the body).
- Produces: nothing consumed by later tasks — this is a leaf test file.

- [ ] **Step 1: Write the test file**

```typescript
// cv-builder/app/api/applications/route.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/applications', () => ({
  listApplications: vi.fn(),
  createApplication: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'user-1' } }
})

describe('GET /api/applications', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { GET } = await import('./route')
    const res = (await GET(new Request('http://localhost/api/applications') as never, {} as never)) as Response
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('UNAUTHORIZED')
  })
})

describe('POST /api/applications', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/applications', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = (await POST(req as never, {} as never)) as Response
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('UNAUTHORIZED')
  })
})
```

- [ ] **Step 2: Run the test**

Run (from `cv-builder/`): `npx vitest run app/api/applications/route.test.ts`
Expected: PASS, 2 tests (the route already implements the auth check — this is regression-coverage for existing behavior, not new production code, so it should pass immediately).

- [ ] **Step 3: Commit**

```bash
git add cv-builder/app/api/applications/route.test.ts
git commit -m "test: add unauthenticated-request coverage for /api/applications"
```

---

### Task 2: Add unauthenticated-request tests for `/api/applications/[id]` (PATCH, DELETE)

**Files:**
- Modify: `cv-builder/app/api/applications/[id]/route.test.ts`

**Interfaces:**
- Consumes: `PATCH`, `DELETE` exports from `cv-builder/app/api/applications/[id]/route.ts` (existing, unchanged).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace the hardcoded auth mock with the mutable-session pattern, and add the two 401 tests**

Replace the full contents of `cv-builder/app/api/applications/[id]/route.test.ts` with:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/applications', () => ({
  patchApplication: vi.fn(),
  deleteApplication: vi.fn(),
  listActivity: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'user-1' } }
})

describe('PATCH /api/applications/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/a1', {
      method: 'PATCH',
      body: JSON.stringify({ company: 'Acme' }),
    })
    const res = (await PATCH(req as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('UNAUTHORIZED')
  })

  it('validates the body and returns 400 on a bad patch', async () => {
    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/a1', {
      method: 'PATCH',
      body: JSON.stringify({ customFields: { 'col-1': { nested: true } } }),
    })
    const res = (await PATCH(req as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when the application does not exist', async () => {
    const { patchApplication } = await import('@/lib/api/applications')
    vi.mocked(patchApplication).mockResolvedValueOnce(null)

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/a1', {
      method: 'PATCH',
      body: JSON.stringify({ company: 'Acme' }),
    })
    const res = (await PATCH(req as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response
    expect(res.status).toBe(404)
  })

  it('passes the parsed patch through and returns the updated application', async () => {
    const { patchApplication } = await import('@/lib/api/applications')
    vi.mocked(patchApplication).mockResolvedValueOnce({ _id: 'a1', company: 'Globex' } as never)

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/a1', {
      method: 'PATCH',
      body: JSON.stringify({ company: 'Globex', status: 'offer' }),
    })
    const res = (await PATCH(req as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response

    expect(res.status).toBe(200)
    expect(patchApplication).toHaveBeenCalledWith('user-1', 'a1', {
      company: 'Globex',
      status: 'offer',
    })
  })

  it('returns 404 (not 500) for a malformed ObjectId (CastError)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { patchApplication } = await import('@/lib/api/applications')
    const castError = Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' })
    vi.mocked(patchApplication).mockRejectedValueOnce(castError)

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/nope', {
      method: 'PATCH',
      body: JSON.stringify({ company: 'X' }),
    })
    const res = (await PATCH(req as never, {
      params: Promise.resolve({ id: 'nope' }),
    } as never)) as Response
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/applications/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/applications/a1', { method: 'DELETE' })
    const res = (await DELETE(req as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('UNAUTHORIZED')
  })

  it('returns success when deleted and 404 when missing', async () => {
    const { deleteApplication } = await import('@/lib/api/applications')
    vi.mocked(deleteApplication).mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    const { DELETE } = await import('./route')
    const makeReq = () =>
      new Request('http://localhost/api/applications/a1', { method: 'DELETE' })

    const ok = (await DELETE(makeReq() as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response
    expect(ok.status).toBe(200)

    const missing = (await DELETE(makeReq() as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response
    expect(missing.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the test**

Run (from `cv-builder/`): `npx vitest run "app/api/applications/[id]/route.test.ts"`
Expected: PASS, 7 tests (5 pre-existing + 2 new 401 tests).

- [ ] **Step 3: Commit**

```bash
git add "cv-builder/app/api/applications/[id]/route.test.ts"
git commit -m "test: add unauthenticated-request coverage for /api/applications/[id]"
```

---

### Task 3: Add unauthenticated-request tests for `/api/applications/board-config` (GET, PATCH)

**Files:**
- Modify: `cv-builder/app/api/applications/board-config/route.test.ts`

**Interfaces:**
- Consumes: `GET`, `PATCH` exports from `cv-builder/app/api/applications/board-config/route.ts` (existing, unchanged).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace the hardcoded auth mock with the mutable-session pattern, and add the two 401 tests**

Replace the full contents of `cv-builder/app/api/applications/board-config/route.test.ts` with:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

const { mockFindOne, mockCreate, mockFindOneAndUpdate } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockCreate: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/models/BoardConfig', () => ({
  default: {
    findOne: mockFindOne,
    create: mockCreate,
    findOneAndUpdate: mockFindOneAndUpdate,
  },
}))

import { defaultBoardColumns } from '@/lib/schemas/application.zod'

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'user-1' } }
})

describe('GET /api/applications/board-config', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { GET } = await import('./route')
    const res = (await GET(
      new Request('http://localhost/api/applications/board-config') as never,
      {} as never
    )) as Response
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('UNAUTHORIZED')
  })

  it('auto-creates and returns the default config on first call', async () => {
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const created = { userId: 'user-1', columns: defaultBoardColumns(), sort: [] }
    mockCreate.mockResolvedValue({ toObject: () => created })

    const { GET } = await import('./route')
    const res = (await GET(
      new Request('http://localhost/api/applications/board-config') as never,
      {} as never
    )) as Response

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.boardConfig.columns.map((c: { key: string }) => c.key)).toEqual([
      'company',
      'role',
      'status',
      'resumeId',
      'createdAt',
    ])
  })
})

describe('PATCH /api/applications/board-config', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/board-config', {
      method: 'PATCH',
      body: JSON.stringify({ sort: [] }),
    })
    const res = (await PATCH(req as never, {} as never)) as Response
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('UNAUTHORIZED')
  })

  it('returns 400 with the invariant message when a built-in column is deleted', async () => {
    const { PATCH } = await import('./route')
    const columns = defaultBoardColumns().filter((c) => c.id !== 'company')
    const req = new Request('http://localhost/api/applications/board-config', {
      method: 'PATCH',
      body: JSON.stringify({ columns }),
    })

    const res = (await PATCH(req as never, {} as never)) as Response

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/built-in/i)
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 on a shape-invalid body', async () => {
    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/board-config', {
      method: 'PATCH',
      body: JSON.stringify({ sort: [{ columnId: 'x', direction: 'sideways' }] }),
    })
    const res = (await PATCH(req as never, {} as never)) as Response
    expect(res.status).toBe(400)
  })

  it('persists a valid sort patch', async () => {
    mockFindOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ userId: 'user-1', columns: [], sort: [] }),
    })

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/applications/board-config', {
      method: 'PATCH',
      body: JSON.stringify({ sort: [{ columnId: 'company', direction: 'desc' }] }),
    })
    const res = (await PATCH(req as never, {} as never)) as Response

    expect(res.status).toBe(200)
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1' },
      { $set: { sort: [{ columnId: 'company', direction: 'desc' }] } },
      { new: true }
    )
  })
})
```

- [ ] **Step 2: Run the test**

Run (from `cv-builder/`): `npx vitest run app/api/applications/board-config/route.test.ts`
Expected: PASS, 6 tests (4 pre-existing + 2 new 401 tests).

- [ ] **Step 3: Commit**

```bash
git add cv-builder/app/api/applications/board-config/route.test.ts
git commit -m "test: add unauthenticated-request coverage for /api/applications/board-config"
```

---

### Task 4: Add unauthenticated-request test for `/api/applications/[id]/activity` (GET)

**Files:**
- Create: `cv-builder/app/api/applications/[id]/activity/route.test.ts`

**Interfaces:**
- Consumes: `GET` export from `cv-builder/app/api/applications/[id]/activity/route.ts` (existing, unchanged).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the test file**

```typescript
// cv-builder/app/api/applications/[id]/activity/route.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/applications', () => ({
  listActivity: vi.fn(),
}))

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  mockSession = { user: { id: 'user-1' } }
})

describe('GET /api/applications/[id]/activity', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/applications/a1/activity')
    const res = (await GET(req as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('UNAUTHORIZED')
  })

  it('returns the activity list when authenticated', async () => {
    const { listActivity } = await import('@/lib/api/applications')
    vi.mocked(listActivity).mockResolvedValueOnce([{ type: 'created' }] as never)

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/applications/a1/activity')
    const res = (await GET(req as never, {
      params: Promise.resolve({ id: 'a1' }),
    } as never)) as Response

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.activity).toEqual([{ type: 'created' }])
  })
})
```

- [ ] **Step 2: Run the test**

Run (from `cv-builder/`): `npx vitest run "app/api/applications/[id]/activity/route.test.ts"`
Expected: PASS, 2 tests.

- [ ] **Step 3: Commit**

```bash
git add "cv-builder/app/api/applications/[id]/activity/route.test.ts"
git commit -m "test: add unauthenticated-request coverage for /api/applications/[id]/activity"
```

---

### Task 5: Widen the auth middleware matcher

**Files:**
- Modify: `cv-builder/middleware.ts`
- Create: `cv-builder/middleware.test.ts`

**Interfaces:**
- Consumes: `config` export from `cv-builder/middleware.ts`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

```typescript
// cv-builder/middleware.test.ts
import { describe, it, expect } from 'vitest'
import { config } from './middleware'

describe('middleware matcher', () => {
  it('covers /dashboard, /api/resumes, /api/applications, and /api/preview', () => {
    expect(config.matcher).toEqual([
      '/dashboard/:path*',
      '/api/resumes/:path*',
      '/api/applications/:path*',
      '/api/preview/:path*',
    ])
  })

  it('does not include the OAuth handshake route', () => {
    expect(config.matcher).not.toContain('/api/auth/:path*')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `cv-builder/`): `npx vitest run middleware.test.ts`
Expected: FAIL — first assertion fails because the current matcher is `['/dashboard/:path*', '/api/resumes/:path*']` (only 2 entries, not 4).

- [ ] **Step 3: Widen the matcher**

Replace the full contents of `cv-builder/middleware.ts` with:

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

- [ ] **Step 4: Run the test to verify it passes**

Run (from `cv-builder/`): `npx vitest run middleware.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run (from `cv-builder/`): `npm run test:run`
Expected: PASS, all suites (including the four files from Tasks 1–4).

- [ ] **Step 6: Commit**

```bash
git add cv-builder/middleware.ts cv-builder/middleware.test.ts
git commit -m "fix: widen auth middleware matcher to cover applications and preview API routes"
```

---

### Task 6: Add GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run lint`, `npm run test:run` scripts from `cv-builder/package.json` (existing, unchanged); `tsc` via `npx tsc --noEmit` (no new script needed — `cv-builder/tsconfig.json` already has `"noEmit": true`).
- Produces: a required GitHub status check named `build` (job id) for use in branch protection.

- [ ] **Step 1: Write the workflow file**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: cv-builder
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: cv-builder/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npm run test:run
```

- [ ] **Step 2: Verify each command locally before pushing**

Run (from `cv-builder/`), confirm each exits 0:
```bash
npm run lint
npx tsc --noEmit
npm run test:run
```
Expected: all three exit 0 with no errors — this is what CI will run, so a local failure here means CI would fail too and should be fixed before proceeding.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint, typecheck, and test workflow for PRs and pushes to main"
```

- [ ] **Step 4: Push and verify the workflow runs**

Push the branch and open a PR against `main`. In the GitHub Actions tab, confirm the `CI` workflow triggers and the `build` job completes with all four steps (checkout, install, lint, typecheck, test) green.

- [ ] **Step 5: (Manual, requires your go-ahead) Enable branch protection**

This step changes a repo-wide setting and is **not done automatically** — confirm with the user first. Once confirmed:

```bash
gh api repos/IdanAr/CV-Builder/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["build"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews=null \
  --field restrictions=null
```

Verify: `gh api repos/IdanAr/CV-Builder/branches/main/protection --jq '.required_status_checks.contexts'` returns `["build"]`.

---

## Plan Self-Review Notes

- **Spec coverage**: CI workflow (Task 6) ✅, middleware matcher widening (Task 5) ✅, branch protection as an explicit-confirmation manual step (Task 6 Step 5) ✅. The spec's original claim that applications routes already had unauthenticated-request test coverage was **incorrect** — verified during planning that `app/api/applications/route.ts` and `app/api/applications/[id]/activity/route.ts` had no test files at all, and `[id]/route.test.ts` / `board-config/route.test.ts` hardcoded an always-authenticated mock. Tasks 1–4 correct this gap; without them, Task 5's middleware change would be widening a gate with no test evidence the routes behind it actually enforce auth.
- **Placeholder scan**: none found — every step has complete, runnable code.
- **Type consistency**: `mockSession` shape (`{ user: { id: string } } | null`) and the `vi.mock('@/lib/auth', ...)` wrapper are identical across Tasks 1–4, matching the pre-existing pattern in `app/api/preview/pagination/route.test.ts`.
