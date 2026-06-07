# Phase 3b: AI Co-Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-powered suggestion button to work highlight bullets and the professional summary field, using a 3-agent Teacher-Student pipeline (Groq → Groq → Claude) with a hallucination guard that flags newly invented metrics for user approval before they're committed.

**Architecture:** A pure-TypeScript pipeline module calls three sequential LLM calls (Generation via Groq, Critique via Groq, Refinement via Claude Haiku only when critique finds issues). The API route (`/api/resumes/[id]/ai-suggest`) is auth-guarded and passes the pipeline result — including `pendingApprovals` phrases — back to the client. The `AiSuggestButton` component renders a ✨ icon next to each input; clicking it shows an inline popover with the suggestion, highlights unverified numbers/metrics in yellow, and lets the user accept or dismiss.

**Tech Stack:** `@anthropic-ai/sdk` (Claude Haiku for all three pipeline steps: generation, critique, refinement), existing Next.js 14 auth pattern, existing Zustand store (read-only for `resumeId`), Tailwind CSS.

**Pre-requisites:** Phase 3a complete. `ANTHROPIC_API_KEY` and `GROQ_API_KEY` must be set in `.env.local`.

---

## File Map

**New:**
- `lib/ai/models.ts` — lazy singleton factory: `getAnthropic()`
- `lib/ai/hallucination-guard.ts` — `detectHallucinations(original, generated): string[]`
- `lib/ai/pipeline.ts` — `runSuggestionPipeline(input, context): Promise<PipelineResult>`
- `lib/ai/__tests__/hallucination-guard.test.ts`
- `lib/ai/__tests__/pipeline.test.ts`
- `app/api/resumes/[id]/ai-suggest/route.ts` — auth-guarded POST handler
- `app/api/resumes/[id]/ai-suggest/route.test.ts`
- `components/ai/AiSuggestButton.tsx` — self-contained button + inline suggestion popover

**Modified:**
- `.env.local.example` — add `ANTHROPIC_API_KEY` and `GROQ_API_KEY` lines
- `components/editor/forms/WorkForm.tsx` — pass `resumeId` to `WorkItemForm`, add `AiSuggestButton` next to each highlight input
- `components/editor/forms/BasicsForm.tsx` — add `AiSuggestButton` next to the summary textarea

---

### Task 1: Install AI packages, model client factories, update env example

**Files:**
- Modify: `package.json` (via npm install)
- Create: `lib/ai/models.ts`
- Modify: `.env.local.example`

- [ ] **Step 1: Install packages**

```bash
npm install @anthropic-ai/sdk groq-sdk
```

Expected output includes `added ... packages` with both packages listed.

- [ ] **Step 2: Create the model client factories**

```typescript
// lib/ai/models.ts
import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'

let _anthropic: Anthropic | null = null
let _groq: Groq | null = null

export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

export function getGroq(): Groq {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set')
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return _groq
}
```

- [ ] **Step 3: Add env vars to .env.local.example**

In `.env.local.example`, add after the existing Google OAuth block:

```
# AI Co-Pilot
# Anthropic — get API key at https://console.anthropic.com/
ANTHROPIC_API_KEY=

# Groq — get API key at https://console.groq.com/
GROQ_API_KEY=
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/models.ts .env.local.example package.json package-lock.json
git commit -m "feat: install AI SDKs and add model client factories"
```

---

### Task 2: Hallucination guard utility

**Files:**
- Create: `lib/ai/hallucination-guard.ts`
- Create: `lib/ai/__tests__/hallucination-guard.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/ai/__tests__/hallucination-guard.test.ts
import { describe, it, expect } from 'vitest'
import { detectHallucinations } from '../hallucination-guard'

describe('detectHallucinations', () => {
  it('detects percentage not in original', () => {
    const result = detectHallucinations(
      'built react dashboard for users',
      'Built React dashboard used by 500 users, increasing retention by 40%'
    )
    expect(result).toContain('40%')
  })

  it('detects standalone numbers not in original', () => {
    const result = detectHallucinations(
      'built react dashboard for users',
      'Built React dashboard used by 500 users'
    )
    expect(result).toContain('500')
  })

  it('does not flag numbers that were in the original', () => {
    const result = detectHallucinations(
      'built react dashboard 500 users 40%',
      'Built React dashboard used by 500 users, increasing retention by 40%'
    )
    expect(result).toHaveLength(0)
  })

  it('detects dollar amounts not in original', () => {
    const result = detectHallucinations(
      'managed team projects',
      'Managed $2M budget across 3 projects'
    )
    expect(result).toContain('$2M')
  })

  it('detects multipliers not in original', () => {
    const result = detectHallucinations(
      'improved performance',
      'Improved performance by 3x in production'
    )
    expect(result).toContain('3x')
  })

  it('returns empty array when no numbers in generated text', () => {
    const result = detectHallucinations('', 'Developed software solutions for clients')
    expect(result).toHaveLength(0)
  })

  it('returns unique values only (no duplicates)', () => {
    const result = detectHallucinations(
      'some work',
      'Achieved 40% improvement and then another 40% improvement'
    )
    expect(result.filter(v => v === '40%')).toHaveLength(1)
  })

  it('does not flag single-digit standalone numbers', () => {
    const result = detectHallucinations(
      'led team',
      'Led a team of 5 engineers'
    )
    expect(result).not.toContain('5')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/ai/__tests__/hallucination-guard.test.ts
```

