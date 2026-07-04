# True PDF Preview Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Live Preview's page dividers and page count reflect the *actual* `@react-pdf/renderer` pagination of the exported PDF — not an estimate — while keeping the instant HTML preview for every keystroke.

**Architecture:** A debounced (1.2s after typing stops) client hook POSTs the current editor state to a new server endpoint that renders the real PDF through the *exact same pipeline as export* (`selectPdfTemplate` → `renderToBuffer`), extracts per-page ground truth (page count + the first text of each page) using `pdf-parse` (already a dependency), and returns it. The client locates each page-start text inside the HTML preview DOM (normalized substring match + `Range` line geometry) and pins the divider to that exact line. Until truth arrives — or wherever a text anchor can't be located (e.g. two-column flows) — dividers fall back to the existing margin-aware estimate from `lib/preview-pagination.ts`, visually distinguished (dashed "≈ Page N" vs. solid "Page N").

**Tech Stack:** Next.js 14 route handler, `@react-pdf/renderer` `renderToBuffer` (server), `pdf-parse` v2 `PDFParse.getText()` (per-page text, already installed), Zod validation, existing token-bucket rate limiter, React hook with `AbortController`, DOM `TreeWalker` + `Range` for anchor geometry, Vitest (jsdom).

## Global Constraints

- **Never trigger `@react-pdf/renderer` on a keystroke** (CLAUDE.md): the PDF render is server-side and fires only ≥1200ms after the last edit; the HTML preview stays the instant mirror.
- **The visual layer is a consumer of JSON data** — this feature reads `{data, meta}` and renders; it never transforms the schema.
- **No new npm dependencies.** `pdf-parse@^2.4.5` is already installed and already in `next.config.mjs` `serverComponentsExternalPackages`.
- All new code in `cv-builder/` follows existing conventions: `@/` path alias, Vitest, colocated `route.test.ts` for routes, `lib/__tests__/` for lib modules.
- API route conventions: `auth()` wrapper, `apiError`/`handleRouteError` from `@/lib/api/route-errors`, `checkRateLimit` from `@/lib/rate-limit`.
- Run all commands from the `cv-builder/` directory.
- Commit directly to `main` (repo convention). End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Why anchors, not coordinates

The PDF and the HTML preview are two different layout engines; a page break at "Y pt on page 3" is meaningless in the HTML flow. But the *content* is identical in both. So the server reports "page 4 starts with the text «managed human resources within…»", and the client finds that exact text in the preview DOM and draws the divider at that line's pixel. Text is the only coordinate system the two renderers share.

Matching is done on a **match key**: lowercased text with whitespace, hyphens (react-pdf hyphenates line ends), soft hyphens, and bullet glyphs removed. This makes the comparison immune to the two engines' different line-breaking and whitespace assembly.

---

### Task 1: Shared anchor normalization

**Files:**
- Modify: `cv-builder/lib/preview-pagination.ts`
- Test: `cv-builder/lib/__tests__/preview-pagination.test.ts` (extend existing file)

**Interfaces:**
- Consumes: nothing new.
- Produces: `normalizeAnchorText(s: string): string`, `toMatchKey(s: string): string`, `ANCHOR_MAX_CHARS: number` — used by Task 2 (server) and Task 4 (client).

- [ ] **Step 1: Write the failing tests**

Append to `cv-builder/lib/__tests__/preview-pagination.test.ts`:

```ts
import { normalizeAnchorText, toMatchKey, ANCHOR_MAX_CHARS } from '@/lib/preview-pagination'

describe('normalizeAnchorText', () => {
  it('lowercases and collapses whitespace runs', () => {
    expect(normalizeAnchorText('Israeli  Navy\n Commando')).toBe('israeli navy commando')
  })

  it('strips bullets, hyphens, and soft hyphens', () => {
    expect(normalizeAnchorText('• Data-driven ­platform')).toBe('datadriven platform')
  })

  it('trims leading/trailing whitespace', () => {
    expect(normalizeAnchorText('  hello world  ')).toBe('hello world')
  })
})

describe('toMatchKey', () => {
  it('removes all spaces on top of normalization', () => {
    expect(toMatchKey('Data - Driven  Platform')).toBe('datadrivenplatform')
  })

  it('is stable for already-normalized input', () => {
    expect(toMatchKey(toMatchKey('Some Text'))).toBe(toMatchKey('Some Text'))
  })
})

describe('ANCHOR_MAX_CHARS', () => {
  it('is long enough to be unique but bounded', () => {
    expect(ANCHOR_MAX_CHARS).toBeGreaterThanOrEqual(80)
    expect(ANCHOR_MAX_CHARS).toBeLessThanOrEqual(200)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/preview-pagination.test.ts`
Expected: FAIL — `normalizeAnchorText` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `cv-builder/lib/preview-pagination.ts`:

```ts
/** Max characters of normalized page-start text sent as an anchor. */
export const ANCHOR_MAX_CHARS = 120

/**
 * Normalizes text so PDF-extracted strings and DOM textContent compare equal:
 * lowercase; strip soft hyphens, bullet glyphs, and hyphens (react-pdf
 * hyphenates words at line ends); collapse whitespace runs to single spaces.
 */
export function normalizeAnchorText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[­•·◦▪-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Fully collapsed form used for substring matching: spaces removed too,
 * so the two engines' different word-wrapping cannot break a match.
 */
export function toMatchKey(s: string): string {
  return normalizeAnchorText(s).replace(/ /g, '')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/preview-pagination.test.ts`
