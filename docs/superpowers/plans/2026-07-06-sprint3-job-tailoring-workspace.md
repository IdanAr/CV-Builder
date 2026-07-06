# Sprint 3 — Job-Tailoring Workspace v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing "Fix All with AI" keyword-patcher into the flagship Job-Tailoring Workspace v1 called out in the roadmap — a genuinely whole-resume tailoring pass (not a 5-fix ceiling), able to draft a brand-new tailored summary when none exists, reviewed through the same trusted diff+approval UI. Alongside it, replace the ATS "Format & Structure Integrity" vector's field-presence checks with real structural/completeness analysis, per the compliance audit finding that it currently "scores field presence... not actual structural or formatting analysis."

**Architecture:** No new dependencies, no new page/route. This sprint widens `lib/ai/ats-fix-pipeline.ts` (already correct in its hardest part — the verbatim-quote match guard that prevents applying a fix to stale/invented text — and `lib/ai/hallucination-guard.ts`'s numeric-claim detection) and `components/ats/AtsFixReviewPanel.tsx` (already a solid diff+approve UI) to cover more of the resume in one pass, including a genuinely new capability: proposing a from-scratch tailored summary when the user has none. `lib/ats/scorer.ts`'s `scoreFormat` is replaced with five proportional structural checks instead of five presence booleans, keeping the same 25-point ceiling and function signature.

**Tech Stack:** Next.js 14 App Router, TypeScript, Zustand, Anthropic SDK (Claude Haiku), Vitest + Testing Library.

## Global Constraints

- All work happens inside `cv-builder/`. All paths below are relative to `cv-builder/`.
- Work on branch `feat/sprint3-job-tailoring-workspace` (create from `main` before Task 1 — Sprint 2's branch `feat/sprint2-compliance-parity` is a separate, already-complete unit of work sitting for review; do not build Sprint 3 on top of it unless explicitly told to).
- Run tests with `npx vitest run <path>` from `cv-builder/`. Full suite: `npx vitest run`. Type check: `npx tsc --noEmit`. Production build gate at the end: `npm run build`.
- No new npm dependencies.
- Do not change the JSON Resume schema shape in `resume.zod.ts`.
- Do not weaken or remove the verbatim-quote-match guard in `ats-fix-pipeline.ts` (`item.original.trim() !== section.text.trim()` → skip) — it's the mechanism that prevents applying a fix to text that's since changed or was never real. The new generate-kind fix path is additive, not a replacement for this guard on edit-kind fixes.
- Do not weaken `detectHallucinations` — extend its usage (compare against a wider source text for generated content), don't loosen its matching.
- Commit after every task with a conventional-commit message ending in:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Whole-resume tailoring pass in `ats-fix-pipeline.ts`

**Why:** Today the pipeline caps at "Maximum 5 fixes," one edit per missing keyword, and completely skips summary tailoring when `data.basics.summary` is empty (`buildEditableSections` only adds a summary entry `if (data.basics?.summary?.trim())`). A tailoring *workspace* should cover meaningfully more of the resume per pass and should be able to draft a summary from scratch, not just patch an existing one.

**Files:**
- Modify: `lib/ai/ats-fix-pipeline.ts`
- Modify: `lib/ats/scorer.ts` (export the existing private `flattenAllText` helper — no behavior change, just visibility, so Task 1 can reuse it instead of duplicating flatten logic)
- Modify: `lib/ai/__tests__/ats-fix-pipeline.test.ts`

**Changes:**
1. In `scorer.ts`, change `function flattenAllText(data: ResumeData): string {` to `export function flattenAllText(data: ResumeData): string {`. No other change to that file in this task.
2. In `ats-fix-pipeline.ts`:
   - Add `kind?: 'edit' | 'generate'` to the `AtsFix` interface (optional — existing/edit fixes omit it or set `'edit'`; absence means `'edit'` everywhere it's read).
   - Raise the model's ceiling: change the prompt's `Maximum 5 fixes` to `Maximum 12 fixes`, and raise `max_tokens: 1500` to `max_tokens: 3000` to fit the larger response.
   - Reframe the prompt copy from "For each missing keyword, suggest ONE targeted edit" to something like "Propose up to 12 targeted edits across the sections below to naturally work in as many of the missing keywords as fit well — prioritize the summary and the two most recent roles, since those carry the most ATS weight. Not every keyword needs its own edit; a single strong edit may incorporate more than one keyword, and some low-value keywords may not fit anywhere naturally — skip those rather than forcing them in."
   - Add a conditional block to the prompt, included only when `!data.basics?.summary?.trim()`: instruct the model that section index `-1` is reserved for drafting a brand-new 2-3 sentence professional summary tailored to the job description, grounded only in facts already present in the resume sections listed (skills, work history, highlights) — explicitly: "Do not invent employers, job titles, dates, or metrics that are not already stated in the sections above." Only emit a `sectionIndex: -1` entry if a summary is actually being requested (i.e., never when a summary already exists — that case is already covered by treating the existing summary as an editable section like today).
   - In the parse loop: when `item.sectionIndex === -1` (and only when `!data.basics?.summary?.trim()`, mirroring the prompt's condition — guard against the model emitting `-1` when it shouldn't), build the fix as:
     ```ts
     const fullText = flattenAllText(data)
     fixes.push({
       id: 'fix-summary-new',
       section: 'summary',
       kind: 'generate',
       original: '',
       suggested: item.suggested,
       targetKeywords: item.targetKeywords,
       pendingApprovals: detectHallucinations(fullText, item.suggested),
     })
     ```
     Skip the existing verbatim-quote-match check for this branch only (there is no `original` to match against) — every other branch (`sectionIndex >= 0`, i.e. the existing edit-kind path) keeps the guard exactly as it is today, unchanged.
   - For all existing edit-kind fixes, set `kind: 'edit'` explicitly (don't leave it undefined) so downstream code can rely on the field being present once a fix has gone through this pipeline.

- [ ] **Step 1: Write failing tests.** Add to `ats-fix-pipeline.test.ts`: (a) a case with an empty summary and a mocked Anthropic response including `{ sectionIndex: -1, original: "", suggested: "...", targetKeywords: [...] }` — assert the resulting fix has `kind: 'generate'`, `original: ''`, `section: 'summary'`, and `id: 'fix-summary-new'`; (b) assert `detectHallucinations` is effectively checked against full resume text for this case (e.g. a number appearing in a work highlight but not literally in the generated summary's own "original" should NOT be flagged, proving the guard used the wider source — construct a case where the generated summary reuses a number from an existing highlight and assert `pendingApprovals` is empty); (c) a case with an *existing* summary confirms `sectionIndex: -1` is never honored (the model wouding a -1 entry when a summary exists should be dropped, since prompt-conditionality is a request, not a guarantee); (d) update the ceiling assertion if one exists to expect 12 instead of 5.
- [ ] **Step 2: Run tests, confirm they fail.**
- [ ] **Step 3: Apply the changes above.**
- [ ] **Step 4: Run tests, confirm they pass.** Run the full `lib/ai` and `lib/ats` test directories to confirm the `flattenAllText` export doesn't break anything in `scorer.test.ts`.
- [ ] **Step 5: Commit.**

---

### Task 2: Diff-review UI support for generated (no-original) fixes

**Why:** `AtsFixReviewPanel.tsx` currently always renders a red "Before" / green "After" pair. A `kind: 'generate'` fix has no "before" — showing an empty red strikethrough box would be confusing and undermine trust in the review UI, which is the app's best-built AI-safety feature.

**Files:**
- Modify: `components/ats/AtsFixReviewPanel.tsx`
- Modify: `components/ats/AtsFixReviewPanel.test.tsx`
- Modify: `components/ats/AtsScorePanel.tsx` (verify only — see below)

**Changes:**
- In `AtsFixReviewPanel.tsx`, inside the per-fix card, branch on `fix.kind === 'generate'`: instead of the "Before"/"After" red/green block pair, render a single card labeled "New professional summary" (or similar) containing `fix.suggested`, styled consistently with the existing "After" green card (reuse `bg-green-50 border-green-100` styling) but without a paired red block. The `targetKeywords` chips, the `pendingApprovals` amber warning block, and the Apply/Dismiss buttons stay exactly as they are for both kinds — only the before/after presentation differs.
- In `AtsScorePanel.tsx`: confirm (do not change unless a bug is found) that `applyFix`'s `section === 'summary'` branch — `setData({ basics: { ...data.basics, summary: fix.suggested } })` — works correctly for a `kind: 'generate'` fix with no prior `data.basics.summary`. It should, since it unconditionally sets `basics.summary` to `fix.suggested` regardless of what was there before. Write a test proving this rather than assuming it.

- [ ] **Step 1: Write failing tests.** In `AtsFixReviewPanel.test.tsx`: a `kind: 'generate'` fix renders a "New professional summary" label and the suggested text, and does NOT render a strikethrough "Before" element or the literal text "Before" label. Existing edit-kind tests must keep passing unchanged.
- [ ] **Step 2: Run tests, confirm the new one fails** (current component always renders Before/After).
- [ ] **Step 3: Implement the conditional rendering branch.**
- [ ] **Step 4: Run tests, confirm they pass.** Add the `AtsScorePanel` apply-from-empty-summary test described above and confirm it passes with the existing `applyFix` logic (if it doesn't, fix `applyFix` — that would be a real bug, not expected).
- [ ] **Step 5: Commit.**

---

### Task 3: Real structural analysis for the ATS Format Integrity vector

**Why:** `scoreFormat` currently awards 5 points each for five independent boolean presence checks (name, email, summary, any work, any highlights) — a resume with a one-word summary and a single job with zero dates scores the same as a fully complete one. CLAUDE.md specifies this vector should assess actual format/structure, not just field existence.

**Files:**
- Modify: `lib/ats/scorer.ts`
- Modify: `lib/ats/__tests__/scorer.test.ts`

**New `scoreFormat` design (still 0-25, still takes only `data: ResumeData`):** five checks, 5 points each, at least four of them proportional (not boolean) so partial/inconsistent data scores between 0 and 5 rather than snapping to one or the other:

1. **Core identity (5 pts, boolean):** `basics.name` AND `basics.email` both present. (Unchanged from today — this one stays boolean since "has a name and email" is inherently binary, not a completeness ratio.)
2. **Meaningful summary (5 pts, boolean):** `basics.summary` present AND its trimmed length is ≥ 40 characters (a real sentence or two, not a placeholder word). Presence-only no longer qualifies.
3. **Work entries structurally complete (5 pts, proportional):** if `work.length === 0`, score 0. Otherwise `5 * (entries with name AND position AND startDate all non-empty / total entries)`, rounded.
4. **Highlights are real bullets, not paragraph-dumps (5 pts, proportional):** gather all highlights across `work`, `volunteer`, and `projects`. If none exist, score 0. Otherwise `5 * (highlights with trimmed length between 10 and 400 characters inclusive / total highlights)`, rounded — this catches both empty/placeholder bullets and unformatted paragraph pastes, a real structural smell that field-presence checks miss entirely.
5. **Skills are structured, not bare labels (5 pts, proportional):** if `skills.length === 0`, score 0. Otherwise `5 * (skills with at least one non-empty keyword / total skills)`, rounded.

Sum, capped implicitly at 25 by construction (no explicit cap needed since each term maxes at 5).

- [ ] **Step 1: Update `scorer.test.ts` first (TDD on the test file itself, since this task is materially redefining behavior, not adding new behavior):**
  - Keep and verify these invariants still hold under the new logic (they must, or the redesign has a bug): `scoreResume({}, '')` → `total` is `0`; `scoreResume(fullData, jd)` → `breakdown.format` is `25` (verify by hand against the design above using the existing `fullData` fixture in the test file — it has name+email, a 99-char summary, one fully-dated/named/positioned work entry, three well-formed highlights, and one skill with keywords, so it should still score 25/25 under checks 1-5 above; if your hand-check disagrees, the design or the fixture needs adjusting — flag it rather than forcing a match).
  - Replace the two granular tests that hardcoded the old boolean-presence values (`'format score is 5 for name only'` and `'format score is 10 for name + email'`) — these tested a shape (name alone = 5, +email = 10) that no longer applies once check 2-5 are proportional-and-zero for missing data. Rewrite them to assert against the new design directly, e.g. `{ basics: { name: 'Alice' } }` (no email) should score `0` on check 1 (needs both name and email) and `0` on all others → `format` total `0`; `{ basics: { name: 'Alice', email: 'a@b.co' } }` should score `5` (check 1 only). Update the test descriptions to say what they now assert.
  - Add new tests for the proportional checks: a resume with 2 work entries where only 1 has a `startDate` scores `format` partial credit reflecting 1/2 on check 3; a resume where one highlight is a 600-character paragraph and two are normal-length bullets scores partial credit on check 4; a resume with 2 skills where only 1 has keywords scores partial credit on check 5.
- [ ] **Step 2: Run the updated test file, confirm the new/changed assertions fail** against the current implementation.
- [ ] **Step 3: Implement the new `scoreFormat`.**
- [ ] **Step 4: Run tests, confirm they pass.** Run the full `lib/ats` suite and the full project suite — `ats-fix-pipeline.ts`, `ats-score` route tests, and any ATS export-harness snapshot tests may reference `breakdown.format` values computed from fixture data; update any that now compute a different (but still correct-per-new-design) number.
- [ ] **Step 5: Commit.**

---

### Task 4: Wire-up and copy polish

**Files:**
- Modify: `components/ats/AtsScorePanel.tsx`
- Modify any test asserting the old button label.

**Changes:**
- Rename the button label `✨ Fix All with AI` to `✨ Tailor with AI` — the feature now does more than patch keywords into existing bullets (it can draft a summary from scratch and touches more of the resume per pass), and the copy should say what it does from the user's side of the screen.
- No functional change to `handleFixAll` — it's already generic (calls the ats-fix route with `missingKeywords` and displays whatever fixes come back).
- Double check the empty-fixes message ("No specific fixes found — try re-analyzing after updating your highlights.") still reads correctly given fixes can now include a from-scratch summary — no change needed unless a worker finds it reads oddly given the wider scope; use judgment, but don't invent new UI beyond this rename without checking in.

- [ ] **Step 1: Update the button label and any test/snapshot asserting the old text.**
- [ ] **Step 2: Run `components/ats` tests, confirm green.**
- [ ] **Step 3: Commit.**

---

### Task 5: Final verification gate

- [ ] Run `npx vitest run` from `cv-builder/` — full suite must be green, note before/after test counts (baseline going into this sprint: 65 files / 509 tests, per Sprint 2's final state plus the VolunteerForm fix).
- [ ] Run `npx tsc --noEmit` — must be clean.
- [ ] Run `npm run build` — must succeed.
- [ ] Write a task-by-task report: commit hashes, test counts before/after per task, any deviations (e.g. if the `fullData` fixture needed adjusting to hit 25/25 under the new format-vector design, or if the model's `-1` sentinel needed a different guard than specced), and open decisions for the human (e.g. whether "Tailor with AI" is the right label, whether 12 is the right fix ceiling given AI cost/latency).
- [ ] **No push, merge, or PR** — stop here and report, exactly as in Sprints 1 and 2.