Expected: FAIL — `Cannot find module '../hallucination-guard'`

- [ ] **Step 3: Create the hallucination guard**

```typescript
// lib/ai/hallucination-guard.ts

// Patterns that represent verifiable claims (metrics, quantities)
const CLAIM_PATTERNS: RegExp[] = [
  /\d+%/g,           // percentages: 40%, 15%
  /\$\d+[kmb]?/gi,   // dollar amounts: $2M, $50k, $500
  /\b\d+[xX]\b/g,    // multipliers: 3x, 10X
  /\b\d{2,}\b/g,     // standalone numbers with 2+ digits: 500, 40
]

export function detectHallucinations(originalInput: string, generatedText: string): string[] {
  const lowerOriginal = originalInput.toLowerCase()
  const found = new Set<string>()

  for (const pattern of CLAIM_PATTERNS) {
    const matches = generatedText.match(pattern) ?? []
    for (const match of matches) {
      if (!lowerOriginal.includes(match.toLowerCase())) {
        found.add(match)
      }
    }
  }

  return [...found]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/ai/__tests__/hallucination-guard.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/hallucination-guard.ts lib/ai/__tests__/hallucination-guard.test.ts
git commit -m "feat: add hallucination guard for AI-generated metric detection"
```

---

### Task 3: AI suggestion pipeline (3-agent)

**Files:**
- Create: `lib/ai/pipeline.ts`
- Create: `lib/ai/__tests__/pipeline.test.ts`

The pipeline runs three sequential LLM calls:
1. **Generate** (Groq, `llama-3.3-70b-versatile`) — expands terse user notes into a polished bullet or summary
2. **Critique** (Groq) — checks for action verb, metric presence, no invented facts; replies "APPROVED" or lists issues
3. **Refine** (Claude `claude-haiku-4-5-20251001`) — applies critique notes; skipped if critique is APPROVED

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/ai/__tests__/pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGroqCreate = vi.fn()
const mockAnthropicCreate = vi.fn()

vi.mock('../models', () => ({
  getGroq: () => ({
    chat: { completions: { create: mockGroqCreate } },
  }),
  getAnthropic: () => ({
    messages: { create: mockAnthropicCreate },
  }),
}))