Expected: PASS (all existing + new tests).

- [ ] **Step 5: Commit**

```bash
git add lib/preview-pagination.ts lib/__tests__/preview-pagination.test.ts
git commit -m "feat: anchor text normalization for PDF/DOM text matching

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Server-side pagination extraction

**Files:**
- Create: `cv-builder/lib/pdf/extract-pagination.ts`
- Test: `cv-builder/lib/pdf/__tests__/extract-pagination.test.ts`

**Interfaces:**
- Consumes: `normalizeAnchorText`, `ANCHOR_MAX_CHARS` from `@/lib/preview-pagination` (Task 1); `PDFParse` from `pdf-parse` (installed; see `lib/upload/parse-file.ts:20-22` for the existing usage pattern; `getText()` returns `TextResult { pages: Array<{ num: number; text: string }>, text: string, total: number }`).
- Produces: `extractPagination(buffer: Buffer): Promise<PdfPagination>` where `interface PdfPagination { pageCount: number; anchors: string[] }` — `anchors[i]` is the normalized first text of page `i + 2` (one anchor per page break). Used by Task 3.

- [ ] **Step 1: Write the failing test**

This is an integration test: it renders a real multi-page PDF through the real export template, then asserts the extractor reads it back correctly. Create `cv-builder/lib/pdf/__tests__/extract-pagination.test.ts`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { extractPagination } from '@/lib/pdf/extract-pagination'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import type React from 'react'

function longResume(): ResumeData {
  return {
    basics: { name: 'Test Person', label: 'Engineer', summary: 'A summary paragraph.' },
    work: Array.from({ length: 12 }, (_, i) => ({
      name: `Company Number ${i}`,
      position: `Senior Role ${i}`,
      startDate: '2015-01',
      endDate: '2016-01',
      summary: `Owned delivery of workstream ${i} across several teams.`,
      highlights: [
        `Achievement alpha for workstream ${i} with measurable outcomes`,
        `Achievement beta for workstream ${i} reducing costs significantly`,
        `Achievement gamma for workstream ${i} improving reliability metrics`,
      ],
    })),
  }
}

async function renderLongPdf(): Promise<Buffer> {
  const meta = ResumeMetaSchema.parse({})
  const element = selectPdfTemplate(longResume(), meta, 'designed', 'Test CV')
  return Buffer.from(await renderToBuffer(element as React.ReactElement<never>))
}

describe('extractPagination', () => {
  it('reports the true page count and one anchor per page break', async () => {
    const buffer = await renderLongPdf()
    const result = await extractPagination(buffer)
    expect(result.pageCount).toBeGreaterThanOrEqual(2)
    expect(result.anchors).toHaveLength(result.pageCount - 1)
  })

  it('anchors are normalized, non-empty, and bounded', async () => {
    const buffer = await renderLongPdf()
    const { anchors } = await extractPagination(buffer)
    for (const anchor of anchors) {
      expect(anchor.length).toBeGreaterThanOrEqual(20)
      expect(anchor.length).toBeLessThanOrEqual(120)
      expect(anchor).toBe(anchor.toLowerCase())
      expect(anchor).not.toMatch(/\s{2,}/)
    }
  })

  it('anchor text originates from the resume content', async () => {
    const buffer = await renderLongPdf()
    const { anchors } = await extractPagination(buffer)
    // Every anchor must contain a fragment of our fixture vocabulary
    expect(anchors[0]).toMatch(/company|achievement|workstream|senior|owned/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/pdf/__tests__/extract-pagination.test.ts`
Expected: FAIL — `Cannot find package '@/lib/pdf/extract-pagination'`.

- [ ] **Step 3: Write the implementation**

Create `cv-builder/lib/pdf/extract-pagination.ts`:

```ts
// lib/pdf/extract-pagination.ts
// Reads ground-truth pagination out of a rendered PDF buffer: the page
// count, plus the first text of every page after the first ("anchors").
// The client locates each anchor inside the HTML preview DOM to pin the
// page-break divider to the exact line where the exported PDF breaks.
import { PDFParse } from 'pdf-parse'
import { normalizeAnchorText, ANCHOR_MAX_CHARS } from '@/lib/preview-pagination'

export interface PdfPagination {
  pageCount: number
  /** anchors[i] = normalized first text of page i+2 (one per page break). */
  anchors: string[]
}

export async function extractPagination(buffer: Buffer): Promise<PdfPagination> {
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    const anchors = result.pages
      .slice(1)
      .map((page) => normalizeAnchorText(page.text).slice(0, ANCHOR_MAX_CHARS))
    return { pageCount: result.total, anchors }
  } finally {
    await parser.destroy()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/pdf/__tests__/extract-pagination.test.ts`
Expected: PASS (3 tests). If the anchor-length assertion fails because a page starts with a very short line, the fixture needs more highlight text — lengthen the highlight strings, do not weaken the assertion below 20.

- [ ] **Step 5: Commit**

