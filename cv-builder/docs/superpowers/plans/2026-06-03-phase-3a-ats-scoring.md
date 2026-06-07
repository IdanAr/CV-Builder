# Phase 3a: ATS Scoring Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an ATS scoring engine that evaluates a resume against a pasted job description across 4 weighted vectors (0–100 total), exposed via a new API route and a new "ATS" tab in the resume editor.

**Architecture:** Pure algorithmic text analysis — no external API calls or new npm packages. The scorer consumes `ResumeData` + a raw job description string, returning a structured score result. The API route follows the same auth pattern as existing export routes. The UI adds a fourth tab to `EditorShell` with a textarea, an Analyze button, and a score visualization panel.

**Pre-requisite:** Phase 2a core editor and export pipeline must be complete (`EditorShell`, Zustand store with `resumeId`, auth pattern via `auth()` wrapper).

**Tech Stack:** Pure TypeScript, existing Zustand store (read-only), existing `auth()` route wrapper, Tailwind CSS for UI.

---

## File Map

**New:**
- `lib/ats/keywords.ts` — keyword extraction from text + keyword overlap comparison
- `lib/ats/scorer.ts` — 4-vector scoring logic and `AtsScoreResult` type
- `lib/ats/__tests__/keywords.test.ts`
- `lib/ats/__tests__/scorer.test.ts`
- `app/api/resumes/[id]/ats-score/route.ts` — POST handler, auth-guarded
- `app/api/resumes/[id]/ats-score/route.test.ts`
- `components/ats/AtsScorePanel.tsx` — client component: textarea + score UI

**Modified:**
- `components/editor/EditorShell.tsx` — add `'ats'` to `Tab` type, import `AtsScorePanel`, add tab button + content div

---

### Task 1: Keyword extraction utility

**Files:**
- Create: `lib/ats/keywords.ts`
- Create: `lib/ats/__tests__/keywords.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/ats/__tests__/keywords.test.ts
import { describe, it, expect } from 'vitest'
import { extractKeywords, keywordOverlap } from '../keywords'

describe('extractKeywords', () => {
  it('removes stop words', () => {
    const result = extractKeywords('the quick brown fox and the lazy dog')
    expect(result).not.toContain('the')
    expect(result).not.toContain('and')
    expect(result).toContain('quick')
    expect(result).toContain('brown')
    expect(result).toContain('lazy')
  })

  it('lowercases all keywords', () => {
    const result = extractKeywords('React TypeScript Node.js')
    expect(result).toContain('react')
    expect(result).toContain('typescript')
    expect(result).toContain('node.js')
  })

  it('returns unique keywords', () => {
    const result = extractKeywords('react react react typescript react')
    expect(result.filter(k => k === 'react').length).toBe(1)
  })

  it('filters out words shorter than 3 characters', () => {
    const result = extractKeywords('we do it at go')
    expect(result.every(w => w.length >= 3)).toBe(true)
  })

  it('handles punctuation without breaking tech tokens', () => {
    const result = extractKeywords('Python, Java, and C++')
    expect(result).toContain('python')
    expect(result).toContain('java')
  })

  it('returns empty array for empty input', () => {
    expect(extractKeywords('')).toEqual([])
  })

  it('returns empty array for whitespace-only input', () => {
    expect(extractKeywords('   ')).toEqual([])
  })
})

describe('keywordOverlap', () => {
  it('identifies matched keywords present in resume text', () => {
    const { matched, missing } = keywordOverlap(
      'experienced react developer with typescript and node.js skills',
      ['react', 'typescript', 'python', 'kubernetes']
    )
    expect(matched).toContain('react')
    expect(matched).toContain('typescript')
    expect(missing).toContain('python')
    expect(missing).toContain('kubernetes')
  })

  it('returns all missing when resume text is empty', () => {
    const { matched, missing } = keywordOverlap('', ['react', 'python'])
    expect(matched).toEqual([])
    expect(missing).toEqual(['react', 'python'])
  })

  it('returns all matched when all keywords are present', () => {
    const { matched, missing } = keywordOverlap('react python typescript', ['react', 'python'])
    expect(matched).toHaveLength(2)
    expect(missing).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/ats/__tests__/keywords.test.ts
```

Expected: FAIL — `Cannot find module '../keywords'`

- [ ] **Step 3: Create the keyword utility**

