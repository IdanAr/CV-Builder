# Sprint 4 — AI Pipeline Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two of the three items from the original Sprint 4 scope (multi-model routing to Groq was explicitly deferred by the user — it needs an external API key/account they haven't set up, unlike these two, which are self-contained improvements to the existing Claude-only pipeline):
1. `lib/ai/pipeline.ts`'s Teacher-Student Council currently refines once and never re-checks the fix — a bounded re-critique loop closes that gap.
2. `lib/ai/hallucination-guard.ts` only catches invented numeric claims; it has no way to catch an invented skill or technology the AI slipped into a suggestion.

**Architecture:** No new dependencies, no new external services. Task 1 changes control flow inside `runSuggestionPipeline` only. Task 2 adds one new conservative, dictionary-based export to `lib/ats/keywords.ts` (reusing the `TECH_TERMS` set and proper-noun/acronym heuristic already built there) and has `hallucination-guard.ts` call it — deliberately NOT reusing the existing `extractKeywords` function wholesale, because its hyphen/digit/repetition heuristics (tuned for parsing long job descriptions) produce false positives on short AI-generated bullets (e.g. flagging the ordinary phrase "cross-functional" as an invented technology). Precision matters more here than in JD parsing: a false-positive hallucination warning erodes trust in the guard itself.

**Tech Stack:** TypeScript, Vitest, Anthropic SDK (unchanged), existing `lib/ats/keywords.ts` internals.

## Global Constraints

- All work happens inside `cv-builder/`. All paths below are relative to `cv-builder/`.
- Work on branch `feat/sprint4-ai-quality` (create from `main`).
- Run tests with `npx vitest run <path>` from `cv-builder/`. Full suite: `npx vitest run`. Type check: `npx tsc --noEmit`. Production build gate at the end: `npm run build`.
- No new npm dependencies. No Groq integration in this sprint — explicitly deferred.
- `detectHallucinations` is shared between `lib/ai/pipeline.ts` (the original suggestion pipeline) and `lib/ai/ats-fix-pipeline.ts` (the Sprint 3 tailoring pipeline) — Task 2 changes its behavior for both callers. This is intentional and desirable (both should catch invented skills, not just invented numbers), but run the full `lib/ai` and `lib/ats` test directories after Task 2 to confirm neither caller's existing tests broke.
- Commit after every task with a conventional-commit message ending in:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Bounded re-critique pass after refinement

**Why:** `runSuggestionPipeline` today is generate → critique → refine, full stop. If critique finds an issue and refine "fixes" it, nothing ever re-checks whether the fix actually resolved the issue (or introduced a new one). A real Teacher-Student Council should verify the student's correction before finalizing it.

**Files:**
- Modify: `lib/ai/pipeline.ts`
- Modify: `lib/ai/__tests__/pipeline.test.ts`

**Exact change to `runSuggestionPipeline`:**
```ts
const MAX_REFINE_ROUNDS = 2

export async function runSuggestionPipeline(input: string, ctx: PipelineContext): Promise<PipelineResult> {
  let suggestion = await generate(input, ctx)
  for (let round = 0; round < MAX_REFINE_ROUNDS; round++) {
    const critiqueNotes = await critique(input, suggestion, ctx.field)
    if (critiqueNotes.toUpperCase().startsWith('APPROVED')) break
    suggestion = await refine(input, suggestion, critiqueNotes, ctx.field)
  }
  const pendingApprovals = detectHallucinations(input, suggestion)
  return { suggestion, pendingApprovals }
}
```
Also simplify `refine()` — remove its internal `if (critiqueNotes.toUpperCase().startsWith('APPROVED')) return generated` early-return guard. That check is now the loop's responsibility (the loop never calls `refine` unless critique already failed), so the guard inside `refine` is dead code once the loop is in place.

This bounds the pipeline at 1 generate + up to 2 critique + up to 2 refine = 5 calls max. The common good-path case (critique approves on the first pass) costs exactly the same 2 calls as today (1 generate + 1 critique, `refine` never invoked) — no regression for the case that already worked.

**Test updates required (read carefully — this changes an existing test's expected call count, not just adds new tests):**
- The existing test `'calls refinement (third Anthropic call) when critique finds issues'` mocks exactly 3 responses (generate, critique-fail, refine-fix) and asserts `toHaveBeenCalledTimes(3)`. Under the new loop, after that refine the code now calls `critique` a second time (round 2) — the mock queue has no 4th response queued, so this test will now throw/fail. Update it: add a 4th mocked response of `'APPROVED'` (the second critique approving the refined text), and change the assertion to `toHaveBeenCalledTimes(4)`.

- [ ] **Step 1: Write/update failing tests first.**
  - Update the test above to the 4-call/APPROVED-on-round-2 scenario.
  - Add a new test: `'re-critiques after refinement and refines again if still not approved, bounded at 2 rounds'` — mock 5 responses (generate → critique-fail → refine → critique-fail-again → refine-again), assert `toHaveBeenCalledTimes(5)` and that `result.suggestion` equals the final (5th) refine's output — proving the loop runs a genuine second refine round and then stops (doesn't attempt a 3rd critique).
  - Confirm the existing `'returns generated text when critique is APPROVED (no refinement call)'` test still passes unmodified (it should — first-critique-approves is unaffected by this change) and still asserts exactly 2 calls.