```bash
git add lib/pdf/extract-pagination.ts lib/pdf/__tests__/extract-pagination.test.ts
git commit -m "feat: extract true page count and page-start anchors from rendered PDF

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Pagination API route

**Files:**
- Modify: `cv-builder/lib/rate-limit.ts` (add one constant)
- Create: `cv-builder/app/api/preview/pagination/route.ts`
- Test: `cv-builder/app/api/preview/pagination/route.test.ts`

**Interfaces:**
- Consumes: `extractPagination` (Task 2), `selectPdfTemplate(data, meta, mode, title?)` from `@/lib/pdf/select-template`, `renderToBuffer` from `@react-pdf/renderer`, `auth` from `@/lib/auth`, `checkRateLimit`/`RateLimitOptions` from `@/lib/rate-limit`, `apiError`/`handleRouteError` from `@/lib/api/route-errors`, `ResumeDataSchema`/`ResumeMetaSchema` from `@/lib/schemas/resume.zod`.
- Produces: `POST /api/preview/pagination` accepting JSON `{ data: ResumeData, meta: ResumeMeta }`, responding `200 { pageCount: number, anchors: string[] }`, `401`, `400` (invalid payload), `429` (rate limited). Used by Task 5's hook. Renders with the **current editor state from the request body** (not the DB) so unsaved edits paginate correctly, and always in `'designed'` mode — the preview mirrors the designed export.

- [ ] **Step 1: Write the failing tests**

Create `cv-builder/app/api/preview/pagination/route.test.ts` (mirrors the mocking pattern of `app/api/resumes/[id]/export/pdf/route.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { _resetRateLimits } from '@/lib/rate-limit'

let mockSession: { user: { id: string } } | null = null

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn(() => Buffer.from('fake-pdf')),
}))