```typescript
// lib/ats/keywords.ts
const STOP_WORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'out', 'off', 'over', 'under', 'again', 'then', 'once', 'but', 'not',
  'than', 'too', 'very', 'that', 'this', 'these', 'those', 'such', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'any', 'all', 'also',
  'our', 'your', 'their', 'we', 'you', 'they', 'he', 'she', 'it',
  'who', 'which', 'what', 'how', 'when', 'where', 'why',
  'work', 'working', 'experience', 'role', 'position', 'job',
])

export function extractKeywords(text: string): string[] {
  if (!text.trim()) return []
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/\.$/, ''))
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i)
}

export function keywordOverlap(
  resumeText: string,
  jdKeywords: string[]
): { matched: string[]; missing: string[] } {
  const lower = resumeText.toLowerCase()
  const matched: string[] = []
  const missing: string[] = []
  for (const kw of jdKeywords) {
    if (lower.includes(kw)) matched.push(kw)
    else missing.push(kw)
  }
  return { matched, missing }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/ats/__tests__/keywords.test.ts
```

Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ats/keywords.ts lib/ats/__tests__/keywords.test.ts
git commit -m "feat: add keyword extraction and overlap utilities for ATS scorer"
```

---

### Task 2: ATS scoring engine (4 vectors)

**Files:**
- Create: `lib/ats/scorer.ts`
- Create: `lib/ats/__tests__/scorer.test.ts`

**Scoring vectors:**
| Vector | Max | Logic |
|--------|-----|-------|
| Format & Structure | 25 | +5 each: name, email, summary, ≥1 work entry, ≥1 work highlight |
| Keyword Density | 35 | `(matched / jdKeywords.length) * 35` — all resume text vs JD |
| Keyword Placement | 25 | `(hvMatched / jdKeywords.length) * 25` — high-value zones only (basics.label, basics.summary, work[0].position + highlights) |
| Metric Presence | 15 | `min(15, (highlightsWithNumbers / totalHighlights) * 30)` |

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/ats/__tests__/scorer.test.ts
import { describe, it, expect } from 'vitest'
import { scoreResume } from '../scorer'
import type { ResumeData } from '@/lib/schemas/resume.zod'

const fullData: ResumeData = {
  basics: {
    name: 'Jane Smith',
    label: 'Senior React Developer',
    email: 'jane@example.com',
    summary: 'Expert TypeScript and React developer with 5 years building REST APIs and Node.js microservices.',
  },
  work: [{
    name: 'Acme Corp',
    position: 'Frontend Engineer',
    startDate: '2020-01',
    highlights: [
      'Built React dashboard used by 500 users, increasing retention by 40%',
      'Reduced API response time by 60% through Node.js optimizations',
      'Led a team of 5 developers across 3 projects',
    ],
  }],
  skills: [{ name: 'TypeScript', keywords: ['React', 'Node.js', 'REST APIs'] }],
  education: [{ institution: 'MIT', area: 'Computer Science', studyType: 'BSc', startDate: '2016-09', endDate: '2020-06' }],
}

const jd = 'We are looking for a React developer with TypeScript experience building REST APIs and Node.js microservices.'

describe('scoreResume', () => {
  it('returns zero total for empty data and empty job description', () => {
    const result = scoreResume({}, '')
    expect(result.total).toBe(0)
  })

  it('format score is 0 for empty data', () => {
    const result = scoreResume({}, jd)
    expect(result.breakdown.format).toBe(0)
  })

  it('format score is 5 for name only', () => {
    const result = scoreResume({ basics: { name: 'Alice' } }, '')
    expect(result.breakdown.format).toBe(5)
  })

  it('format score is 10 for name + email', () => {
    const result = scoreResume({ basics: { name: 'Alice', email: 'alice@test.com' } }, '')
    expect(result.breakdown.format).toBe(10)
  })

  it('format score is 25 for data with all required fields and highlights', () => {
    const result = scoreResume(fullData, jd)
    expect(result.breakdown.format).toBe(25)
  })

  it('keyword density and placement are 0 when no job description provided', () => {
    const result = scoreResume(fullData, '')
    expect(result.breakdown.keywordDensity).toBe(0)
    expect(result.breakdown.keywordPlacement).toBe(0)
  })

  it('keyword density score is > 0 when resume contains JD keywords', () => {
    const result = scoreResume(fullData, jd)
    expect(result.breakdown.keywordDensity).toBeGreaterThan(0)
  })

  it('keyword placement score is > 0 when high-value sections contain JD keywords', () => {
    const result = scoreResume(fullData, jd)
    expect(result.breakdown.keywordPlacement).toBeGreaterThan(0)
  })

  it('metrics score is 0 when no highlights exist', () => {
    const result = scoreResume({ basics: { name: 'Joe' } }, jd)
    expect(result.breakdown.metrics).toBe(0)
  })

  it('metrics score is > 0 when highlights contain numbers', () => {
    const result = scoreResume(fullData, jd)
    expect(result.breakdown.metrics).toBeGreaterThan(0)
  })

  it('total equals sum of breakdown values capped at 100', () => {
    const result = scoreResume(fullData, jd)
    const sum = result.breakdown.format + result.breakdown.keywordDensity +
      result.breakdown.keywordPlacement + result.breakdown.metrics
    expect(result.total).toBe(Math.min(100, sum))
  })

  it('missing keywords listed when JD keywords absent from resume', () => {
    const result = scoreResume({ basics: { name: 'Joe' } }, 'Kubernetes Docker AWS experience required')
    expect(result.missingKeywords.length).toBeGreaterThan(0)
  })

  it('matched keywords listed when JD keywords present in resume', () => {
    const result = scoreResume(fullData, 'React TypeScript Node.js developer needed')
    expect(result.matchedKeywords).toContain('react')
  })

  it('total never exceeds 100', () => {
    const result = scoreResume(fullData, jd)
    expect(result.total).toBeLessThanOrEqual(100)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/ats/__tests__/scorer.test.ts
```