describe('runSuggestionPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns generated text when critique is APPROVED', async () => {
    mockGroqCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Built React dashboard for 500 users' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'APPROVED' } }] })

    const { runSuggestionPipeline } = await import('../pipeline')
    const result = await runSuggestionPipeline('react dashboard 500 users', { field: 'highlight' })

    expect(result.suggestion).toBe('Built React dashboard for 500 users')
    expect(mockAnthropicCreate).not.toHaveBeenCalled()
  })

  it('calls Anthropic refinement when critique finds issues', async () => {
    mockGroqCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Built React dashboard for 500 users, boosting retention by 40%' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: '40% is not in original notes' } }] })
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Built React dashboard for 500 users' }],
    })

    const { runSuggestionPipeline } = await import('../pipeline')
    const result = await runSuggestionPipeline('react dashboard 500 users', { field: 'highlight' })

    expect(mockAnthropicCreate).toHaveBeenCalledOnce()
    expect(result.suggestion).toBe('Built React dashboard for 500 users')
  })

  it('returns pendingApprovals for metrics not in original input', async () => {
    mockGroqCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Increased revenue by 40%' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'APPROVED' } }] })

    const { runSuggestionPipeline } = await import('../pipeline')
    const result = await runSuggestionPipeline('increased revenue', { field: 'highlight' })

    expect(result.pendingApprovals).toContain('40%')
  })

  it('returns empty pendingApprovals when all metrics were in original input', async () => {
    mockGroqCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Increased revenue by 40%' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'APPROVED' } }] })

    const { runSuggestionPipeline } = await import('../pipeline')
    const result = await runSuggestionPipeline('increased revenue 40%', { field: 'highlight' })

    expect(result.pendingApprovals).toHaveLength(0)
  })

  it('works for summary field', async () => {
    mockGroqCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Senior engineer with 5 years experience.' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'APPROVED' } }] })

    const { runSuggestionPipeline } = await import('../pipeline')
    const result = await runSuggestionPipeline('senior engineer 5 years', { field: 'summary' })

    expect(result.suggestion).toContain('engineer')
    expect(typeof result.suggestion).toBe('string')
  })

  it('passes jobTitle and company as context to generation prompt', async () => {
    mockGroqCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Led frontend at Acme Corp' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'APPROVED' } }] })

    const { runSuggestionPipeline } = await import('../pipeline')
    await runSuggestionPipeline('led frontend', { field: 'highlight', jobTitle: 'Engineer', company: 'Acme Corp' })

    const firstCallPrompt = mockGroqCreate.mock.calls[0][0].messages[0].content as string
    expect(firstCallPrompt).toContain('Acme Corp')
    expect(firstCallPrompt).toContain('Engineer')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/ai/__tests__/pipeline.test.ts
```

Expected: FAIL — `Cannot find module '../pipeline'`

- [ ] **Step 3: Create the pipeline**

```typescript
// lib/ai/pipeline.ts
import { getAnthropic, getGroq } from './models'
import { detectHallucinations } from './hallucination-guard'

export type SuggestionField = 'highlight' | 'summary'

export interface PipelineResult {
  suggestion: string
  pendingApprovals: string[]
}

interface PipelineContext {
  jobTitle?: string
  company?: string
  field: SuggestionField
}

async function generate(input: string, ctx: PipelineContext): Promise<string> {
  const groq = getGroq()
  const contextStr = [
    ctx.jobTitle && `Job title: ${ctx.jobTitle}`,
    ctx.company && `Company: ${ctx.company}`,
  ].filter(Boolean).join('. ')

  const prompt = ctx.field === 'highlight'
    ? `You are a professional CV writer. Candidate's rough notes: "${input}". ${contextStr ? contextStr + '.' : ''} Write exactly ONE powerful bullet point (max 20 words) using ONLY facts from the notes. Start with a strong past-tense action verb. Return the bullet text only, no prefix character.`
    : `You are a professional CV writer. Candidate's notes: "${input}". ${contextStr ? contextStr + '.' : ''} Write a 2-sentence professional CV summary using ONLY facts provided. First sentence: role and expertise level. Second sentence: key strength and impact. Return the summary text only.`

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
    temperature: 0.3,
  })
  return completion.choices[0]?.message?.content?.trim() ?? ''
}

async function critique(input: string, generated: string, field: SuggestionField): Promise<string> {
  const groq = getGroq()
  const prompt = field === 'highlight'
    ? `Review this CV bullet against the candidate's original notes.\nOriginal notes: "${input}"\nGenerated bullet: "${generated}"\nCheck: 1) Does it start with an action verb? 2) Are ALL numbers/percentages taken directly from the original notes? 3) No invented facts?\nReply "APPROVED" if all pass, or list specific issues briefly (max 30 words).`
    : `Review this CV summary against the candidate's original notes.\nOriginal notes: "${input}"\nGenerated summary: "${generated}"\nCheck: Are all facts and figures from the original? Is the tone professional?\nReply "APPROVED" or list issues briefly (max 30 words).`

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 80,
    temperature: 0.1,
  })
  return completion.choices[0]?.message?.content?.trim() ?? 'APPROVED'
}

async function refine(input: string, generated: string, critiqueNotes: string, field: SuggestionField): Promise<string> {
  if (critiqueNotes.toUpperCase().startsWith('APPROVED')) return generated
  const anthropic = getAnthropic()
  const prompt = field === 'highlight'
    ? `Fix this CV bullet based on the feedback.\nCandidate's original notes: "${input}"\nCurrent bullet: "${generated}"\nFeedback: ${critiqueNotes}\nReturn ONLY the corrected bullet (max 20 words, no prefix character).`
    : `Fix this CV summary based on the feedback.\nCandidate's original notes: "${input}"\nCurrent summary: "${generated}"\nFeedback: ${critiqueNotes}\nReturn ONLY the corrected summary.`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = msg.content[0]
  return block.type === 'text' ? block.text.trim() : generated
}