vi.mock('@/lib/pdf/extract-pagination', () => ({
  extractPagination: vi.fn(async () => ({ pageCount: 3, anchors: ['anchor one', 'anchor two'] })),
}))

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/preview/pagination', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/preview/pagination', () => {
  beforeEach(() => {
    _resetRateLimits()
    mockSession = { user: { id: 'user-1' } }
  })

  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { POST } = await import('./route')
    const res = (await POST(makeRequest({ data: {}, meta: {} }) as never, undefined as never)) as Response
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid payload', async () => {
    const { POST } = await import('./route')
    const res = (await POST(makeRequest({ data: { work: 'not-an-array' } }) as never, undefined as never)) as Response
    expect(res.status).toBe(400)
  })

  it('returns pagination truth for a valid payload', async () => {
    const { POST } = await import('./route')
    const res = (await POST(makeRequest({ data: {}, meta: {} }) as never, undefined as never)) as Response
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ pageCount: 3, anchors: ['anchor one', 'anchor two'] })
  })

  it('rate limits after 30 requests per minute', async () => {
    const { POST } = await import('./route')
    for (let i = 0; i < 30; i++) {
      const res = (await POST(makeRequest({ data: {}, meta: {} }) as never, undefined as never)) as Response
      expect(res.status).toBe(200)
    }
    const res = (await POST(makeRequest({ data: {}, meta: {} }) as never, undefined as never)) as Response
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/preview/pagination/route.test.ts`
Expected: FAIL — `./route` module not found.

- [ ] **Step 3: Add the rate-limit constant**

In `cv-builder/lib/rate-limit.ts`, below `UPLOAD_RATE_LIMIT` (line 22), add:

```ts
/** Preview pagination renders (server-side react-pdf): 30 requests/min per user. */
export const PREVIEW_RATE_LIMIT: RateLimitOptions = { limit: 30, windowMs: 60_000 }
```

- [ ] **Step 4: Write the route**

Create `cv-builder/app/api/preview/pagination/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { extractPagination } from '@/lib/pdf/extract-pagination'
import { checkRateLimit, PREVIEW_RATE_LIMIT } from '@/lib/rate-limit'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import { ResumeDataSchema, ResumeMetaSchema } from '@/lib/schemas/resume.zod'
import type React from 'react'

// Paginates the caller's *current* editor state (request body, not the DB)
// so unsaved edits are reflected. Always 'designed' mode: the Live Preview
// mirrors the designed export.
const BodySchema = z.object({
  data: ResumeDataSchema,
  meta: ResumeMetaSchema,
})

export const POST = auth(async (req) => {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const rate = checkRateLimit(`${req.auth.user.id}:preview-pagination`, PREVIEW_RATE_LIMIT)
  if (!rate.allowed) {
    return apiError('RATE_LIMITED', 'Too many preview renders — please wait a moment.', 429, undefined, rate.retryAfterSeconds)
  }

  try {
    const body = await req.json().catch(() => null)
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return apiError('BAD_REQUEST', 'Invalid resume payload', 400)
    }

    const element = selectPdfTemplate(parsed.data.data, parsed.data.meta, 'designed')
    const buffer = Buffer.from(await renderToBuffer(element as React.ReactElement<never>))
    const pagination = await extractPagination(buffer)
    return NextResponse.json(pagination)
  } catch (err) {
    return handleRouteError(err, 'POST /api/preview/pagination')
  }
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run app/api/preview/pagination/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/rate-limit.ts app/api/preview/pagination/route.ts app/api/preview/pagination/route.test.ts
git commit -m "feat: preview pagination API - true page breaks via export pipeline

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Client anchor resolver (DOM text matching + line geometry)

**Files:**
- Create: `cv-builder/lib/preview-anchor.ts`
- Test: `cv-builder/lib/__tests__/preview-anchor.test.ts`

**Interfaces:**
- Consumes: `toMatchKey` from `@/lib/preview-pagination` (Task 1).
- Produces (used by Task 6):
  - `interface ResolvedBreak { page: number; top: number; source: 'pdf' | 'estimate' }` — `top` in **visual (post-scale) pixels** relative to the wrapper.
  - `buildTextIndex(root: HTMLElement): TextIndex` where `interface TextIndex { key: string; refs: Array<{ node: Text; offset: number }> }`
  - `findAnchorIndex(index: TextIndex, anchorKey: string, fromIndex: number): number`
  - `resolveAnchorTops(wrapper: HTMLElement, contentRoot: HTMLElement, opts: ResolveOptions): ResolvedBreak[]` with `interface ResolveOptions { anchors: string[]; estimateTopFor: (breakIndex: number) => number; maxTop: number; minGap?: number; measureTop?: MeasureTop }` and `type MeasureTop = (ref: { node: Text; offset: number }, wrapper: HTMLElement) => number | null`.

Design notes baked into the code: geometry (`Range.getClientRects`) is injectable because jsdom returns zero rects — tests inject a fake `measureTop`; the real default is exercised in Task 7's browser verification. Matching is sequential (`fromIndex` advances) and guarded: a resolved top must be monotonically increasing (`> prev + minGap`) and inside the content (`< maxTop`), otherwise that break falls back to the estimate. This automatically covers two-column templates where column-2 text can't express a page-flow position.

- [ ] **Step 1: Write the failing tests**

Create `cv-builder/lib/__tests__/preview-anchor.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { buildTextIndex, findAnchorIndex, resolveAnchorTops } from '@/lib/preview-anchor'
import { toMatchKey } from '@/lib/preview-pagination'

function makeRoot(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

describe('buildTextIndex', () => {
  it('concatenates match-key characters across nested elements', () => {
    const root = makeRoot('<div><strong>Data</strong>-Driven <em>Platform</em></div>')
    const index = buildTextIndex(root)
    expect(index.key).toBe('datadrivenplatform')
    expect(index.refs).toHaveLength(index.key.length)
  })

  it('maps every key character back to its text node and offset', () => {
    const root = makeRoot('<p>Ab</p><p>Cd</p>')
    const index = buildTextIndex(root)
    expect(index.key).toBe('abcd')
    expect(index.refs[2].node.data).toBe('Cd')
    expect(index.refs[2].offset).toBe(0)
  })

  it('skips whitespace, bullets, and hyphens', () => {
    const root = makeRoot('<li>• Cross-team   work</li>')
    const index = buildTextIndex(root)
    expect(index.key).toBe('crossteamwork')
  })
})

describe('findAnchorIndex', () => {
  const root = () =>
    makeRoot(
      '<p>Some earlier paragraph with plenty of words inside it.</p>' +
        '<p>Managed human resources within routine and emergency scenarios.</p>'
    )

  it('finds a full anchor', () => {
    const index = buildTextIndex(root())
    const key = toMatchKey('Managed human resources within routine')
    const at = findAnchorIndex(index, key, 0)
    expect(at).toBeGreaterThan(0)
    expect(index.key.slice(at, at + 7)).toBe('managed')
  })

  it('falls back to shorter prefixes when the tail differs', () => {
    const index = buildTextIndex(root())
    // Same first 40+ chars, then divergent tail (as if the PDF line continued differently)
    const key = toMatchKey('Managed human resources within routine and TOTALLY DIFFERENT TAIL CONTENT HERE')
    expect(findAnchorIndex(index, key, 0)).toBeGreaterThan(0)
  })

  it('drops a leading half-word when the full prefix misses', () => {
    const index = buildTextIndex(root())
    // First chars are a hyphenated remnant that is not in the DOM
    const key = 'xxxxxxxxxx' + toMatchKey('human resources within routine and emergency')
    expect(findAnchorIndex(index, key, 0)).toBeGreaterThan(0)
  })

  it('returns -1 when nothing matches', () => {
    const index = buildTextIndex(root())
    expect(findAnchorIndex(index, toMatchKey('completely absent content that matches nothing here'), 0)).toBe(-1)
  })

  it('respects fromIndex for sequential matching', () => {
    const index = buildTextIndex(makeRoot('<p>repeat me now</p><p>repeat me now</p>'))
    const key = toMatchKey('repeat me now')
    const first = findAnchorIndex(index, key, 0)
    const second = findAnchorIndex(index, key, first + 1)
    expect(second).toBeGreaterThan(first)
  })
})

describe('resolveAnchorTops', () => {
  function setup() {
    const wrapper = makeRoot('')
    const content = makeRoot(
      '<p>First page filler text that runs long enough to matter for everyone.</p>' +
        '<p>Second page starts with this exact sentence for anchor matching.</p>' +
        '<p>Third page starts with another distinct sentence entirely here.</p>'
    )
    return { wrapper, content }
  }

  it('uses measured positions when anchors match and pass the guards', () => {
    const { wrapper, content } = setup()
    const tops = new Map([['second', 900], ['third', 1850]])
    const breaks = resolveAnchorTops(wrapper, content, {
      anchors: ['second page starts with this exact sentence', 'third page starts with another distinct sentence'],
      estimateTopFor: (k) => (k + 1) * 1000,
      maxTop: 3000,
      measureTop: (ref) => {
        const text = ref.node.data.toLowerCase()
        if (text.includes('second page')) return tops.get('second')!
        if (text.includes('third page')) return tops.get('third')!
        return null
      },
    })
    expect(breaks).toEqual([
      { page: 1, top: 900, source: 'pdf' },
      { page: 2, top: 1850, source: 'pdf' },
    ])
  })

  it('falls back to the estimate when an anchor cannot be found', () => {
    const { wrapper, content } = setup()
    const breaks = resolveAnchorTops(wrapper, content, {
      anchors: ['this anchor text exists nowhere in the preview content'],
      estimateTopFor: () => 1234,
      maxTop: 3000,
      measureTop: () => null,
    })
    expect(breaks).toEqual([{ page: 1, top: 1234, source: 'estimate' }])
  })

  it('rejects non-monotonic measurements and falls back to the estimate', () => {
    const { wrapper, content } = setup()
    const breaks = resolveAnchorTops(wrapper, content, {
      anchors: ['second page starts with this exact sentence', 'third page starts with another distinct sentence'],
      estimateTopFor: (k) => (k + 1) * 1000,
      maxTop: 3000,
      // Second measurement is *above* the first — impossible in page flow
      measureTop: (ref) => (ref.node.data.toLowerCase().includes('second page') ? 900 : 800),
    })
    expect(breaks[0]).toEqual({ page: 1, top: 900, source: 'pdf' })
    expect(breaks[1]).toEqual({ page: 2, top: 2000, source: 'estimate' })
  })

  it('drops breaks that would land beyond the content', () => {
    const { wrapper, content } = setup()
    const breaks = resolveAnchorTops(wrapper, content, {
      anchors: ['nonexistent anchor text for this particular test case'],
      estimateTopFor: () => 5000,
      maxTop: 3000,
      measureTop: () => null,
    })
    expect(breaks).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/preview-anchor.test.ts`
Expected: FAIL — `Cannot find package '@/lib/preview-anchor'`.

- [ ] **Step 3: Write the implementation**

Create `cv-builder/lib/preview-anchor.ts`:

```ts
// lib/preview-anchor.ts
// Locates PDF page-start anchor texts inside the HTML preview DOM and
// converts them to divider pixel positions. Text is the only coordinate
// system the PDF layout engine and the browser share — see
// docs/superpowers/plans/2026-07-04-true-pdf-preview-pagination.md.
import { toMatchKey } from '@/lib/preview-pagination'

export interface ResolvedBreak {
  /** 1-based index of the page that ends at this break. */
  page: number
  /** Visual (post-scale) pixels from the top of the preview wrapper. */
  top: number
  source: 'pdf' | 'estimate'
}

interface CharRef {
  node: Text
  offset: number
}

export interface TextIndex {
  /** Match-key string of the whole preview content. */
  key: string
  /** refs[i] = text node + offset of key[i]. */
  refs: CharRef[]
}

export type MeasureTop = (ref: CharRef, wrapper: HTMLElement) => number | null

export interface ResolveOptions {
  anchors: string[]
  /** Margin-aware fallback position (visual px) for break k. */
  estimateTopFor: (breakIndex: number) => number
  /** Wrapper height in visual px — breaks beyond this are dropped. */
  maxTop: number
  /** Minimum visual px between consecutive breaks (default 200). */
  minGap?: number
  /** Injectable for tests; default measures the matched line via Range. */
  measureTop?: MeasureTop
}

export function buildTextIndex(root: HTMLElement): TextIndex {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let key = ''
  const refs: CharRef[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const raw = node.data
    for (let i = 0; i < raw.length; i++) {
      const ch = toMatchKey(raw[i])
      if (!ch) continue
      key += ch
      refs.push({ node, offset: i })
    }
  }
  return { key, refs }
}

const MIN_MATCH = 20
const PREFIX_LENGTHS = [Infinity, 80, 40, MIN_MATCH]

export function findAnchorIndex(index: TextIndex, anchorKey: string, fromIndex: number): number {
  for (const len of PREFIX_LENGTHS) {
    const needle = anchorKey.slice(0, len)
    if (needle.length < MIN_MATCH) break
    const at = index.key.indexOf(needle, fromIndex)
    if (at !== -1) return at
  }
  // The anchor may start with the tail of a word hyphenated onto the new
  // PDF page; that remnant doesn't exist as a prefix in the DOM. Drop the
  // first 10 chars and retry with a mid-anchor slice.
  const inner = anchorKey.slice(10, 10 + 40)
  if (inner.length >= MIN_MATCH) {
    const at = index.key.indexOf(inner, fromIndex)
    if (at !== -1) return at
  }
  return -1
}

const defaultMeasureTop: MeasureTop = (ref, wrapper) => {
  const range = wrapper.ownerDocument.createRange()
  range.setStart(ref.node, ref.offset)
  range.setEnd(ref.node, Math.min(ref.offset + 1, ref.node.data.length))
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()
  if (!rect || (rect.top === 0 && rect.height === 0)) return null
  return rect.top - wrapper.getBoundingClientRect().top
}

export function resolveAnchorTops(
  wrapper: HTMLElement,
  contentRoot: HTMLElement,
  opts: ResolveOptions
): ResolvedBreak[] {
  const { anchors, estimateTopFor, maxTop, minGap = 200, measureTop = defaultMeasureTop } = opts
  const index = buildTextIndex(contentRoot)
  const out: ResolvedBreak[] = []
  let searchFrom = 0
  let prevTop = 0

  anchors.forEach((anchor, k) => {
    const anchorKey = anchor.replace(/ /g, '')
    let top: number | null = null
    let source: ResolvedBreak['source'] = 'estimate'

    if (anchorKey.length >= MIN_MATCH) {
      const at = findAnchorIndex(index, anchorKey, searchFrom)
      if (at !== -1) {
        const measured = measureTop(index.refs[at], wrapper)
        if (measured !== null && measured > prevTop + minGap && measured < maxTop) {
          top = measured
          source = 'pdf'
          searchFrom = at + 1
        }
      }
    }

    if (top === null) {
      const estimated = estimateTopFor(k)
      if (estimated <= prevTop + minGap || estimated >= maxTop) return
      top = estimated
    }

    out.push({ page: k + 1, top, source })
    prevTop = top
  })

  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/preview-anchor.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/preview-anchor.ts lib/__tests__/preview-anchor.test.ts
git commit -m "feat: resolve PDF page anchors to preview DOM line positions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `usePdfPagination` hook

**Files:**
- Create: `cv-builder/lib/hooks/use-pdf-pagination.ts`
- Test: `cv-builder/lib/hooks/__tests__/use-pdf-pagination.test.tsx`

**Interfaces:**
- Consumes: `useDebounce` from `@/lib/hooks/use-debounce`; `POST /api/preview/pagination` (Task 3).
- Produces (used by Task 6):
  - `type PaginationStatus = 'syncing' | 'synced' | 'error'`
  - `interface PdfPaginationState { status: PaginationStatus; pageCount: number | null; anchors: string[] }`
  - `usePdfPagination(data: ResumeData, meta: ResumeMeta, delay?: number): PdfPaginationState` — debounces 1200ms by default, aborts in-flight requests on change, and reports `'syncing'` whenever the current editor state is newer than the last response (so the consumer knows anchors are stale and should prefer estimates).

- [ ] **Step 1: Write the failing tests**

Create `cv-builder/lib/hooks/__tests__/use-pdf-pagination.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePdfPagination } from '@/lib/hooks/use-pdf-pagination'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'

const meta: ResumeMeta = ResumeMetaSchema.parse({})
const dataA: ResumeData = { basics: { name: 'A' } }
const dataB: ResumeData = { basics: { name: 'B' } }

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

describe('usePdfPagination', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = vi.fn(async () => okResponse({ pageCount: 2, anchors: ['anchor text one'] }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('does not fetch before the debounce delay elapses', async () => {
    renderHook(() => usePdfPagination(dataA, meta))
    await act(async () => {
      vi.advanceTimersByTime(1100)
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches once after the delay and reports synced truth', async () => {
    const { result } = renderHook(() => usePdfPagination(dataA, meta))
    expect(result.current.status).toBe('syncing')
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    await act(async () => {}) // flush the fetch promise
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({ status: 'synced', pageCount: 2, anchors: ['anchor text one'] })
  })

  it('flips back to syncing when the data changes after a sync', async () => {
    const { result, rerender } = renderHook(({ d }) => usePdfPagination(d, meta), {
      initialProps: { d: dataA },
    })
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    await act(async () => {})
    expect(result.current.status).toBe('synced')

    rerender({ d: dataB })
    expect(result.current.status).toBe('syncing')
  })

  it('aborts the in-flight request when the payload changes', async () => {
    let firstSignal: AbortSignal | undefined
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      if (!firstSignal) {
        firstSignal = init.signal as AbortSignal
        return new Promise<Response>(() => {}) // never resolves
      }
      return okResponse({ pageCount: 5, anchors: [] })
    })

    const { rerender } = renderHook(({ d }) => usePdfPagination(d, meta), {
      initialProps: { d: dataA },
    })
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    expect(firstSignal!.aborted).toBe(false)

    rerender({ d: dataB })
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    expect(firstSignal!.aborted).toBe(true)
  })

  it('reports error status on a failed response without clearing prior truth', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ pageCount: 2, anchors: ['anchor text one'] }))
    const { result, rerender } = renderHook(({ d }) => usePdfPagination(d, meta), {
      initialProps: { d: dataA },
    })
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    await act(async () => {})
    expect(result.current.status).toBe('synced')

    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 429 }))
    rerender({ d: dataB })
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    await act(async () => {})
    expect(result.current.status).toBe('error')
    expect(result.current.pageCount).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/hooks/__tests__/use-pdf-pagination.test.tsx`
Expected: FAIL — `Cannot find package '@/lib/hooks/use-pdf-pagination'`.

- [ ] **Step 3: Write the implementation**

Create `cv-builder/lib/hooks/use-pdf-pagination.ts`:

```ts
'use client'