Expected: FAIL — `Cannot find module '../scorer'`

- [ ] **Step 3: Create the scoring engine**

```typescript
// lib/ats/scorer.ts
import type { ResumeData } from '@/lib/schemas/resume.zod'
import { extractKeywords, keywordOverlap } from './keywords'

export interface AtsScoreResult {
  total: number
  breakdown: {
    format: number          // max 25
    keywordDensity: number  // max 35
    keywordPlacement: number // max 25
    metrics: number         // max 15
  }
  matchedKeywords: string[]
  missingKeywords: string[]
}

function flattenAllText(data: ResumeData): string {
  const parts: string[] = []
  const b = data.basics ?? {}
  if (b.name) parts.push(b.name)
  if (b.label) parts.push(b.label)
  if (b.summary) parts.push(b.summary)
  for (const job of data.work ?? []) {
    if (job.name) parts.push(job.name)
    if (job.position) parts.push(job.position)
    if (job.summary) parts.push(job.summary)
    parts.push(...(job.highlights ?? []))
  }
  for (const edu of data.education ?? []) {
    if (edu.institution) parts.push(edu.institution)
    if (edu.area) parts.push(edu.area)
    if (edu.studyType) parts.push(edu.studyType)
  }
  for (const s of data.skills ?? []) {
    if (s.name) parts.push(s.name)
    if (s.level) parts.push(s.level)
    parts.push(...(s.keywords ?? []))
  }
  for (const c of data.certificates ?? []) {
    if (c.name) parts.push(c.name)
  }
  for (const p of data.projects ?? []) {
    if (p.name) parts.push(p.name)
    if (p.description) parts.push(p.description)
    parts.push(...(p.highlights ?? []))
    parts.push(...(p.keywords ?? []))
  }
  for (const v of data.volunteer ?? []) {
    if (v.organization) parts.push(v.organization)
    if (v.position) parts.push(v.position)
    parts.push(...(v.highlights ?? []))
  }
  return parts.join(' ')
}

// High-value zones: label, summary, most recent job position + highlights
function flattenHighValueText(data: ResumeData): string {
  const parts: string[] = []
  const b = data.basics ?? {}
  if (b.label) parts.push(b.label)
  if (b.summary) parts.push(b.summary)
  const recentJob = (data.work ?? [])[0]
  if (recentJob) {
    if (recentJob.position) parts.push(recentJob.position)
    if (recentJob.name) parts.push(recentJob.name)
    parts.push(...(recentJob.highlights ?? []))
  }
  return parts.join(' ')
}

function scoreFormat(data: ResumeData): number {
  let score = 0
  const b = data.basics ?? {}
  if (b.name) score += 5
  if (b.email) score += 5
  if (b.summary) score += 5
  if ((data.work ?? []).length > 0) score += 5
  if ((data.work ?? []).some(j => (j.highlights ?? []).length > 0)) score += 5
  return score // max 25
}

const METRIC_PATTERN = /\d+%|\$\d+|\d+[xX]|\d{2,}|\d+\s*(people|team|users|customers|members|reports|clients|projects)/i

function scoreMetrics(data: ResumeData): number {
  const highlights = [
    ...(data.work ?? []).flatMap(j => j.highlights ?? []),
    ...(data.volunteer ?? []).flatMap(v => v.highlights ?? []),
    ...(data.projects ?? []).flatMap(p => p.highlights ?? []),
  ]
  if (highlights.length === 0) return 0
  const withMetrics = highlights.filter(h => METRIC_PATTERN.test(h))
  return Math.min(15, Math.round((withMetrics.length / highlights.length) * 30))
}

export function scoreResume(data: ResumeData, jobDescription: string): AtsScoreResult {
  const formatScore = scoreFormat(data)
  const metricsScore = scoreMetrics(data)
  const jdKeywords = extractKeywords(jobDescription)

  if (jdKeywords.length === 0) {
    return {
      total: Math.min(100, formatScore + metricsScore),
      breakdown: { format: formatScore, keywordDensity: 0, keywordPlacement: 0, metrics: metricsScore },
      matchedKeywords: [],
      missingKeywords: [],
    }
  }

  const allText = flattenAllText(data)
  const highValueText = flattenHighValueText(data)

  const { matched, missing } = keywordOverlap(allText, jdKeywords)
  const keywordDensityScore = Math.min(35, Math.round((matched.length / jdKeywords.length) * 35))

  const { matched: hvMatched } = keywordOverlap(highValueText, jdKeywords)
  const keywordPlacementScore = Math.min(25, Math.round((hvMatched.length / jdKeywords.length) * 25))

  const total = Math.min(100, formatScore + keywordDensityScore + keywordPlacementScore + metricsScore)

  return {
    total,
    breakdown: {
      format: formatScore,
      keywordDensity: keywordDensityScore,
      keywordPlacement: keywordPlacementScore,
      metrics: metricsScore,
    },
    matchedKeywords: matched,
    missingKeywords: missing,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/ats/__tests__/scorer.test.ts
```