- [ ] **Step 2: Run `lib/ai/__tests__/pipeline.test.ts`, confirm the updated/new tests fail** against the current one-shot implementation.
- [ ] **Step 3: Apply the code change above.**
- [ ] **Step 4: Run tests, confirm all pass**, including the other existing tests in this file (jobTitle/company passthrough, summary field, pendingApprovals cases) — none of those should need changes.
- [ ] **Step 5: Commit.**

---

### Task 2: Extend the hallucination guard to catch invented skills/technologies

**Why:** Today `detectHallucinations` only flags numeric claims (percentages, dollar amounts, multipliers, standalone numbers) absent from the original input. An AI suggestion that invents a skill or technology the candidate never mentioned — e.g. writing "led a Kubernetes migration" when the candidate's notes never said Kubernetes — passes through with zero warning.

**Files:**
- Modify: `lib/ats/keywords.ts` — add a new exported function (do not change `extractKeywords`'s existing behavior or tests)
- Modify: `lib/ai/hallucination-guard.ts`
- Modify: `lib/ats/__tests__/keywords.test.ts`
- Modify: `lib/ai/__tests__/hallucination-guard.test.ts`

**New export in `lib/ats/keywords.ts`** (reuses the existing private `TECH_TERMS` set, `tokenizeWithCase`, and `looksLikeProperNounOrAcronym` helpers already defined in this file — do not duplicate them):
```ts
/**
 * Conservative technology/skill-term detector for short AI-generated text
 * (a single bullet or summary), used by the hallucination guard. Unlike
 * extractKeywords() — tuned for parsing long job descriptions — this only
 * matches the curated TECH_TERMS dictionary or a strict proper-noun/acronym
 * casing signal. It deliberately skips the hyphen/digit/repetition
 * heuristics extractKeywords uses, since those produce false positives on
 * short text (e.g. flagging the ordinary phrase "cross-functional" as an
 * invented technology).
 */
export function extractTechTerms(text: string): string[] {
  const rawTokens = tokenizeWithCase(text)
  const seen = new Set<string>()
  const found: string[] = []
  for (const raw of rawTokens) {
    const lower = raw.toLowerCase()
    if (lower.length < 3 || seen.has(lower)) continue
    if (TECH_TERMS.has(lower) || looksLikeProperNounOrAcronym(raw)) {
      seen.add(lower)
      found.push(lower)
    }
  }
  return found
}
```

**Change to `lib/ai/hallucination-guard.ts`:**
```ts
import { extractTechTerms } from '@/lib/ats/keywords'

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

  const all = Array.from(found)
  const numericClaims = all.filter(candidate => !all.some(other => other !== candidate && other.includes(candidate)))

  const inventedSkills = extractTechTerms(generatedText).filter(term => !lowerOriginal.includes(term))

  return Array.from(new Set([...numericClaims, ...inventedSkills]))
}
```

- [ ] **Step 1: Write failing tests.**
  - In `lib/ats/__tests__/keywords.test.ts`: add tests for `extractTechTerms` — a known dictionary term (e.g. "kubernetes") is detected in lowercase text; a PascalCase term not in the dictionary (e.g. "LaunchDarkly") is detected; an ordinary hyphenated business phrase (e.g. "cross-functional", "customer-facing") is NOT detected (this is the specific false-positive this task exists to avoid) — this is the test that would have caught the design mistake of reusing `extractKeywords` wholesale.
  - In `lib/ai/__tests__/hallucination-guard.test.ts`: add a test that a technology mentioned in generated text but absent from original input is flagged (e.g. original `'built a data pipeline for reporting'`, generated `'Built a Kubernetes data pipeline for reporting'`, expect result to contain `'kubernetes'`); add a test that a technology already present in the original input is NOT flagged; add a test using an ordinary hyphenated phrase (matching the audit's own example) confirming it's still not flagged as an invented skill (e.g. original `'led a small team'`, generated `'Led a cross-functional team to deliver the project on time'`, expect `result` to be empty).
  - Run all existing tests in both files first and confirm they still pass unmodified before adding new ones (sanity check that the existing numeric-claim tests are unaffected) — do not weaken any existing assertion.
- [ ] **Step 2: Run tests, confirm the new ones fail** (function/behavior doesn't exist yet).
- [ ] **Step 3: Implement `extractTechTerms` and the `detectHallucinations` change above.**
- [ ] **Step 4: Run tests, confirm all pass.** Then run the full `lib/ai` and `lib/ats` test directories (not just these two files) — `detectHallucinations` is called from `ats-fix-pipeline.ts` too, and its existing tests may now surface previously-uncaught `pendingApprovals` if any test fixture's "suggested" text happens to contain a recognizable tech term absent from its "original" text. If any such test needs updating, update its expectations to reflect the new, correct, more-thorough behavior — don't weaken the new detection to make an old fixture pass.
- [ ] **Step 5: Commit.**

---

### Task 3: Final verification gate

- [ ] Run `npx vitest run` from `cv-builder/` — full suite must be green. Note before/after test counts (baseline going into this sprint: 58 files / 498 tests, per the current state of `feat/sprint3-job-tailoring-workspace` — but this sprint branches from `main`, so the true baseline will be lower; report the actual starting number, don't assume it matches Sprint 3's branch).
- [ ] Run `npx tsc --noEmit` — must be clean.
- [ ] Run `npm run build` — must succeed.
- [ ] Write a task-by-task report: commit hashes, test counts before/after per task, any deviations from this plan, and open decisions for the human (e.g. whether `MAX_REFINE_ROUNDS = 2` is the right bound, or whether the deferred Groq routing should be its own future sprint).
- [ ] **No push, merge, or PR** — stop here and report, exactly as in Sprints 1–3.