// Debounced ground-truth pagination: after the user stops editing, POST the
// current editor state to the pagination endpoint (which renders the real
// export PDF server-side) and report the true page count + page-start
// anchors. Never fires on a keystroke — the debounce guarantees at most one
// render per pause, per the project rule against per-keystroke PDF renders.
import { useEffect, useMemo, useState } from 'react'
import { useDebounce } from '@/lib/hooks/use-debounce'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export type PaginationStatus = 'syncing' | 'synced' | 'error'

export interface PdfPaginationState {
  status: PaginationStatus
  pageCount: number | null
  anchors: string[]
}

const DEFAULT_DELAY_MS = 1200

export function usePdfPagination(
  data: ResumeData,
  meta: ResumeMeta,
  delay: number = DEFAULT_DELAY_MS
): PdfPaginationState {
  const payload = useMemo(() => JSON.stringify({ data, meta }), [data, meta])
  const debouncedPayload = useDebounce(payload, delay)
  const [state, setState] = useState<PdfPaginationState>({
    status: 'syncing',
    pageCount: null,
    anchors: [],
  })

  useEffect(() => {
    const controller = new AbortController()
    setState((s) => ({ ...s, status: 'syncing' }))

    fetch('/api/preview/pagination', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: debouncedPayload,
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`pagination request failed: ${res.status}`)
        const json = (await res.json()) as { pageCount: number; anchors: string[] }
        setState({ status: 'synced', pageCount: json.pageCount, anchors: json.anchors })
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setState((s) => ({ ...s, status: 'error' }))
      })

    return () => controller.abort()
  }, [debouncedPayload])

  // Editor state newer than the last response → anchors are stale.
  const isStale = payload !== debouncedPayload
  if (isStale && state.status === 'synced') {
    return { ...state, status: 'syncing' }
  }
  return state
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/hooks/__tests__/use-pdf-pagination.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/use-pdf-pagination.ts lib/hooks/__tests__/use-pdf-pagination.test.tsx
git commit -m "feat: usePdfPagination hook - debounced ground-truth page sync

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: PreviewTab integration — true dividers, estimate fallback, status badge