Expected: all 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ats/scorer.ts lib/ats/__tests__/scorer.test.ts
git commit -m "feat: add ATS scoring engine with 4-vector analysis"
```

---

### Task 3: ATS score API route

**Files:**
- Create: `app/api/resumes/[id]/ats-score/route.ts`
- Create: `app/api/resumes/[id]/ats-score/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/resumes/[id]/ats-score/route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: null }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(),
}))

describe('POST /api/resumes/[id]/ats-score', () => {
  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ats-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: 'React developer needed' }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run "app/api/resumes/[id]/ats-score/route.test.ts"
```

Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Create the route**

```typescript
// app/api/resumes/[id]/ats-score/route.ts
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { scoreResume } from '@/lib/ats/scorer'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { id } = await (ctx?.params as Promise<{ id: string }>)
  const resume = await getResume(req.auth.user.id, id)
  if (!resume) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const jobDescription: string = typeof body.jobDescription === 'string' ? body.jobDescription : ''
  const data = (resume.data ?? {}) as ResumeData
  const result = scoreResume(data, jobDescription)

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run "app/api/resumes/[id]/ats-score/route.test.ts"
```

Expected: 1 test PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm run test:run
```

Expected: all tests PASS (new tests included).

- [ ] **Step 6: Commit**

```bash
git add lib/ats/ "app/api/resumes/[id]/ats-score/"
git commit -m "feat: add ATS score API route"
```

---

### Task 4: AtsScorePanel UI component

**Files:**
- Create: `components/ats/AtsScorePanel.tsx`

No automated test — client component; verified manually in Task 5.

- [ ] **Step 1: Create the component**

```tsx
// components/ats/AtsScorePanel.tsx
'use client'

import { useState } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'

interface AtsScoreResult {
  total: number
  breakdown: {
    format: number
    keywordDensity: number
    keywordPlacement: number
    metrics: number
  }
  matchedKeywords: string[]
  missingKeywords: string[]
}

const VECTOR_LABELS: { key: keyof AtsScoreResult['breakdown']; label: string; max: number }[] = [
  { key: 'format', label: 'Format & Structure', max: 25 },
  { key: 'keywordDensity', label: 'Keyword Coverage', max: 35 },
  { key: 'keywordPlacement', label: 'Keyword Placement', max: 25 },
  { key: 'metrics', label: 'Metric Presence', max: 15 },
]

function ScoreBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="h-2 w-full rounded-full bg-gray-200">
      <div
        className={`h-2 rounded-full transition-all duration-300 ${
          pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function AtsScorePanel() {
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const [jobDescription, setJobDescription] = useState('')
  const [result, setResult] = useState<AtsScoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze() {
    if (!jobDescription.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/resumes/${resumeId}/ats-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription }),
      })
      if (!res.ok) throw new Error('Analysis failed')
      setResult(await res.json())
    } catch {
      setError('Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Paste job description
        </label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the full job description here to see how well your CV matches…"
          className="w-full h-40 rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !jobDescription.trim()}
          className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500 mb-1">ATS Score</p>
            <p className={`text-6xl font-bold ${
              result.total >= 70 ? 'text-green-600' : result.total >= 40 ? 'text-yellow-500' : 'text-red-500'
            }`}>
              {result.total}
            </p>
            <p className="text-sm text-gray-400 mt-1">out of 100</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-gray-700">Score Breakdown</p>
            {VECTOR_LABELS.map(({ key, label, max }) => (
              <div key={key}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{label}</span>
                  <span className="font-medium">{result.breakdown[key]} / {max}</span>
                </div>
                <ScoreBar value={result.breakdown[key]} max={max} />
              </div>
            ))}
          </div>

          {result.missingKeywords.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
              <p className="text-sm font-semibold text-red-700 mb-2">
                Missing Keywords ({result.missingKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {result.missingKeywords.slice(0, 40).map((kw) => (
                  <span key={kw} className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                    {kw}
                  </span>
                ))}
                {result.missingKeywords.length > 40 && (
                  <span className="text-xs text-red-500 self-center">
                    +{result.missingKeywords.length - 40} more
                  </span>
                )}
              </div>
            </div>
          )}

          {result.matchedKeywords.length > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
              <p className="text-sm font-semibold text-green-700 mb-2">
                Matched Keywords ({result.matchedKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {result.matchedKeywords.slice(0, 40).map((kw) => (
                  <span key={kw} className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/ats/AtsScorePanel.tsx
git commit -m "feat: add AtsScorePanel UI component"
```

---

### Task 5: Wire ATS tab into EditorShell

**Files:**
- Modify: `components/editor/EditorShell.tsx`

Current file has `type Tab = 'edit' | 'preview' | 'design'` on line 10 and the tab list array `['edit', 'preview', 'design']` on line 99. The tab label uses `{tab}` with CSS `capitalize`, which would render 'ats' as 'Ats' — we fix that with a label map.

- [ ] **Step 1: Add the ATS import at the top of EditorShell**

In `components/editor/EditorShell.tsx`, add after the existing component imports:

```typescript
import { AtsScorePanel } from '@/components/ats/AtsScorePanel'
```

- [ ] **Step 2: Expand the Tab type**

Replace:
```typescript
type Tab = 'edit' | 'preview' | 'design'
```
With:
```typescript
type Tab = 'edit' | 'preview' | 'design' | 'ats'
```

- [ ] **Step 3: Add label map and update tab list**

Add a label map constant above the `EditorShell` function:
```typescript
const TAB_LABELS: Record<Tab, string> = { edit: 'Edit', preview: 'Preview', design: 'Design', ats: 'ATS' }
```

Replace the tab list array:
```typescript
// Before:
{(['edit', 'preview', 'design'] as Tab[]).map((tab) => (
  <button key={tab} onClick={() => setActiveTab(tab)}
    className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
      activeTab === tab
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`}>
    {tab}
  </button>
))}

// After:
{(['edit', 'preview', 'design', 'ats'] as Tab[]).map((tab) => (
  <button key={tab} onClick={() => setActiveTab(tab)}
    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      activeTab === tab
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`}>
    {TAB_LABELS[tab]}
  </button>
))}
```

- [ ] **Step 4: Add ATS tab content div**

In the tab content section, add after the design tab div (the last `</div>` before the outer closing `</div>`):

```tsx
<div className={`h-full ${activeTab === 'ats' ? 'overflow-auto' : 'hidden'}`}>
  <AtsScorePanel />
</div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Run full test suite**

```bash
npm run test:run
```

Expected: all tests PASS (no regressions).

- [ ] **Step 7: Verify next build succeeds**

```bash
npx next build 2>&1 | tail -15
```

Expected: `✓ Compiled successfully` with `/api/resumes/[id]/ats-score` listed in routes.

- [ ] **Step 8: Manual QA**

Start the dev server (`npm run dev`), sign in, open a resume, click the **ATS** tab. Verify:
- A textarea appears for job description input.
- Empty textarea keeps the Analyze button disabled.
- Pasting a job description and clicking **Analyze** calls `/api/resumes/[id]/ats-score` and renders a score.
- The large score number is green (≥70), yellow (40–69), or red (<40).
- 4 breakdown bars show correct label and `value / max` counts.
- Missing keywords appear as red chips; matched keywords as green chips.
- Clicking Analyze a second time with different text updates the result.

- [ ] **Step 9: Commit**

```bash
git add components/editor/EditorShell.tsx
git commit -m "feat: wire ATS tab into EditorShell"
```