export async function runSuggestionPipeline(input: string, ctx: PipelineContext): Promise<PipelineResult> {
  const generated = await generate(input, ctx)
  const critiqueNotes = await critique(input, generated, ctx.field)
  const suggestion = await refine(input, generated, critiqueNotes, ctx.field)
  const pendingApprovals = detectHallucinations(input, suggestion)
  return { suggestion, pendingApprovals }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/ai/__tests__/pipeline.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run full test suite to verify no regressions**

```bash
npm run test:run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/pipeline.ts lib/ai/__tests__/pipeline.test.ts
git commit -m "feat: add 3-agent AI suggestion pipeline (Groq generation/critique + Claude refinement)"
```

---

### Task 4: AI suggest API route

**Files:**
- Create: `app/api/resumes/[id]/ai-suggest/route.ts`
- Create: `app/api/resumes/[id]/ai-suggest/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/resumes/[id]/ai-suggest/route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: null }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(),
}))

vi.mock('@/lib/ai/pipeline', () => ({
  runSuggestionPipeline: vi.fn(),
}))

describe('POST /api/resumes/[id]/ai-suggest', () => {
  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ai-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'built a dashboard', field: 'highlight' }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(401)
  })

  it('returns 400 when input is empty', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce((handler) => async (req: Request, ctx: unknown) => {
      return handler(Object.assign(req, { auth: { user: { id: 'user-1' } } }), ctx)
    })
    const { getResume } = await import('@/lib/api/resumes')
    vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV', data: {}, meta: {} } as never)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/ai-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: '   ', field: 'highlight' }),
    })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run "app/api/resumes/[id]/ai-suggest/route.test.ts"
```

Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Create the route**

```typescript
// app/api/resumes/[id]/ai-suggest/route.ts
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { runSuggestionPipeline } from '@/lib/ai/pipeline'
import type { SuggestionField } from '@/lib/ai/pipeline'

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
  const input: string = typeof body.input === 'string' ? body.input.slice(0, 500) : ''
  const field: SuggestionField = body.field === 'summary' ? 'summary' : 'highlight'
  const jobTitle: string | undefined = typeof body.jobTitle === 'string' ? body.jobTitle : undefined
  const company: string | undefined = typeof body.company === 'string' ? body.company : undefined

  if (!input.trim()) {
    return new Response(JSON.stringify({ error: 'Input is required' }), { status: 400 })
  }

  try {
    const result = await runSuggestionPipeline(input, { field, jobTitle, company })
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'AI suggestion failed' }), { status: 500 })
  }
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run "app/api/resumes/[id]/ai-suggest/route.test.ts"
```

Expected: 2 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm run test:run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/api/resumes/[id]/ai-suggest/"
git commit -m "feat: add AI suggest API route with auth guard and input validation"
```

---

### Task 5: AiSuggestButton component

**Files:**
- Create: `components/ai/AiSuggestButton.tsx`

No automated test — client component with fetch; verified manually in Task 6.

- [ ] **Step 1: Create the component**

```tsx
// components/ai/AiSuggestButton.tsx
'use client'

import { useState } from 'react'
import type { SuggestionField, PipelineResult } from '@/lib/ai/pipeline'

interface AiSuggestButtonProps {
  resumeId: string
  currentValue: string
  context: { jobTitle?: string; company?: string; field: SuggestionField }
  onAccept: (value: string) => void
}

function highlightApprovals(text: string, approvals: string[]): React.ReactNode {
  if (approvals.length === 0) return <>{text}</>
  let nodes: React.ReactNode[] = [text]
  for (const phrase of approvals) {
    nodes = nodes.flatMap((node, nodeIdx) => {
      if (typeof node !== 'string') return [node]
      const lowerNode = node.toLowerCase()
      const idx = lowerNode.indexOf(phrase.toLowerCase())
      if (idx === -1) return [node]
      return [
        node.slice(0, idx),
        <mark
          key={`${nodeIdx}-${phrase}`}
          className="bg-yellow-200 text-yellow-900 rounded px-0.5"
          title="Not in your original notes — please verify before accepting"
        >
          {node.slice(idx, idx + phrase.length)}
        </mark>,
        node.slice(idx + phrase.length),
      ]
    })
  }
  return <>{nodes}</>
}

export function AiSuggestButton({ resumeId, currentValue, context, onAccept }: AiSuggestButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!resumeId || !currentValue.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/resumes/${resumeId}/ai-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: currentValue, ...context }),
      })
      if (!res.ok) throw new Error('AI suggestion failed')
      setResult(await res.json())
    } catch {
      setError('Failed to generate suggestion. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleAccept() {
    if (result) {
      onAccept(result.suggestion)
      setResult(null)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !currentValue.trim() || !resumeId}
        title={loading ? 'Generating…' : 'Generate AI suggestion'}
        aria-label="Generate AI suggestion"
        className="px-1.5 py-1 text-sm text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors disabled:opacity-30"
      >
        {loading ? '…' : '✨'}
      </button>

      {error && (
        <div className="absolute top-full right-0 z-20 mt-1 w-56 rounded-lg border border-red-200 bg-red-50 p-2 shadow-sm">
          <p className="text-xs text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-1 text-xs text-red-400 hover:text-red-600"
          >
            Dismiss
          </button>
        </div>
      )}

      {result && (
        <div className="absolute top-full right-0 z-20 mt-1 w-80 rounded-lg border border-purple-200 bg-white p-3 shadow-lg">
          {result.pendingApprovals.length > 0 && (
            <p className="mb-2 rounded border border-yellow-200 bg-yellow-50 px-2 py-1 text-xs text-yellow-700">
              Highlighted items were not in your original notes — verify before accepting.
            </p>
          )}
          <p className="mb-3 text-sm leading-relaxed text-gray-800">
            {highlightApprovals(result.suggestion, result.pendingApprovals)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              className="rounded bg-purple-600 px-3 py-1 text-xs text-white transition-colors hover:bg-purple-700"
            >
              Use this
            </button>
            <button
              onClick={() => setResult(null)}
              className="rounded px-3 py-1 text-xs text-gray-500 transition-colors hover:text-gray-700"
            >
              Dismiss
            </button>
          </div>
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
git add components/ai/AiSuggestButton.tsx
git commit -m "feat: add AiSuggestButton with inline suggestion popover and hallucination highlighting"
```

---

### Task 6: Wire AiSuggestButton into WorkForm and BasicsForm

**Files:**
- Modify: `components/editor/forms/WorkForm.tsx`
- Modify: `components/editor/forms/BasicsForm.tsx`

- [ ] **Step 1: Update WorkForm to pass resumeId and add AI button to highlights**

Replace the entire content of `components/editor/forms/WorkForm.tsx` with:

```tsx
// components/editor/forms/WorkForm.tsx
'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { AiSuggestButton } from '@/components/ai/AiSuggestButton'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type WorkItem = NonNullable<ResumeData['work']>[number]

const EMPTY_WORK: WorkItem[] = []

const createEmpty = (): WorkItem => ({
  name: '', position: '', url: '', startDate: '', endDate: '', summary: '', highlights: [],
})

const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

function WorkItemForm({
  item,
  resumeId,
  onUpdate,
  onRemove,
}: {
  item: WorkItem
  resumeId: string
  onUpdate: (v: WorkItem) => void
  onRemove: () => void
}) {
  const set = (field: keyof WorkItem, value: string) => onUpdate({ ...item, [field]: value })

  const setHighlights = (highlights: string[]) => onUpdate({ ...item, highlights })
  const addHighlight = () => setHighlights([...(item.highlights ?? []), ''])
  const updateHighlight = (i: number, v: string) =>
    setHighlights((item.highlights ?? []).map((h, idx) => (idx === i ? v : h)))
  const removeHighlight = (i: number) =>
    setHighlights((item.highlights ?? []).filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <input type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Company name" className={inputClass} />
          <input type="text" value={item.position ?? ''} onChange={(e) => set('position', e.target.value)}
            placeholder="Job title" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove work entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)}
          placeholder="Start date (2020-01)" className={inputClass} />
        <input type="text" value={item.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)}
          placeholder="End date or Present" className={inputClass} />
      </div>
      <textarea value={item.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
        placeholder="Role summary..." rows={2}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-600">Bullet points</label>
        {(item.highlights ?? []).map((h, i) => (
          <div key={i} className="flex gap-1 items-center">
            <input type="text" value={h} onChange={(e) => updateHighlight(i, e.target.value)}
              placeholder="Achieved X by doing Y, resulting in Z" className={`${inputClass} flex-1`} />
            <AiSuggestButton
              resumeId={resumeId}
              currentValue={h}
              context={{ jobTitle: item.position, company: item.name, field: 'highlight' }}
              onAccept={(v) => updateHighlight(i, v)}
            />
            <button type="button" onClick={() => removeHighlight(i)} aria-label="Remove highlight"
              className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
          </div>
        ))}
        <button type="button" onClick={addHighlight}
          className="text-xs text-blue-600 hover:text-blue-800">+ Add bullet</button>
      </div>
    </div>
  )
}

export function WorkForm() {
  const work = useResumeEditorStore((s) => s.data.work ?? EMPTY_WORK)
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<WorkItem>
      items={work}
      onChange={(items) => setSectionData('work', items)}
      createEmpty={createEmpty}
      addLabel="Add work experience"
      renderItem={(item, _, onUpdate, onRemove) => (
        <WorkItemForm item={item} resumeId={resumeId} onUpdate={onUpdate} onRemove={onRemove} />
      )}
    />
  )
}
```

- [ ] **Step 2: Update BasicsForm to add AI button next to the summary field**

Replace the entire content of `components/editor/forms/BasicsForm.tsx` with:

```tsx
// components/editor/forms/BasicsForm.tsx
'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { AiSuggestButton } from '@/components/ai/AiSuggestButton'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Basics = NonNullable<ResumeData['basics']>

const EMPTY_BASICS: Basics = {}

export function BasicsForm() {
  const basics = useResumeEditorStore((s) => s.data.basics ?? EMPTY_BASICS)
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)

  const set = (field: string, value: string) =>
    setSectionData('basics', { ...basics, [field]: value })

  const setLocation = (field: string, value: string) =>
    setSectionData('basics', { ...basics, location: { ...basics.location, [field]: value } })

  const inputClass =
    'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
          <input type="text" value={basics.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Jane Smith" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Job Title</label>
          <input type="text" value={basics.label ?? ''} onChange={(e) => set('label', e.target.value)}
            placeholder="Software Engineer" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input type="email" value={basics.email ?? ''} onChange={(e) => set('email', e.target.value)}
            placeholder="jane@example.com" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
          <input type="tel" value={basics.phone ?? ''} onChange={(e) => set('phone', e.target.value)}
            placeholder="+1 555 123 4567" className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Website URL</label>
        <input type="url" value={basics.url ?? ''} onChange={(e) => set('url', e.target.value)}
          placeholder="https://janesmith.dev" className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
          <input type="text" value={basics.location?.city ?? ''}
            onChange={(e) => setLocation('city', e.target.value)}
            placeholder="San Francisco" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
          <input type="text" value={basics.location?.region ?? ''}
            onChange={(e) => setLocation('region', e.target.value)}
            placeholder="CA" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
          <input type="text" value={basics.location?.countryCode ?? ''}
            onChange={(e) => setLocation('countryCode', e.target.value)}
            placeholder="US" className={inputClass} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-600">Professional Summary</label>
          <AiSuggestButton
            resumeId={resumeId}
            currentValue={basics.summary ?? ''}
            context={{ field: 'summary' }}
            onAccept={(v) => set('summary', v)}
          />
        </div>
        <textarea value={basics.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
          placeholder="Brief professional summary..." rows={4}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run full test suite**

```bash
npm run test:run
```

Expected: all tests PASS (no regressions in WorkForm or BasicsForm tests).

- [ ] **Step 5: Verify next build succeeds**

```bash
npx next build 2>&1 | tail -15
```

Expected: `✓ Compiled successfully` with `/api/resumes/[id]/ai-suggest` listed in routes.

- [ ] **Step 6: Manual QA**

Set `ANTHROPIC_API_KEY` and `GROQ_API_KEY` in `.env.local`, then start the dev server (`npm run dev`), sign in, open a resume.

Verify in **Edit tab → Work Experience** section:
- A `✨` button appears to the right of each bullet point input.
- Button is disabled (faded) when the input is empty.
- Type a terse note ("built dashboard 500 users") and click `✨` → button shows `…` while loading.
- A popover appears below the button with a polished suggestion.
- If the AI invented a number not in the original input, it is highlighted in yellow.
- "Use this" replaces the input value with the suggestion and closes the popover.
- "Dismiss" closes the popover without changing the input.

Verify in **Edit tab → Profile** section:
- A `✨` button appears next to the "Professional Summary" label.
- Same flow works for summary text.

- [ ] **Step 7: Commit**

```bash
git add components/editor/forms/WorkForm.tsx components/editor/forms/BasicsForm.tsx
git commit -m "feat: wire AiSuggestButton into WorkForm highlights and BasicsForm summary"
```