**Files:**
- Modify: `cv-builder/components/editor/PreviewTab.tsx` (full replacement below)

**Interfaces:**
- Consumes: `usePdfPagination` (Task 5), `resolveAnchorTops`/`ResolvedBreak` (Task 4), `computePageBreaks`/`A4_WIDTH_PX`/`A4_HEIGHT_PX` from `@/lib/preview-pagination`.
- Produces: user-facing behavior only. Dividers: **solid** line + "Page N" chip when pinned to PDF truth; **dashed** line + "≈ Page N" chip while estimating. A badge overlays the preview's top-right: "Calculating pages…" while syncing, "N pages · matches PDF" when synced, "N pages (estimated)" on error.

Layout note: the previous root `<div ref={containerRef} className="flex-1 overflow-auto …">` becomes a child of a new `relative flex-1 min-h-0` root so the badge can float without scrolling. The `ResizeObserver` logic is unchanged — `containerRef` still measures the scroll container's width.

- [ ] **Step 1: Replace the component**

Replace the entire contents of `cv-builder/components/editor/PreviewTab.tsx` with:

```tsx
'use client'

import { useRef, useEffect, useLayoutEffect, useState } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { usePdfPagination } from '@/lib/hooks/use-pdf-pagination'
import { resolveAnchorTops, type ResolvedBreak } from '@/lib/preview-anchor'
import { ClassicTemplate } from '@/components/templates/ClassicTemplate'
import { ModernTemplate } from '@/components/templates/ModernTemplate'
import { MinimalTemplate } from '@/components/templates/MinimalTemplate'
import { ExecutiveTemplate } from '@/components/templates/ExecutiveTemplate'
import { SidebarTemplate } from '@/components/templates/SidebarTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { computePageBreaks, A4_WIDTH_PX, A4_HEIGHT_PX } from '@/lib/preview-pagination'

const TEMPLATES: Record<string, React.ComponentType<{ data: ResumeData; meta: ResumeMeta }>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  executive: ExecutiveTemplate,
  sidebar: SidebarTemplate,
}

export function PreviewTab() {
  const data = useResumeEditorStore((s) => s.data)
  const meta = useResumeEditorStore((s) => s.meta)
  const debouncedData = useDebounce(data, 300)
  const debouncedMeta = useDebounce(meta, 300)
  const pagination = usePdfPagination(data, meta)

  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(0.75)
  const [templateHeight, setTemplateHeight] = useState(A4_HEIGHT_PX)
  const [breaks, setBreaks] = useState<ResolvedBreak[]>([])

  // Track container width → fitScale
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setFitScale(Math.min(1, (el.clientWidth - 64) / A4_WIDTH_PX))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Track rendered template height
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setTemplateHeight(el.scrollHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const Template = TEMPLATES[debouncedMeta.templateId] ?? ClassicTemplate

  const marginPx = debouncedMeta.pageMargins * 96
  const usablePx = A4_HEIGHT_PX - 2 * marginPx
  const estimates = computePageBreaks(templateHeight, marginPx)
  const estimatedPageCount = estimates.length + 1

  // Resolve divider positions after the DOM has the debounced content.
  // Synced → pin to PDF anchor lines (estimate fallback per break inside
  // resolveAnchorTops). Otherwise → margin-aware estimates.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const content = innerRef.current
    if (!wrapper || !content) return
    if (pagination.status === 'synced') {
      setBreaks(
        resolveAnchorTops(wrapper, content, {
          anchors: pagination.anchors,
          estimateTopFor: (k) => (marginPx + (k + 1) * usablePx) * fitScale,
          maxTop: templateHeight * fitScale,
        })
      )
    } else {
      setBreaks(
        estimates.map((b) => ({ page: b.page, top: b.top * fitScale, source: 'estimate' as const }))
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.status, pagination.anchors, templateHeight, fitScale, debouncedData, debouncedMeta])

  const badgeText =
    pagination.status === 'synced' && pagination.pageCount !== null
      ? `${pagination.pageCount} page${pagination.pageCount === 1 ? '' : 's'} · matches PDF`
      : pagination.status === 'error'
        ? `${estimatedPageCount} page${estimatedPageCount === 1 ? '' : 's'} (estimated)`
        : 'Calculating pages…'

  return (
    <div className="relative flex-1 min-h-0">
      {/* Pagination status badge — floats over the preview, does not scroll */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 16,
          zIndex: 20,
          background: 'rgba(99, 102, 241, 0.10)',
          color: 'rgba(67, 56, 202, 0.9)',
          fontSize: '11px',
          padding: '3px 10px',
          borderRadius: '9999px',
          fontFamily: 'sans-serif',
          userSelect: 'none',
          pointerEvents: 'none',
          backdropFilter: 'blur(4px)',
        }}
      >
        {badgeText}
      </div>

      <div
        ref={containerRef}
        className="h-full overflow-auto bg-white/20 backdrop-blur-sm flex justify-center py-8"
      >
        {/* Outer wrapper sized to post-scale visual dimensions so the scroll container tracks content correctly */}
        <div
          ref={wrapperRef}
          style={{
            position: 'relative',
            width: A4_WIDTH_PX * fitScale,
            height: templateHeight * fitScale,
            flexShrink: 0,
          }}
        >
          {/* Inner div absolutely positioned and CSS-scaled — transform does not affect layout flow */}
          <div
            ref={innerRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: A4_WIDTH_PX,
              transformOrigin: 'top left',
              transform: `scale(${fitScale})`,
            }}
          >
            <Template data={debouncedData} meta={debouncedMeta} />
          </div>

          {/* Page break indicators — solid when pinned to real PDF breaks, dashed while estimating */}
          {breaks.map(({ page, top, source }) => (
            <div
              key={page}
              style={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  borderTop:
                    source === 'pdf'
                      ? '2px solid rgba(99, 102, 241, 0.55)'
                      : '2px dashed rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    color: 'rgba(99, 102, 241, 0.6)',
                    fontSize: '10px',
                    padding: '1px 8px',
                    borderRadius: '0 0 4px 4px',
                    fontFamily: 'sans-serif',
                    userSelect: 'none',
                  }}
                >
                  {source === 'pdf' ? `Page ${page + 1}` : `≈ Page ${page + 1}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and run the full suite**

Run: `npx tsc --noEmit; npx vitest run`
Expected: tsc silent; all tests pass (the pre-existing "test error" console noise from `EditorErrorBoundary.test.tsx` is expected).

- [ ] **Step 3: Commit**

```bash
git add components/editor/PreviewTab.tsx
git commit -m "feat: Live Preview dividers pinned to true PDF page breaks

Solid 'Page N' dividers at ground-truth positions when the debounced
server render is in sync; dashed estimates while typing or on error.
Badge shows true page count.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end verification against a real export

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything above, plus the running app (`npm run dev`, port 3000) and a signed-in browser session.

- [ ] **Step 1: Full-suite gate**

Run: `npx tsc --noEmit; npx vitest run`
Expected: clean typecheck, all tests green.

- [ ] **Step 2: Invoke the `verify` skill** (browser-drive the change; it defines the report format). Cover at minimum:

1. Open a multi-page CV in the editor. Within ~2s of loading, the badge should switch from "Calculating pages…" to "N pages · matches PDF" and the divider(s) should render **solid** with "Page 2" (no ≈).
2. In DevTools (or via the browser JS tool), capture the divider `top`. Type a character into the summary field: the divider must immediately switch to **dashed ≈** (estimate) and, ~1.5s after the last keystroke, snap back to **solid** at a possibly-different position.
3. Ground-truth cross-check: read the anchor from `POST /api/preview/pagination`'s response (Network tab or `fetch` from console with the same body). The text just **below** the solid divider in the preview must be the anchor text — i.e., the divider sits exactly above the first line of PDF page 2.
4. Export the actual PDF (user-triggered download or existing export flow) and confirm: page count matches the badge, and page 2 of the exported file starts with the same content shown below the divider. This is the definitive 1:1 check.
5. Probes: drag page margins 1.0"→0.5" (divider re-syncs), switch templates (re-syncs per template), switch to the **sidebar/two-column** layout (dividers may legitimately fall back to ≈-estimates — the guard, not a crash), and rapid-type for 10+ seconds (no request storm: requests only fire on pauses; prior ones abort).

- [ ] **Step 3: Restore any document state changed during verification** (margins, template, text) — autosave is live.

- [ ] **Step 4: Commit any verification-driven fixes** (if none, no commit).

---

## Self-Review Notes

- **Spec coverage:** debounced real-PDF render off the UI thread (server-side, 1200ms) ✓; true page breaks derived from the render (pdf-parse per-page anchors) ✓; Live Preview synced to ground truth with visual truth/estimate distinction ✓; instant HTML preview untouched (300ms debounce path unchanged) ✓; CLAUDE.md "no react-pdf per keystroke" honored ✓.
- **Type consistency:** `PdfPagination { pageCount, anchors }` (Task 2) = route response (Task 3) = hook's parsed shape (Task 5). `ResolvedBreak { page, top, source }` produced by Task 4, consumed verbatim in Task 6. `toMatchKey`/`normalizeAnchorText` shared via Task 1.
- **Known limits (accepted):** two-column templates fall back to estimates when anchors can't express flow position (guard handles it, UI communicates it via ≈); rate limit at 30/min means a user typing in many bursts may briefly see `error` status → estimated badge, which self-heals on the next pause.
