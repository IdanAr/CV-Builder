# Sprint 5a — Application Tracking, Resume Versioning & Cover Letter Generator

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The features half of the original Sprint 5 ("Trust & Reach") scope — the user explicitly deferred the UI/UX polish half (mobile-responsive editor, preview zoom, dark mode, punch list) to a later sprint. Three things, two of which share the same underlying data model extension:
1. **Application tracker lite** — a status (draft/applied/interviewing/offer/rejected) and target company/role on each resume.
2. **Per-application resume versioning** — duplicating a resume already exists (`duplicateResume`); this sprint adds a `parentResumeId` link so a duplicate is recognizably "a version of" its source, surfaced on the dashboard.
3. **Cover letter generator** — a new AI-drafted cover letter grounded in the resume's own facts, editable and autosaved like any other section.

**Architecture:** No new dependencies. Items 1–2 add new top-level fields to the `Resume` document (siblings of `title`, not nested in `data`/`meta`, since they're application/tracking metadata, not resume content or design). Item 3 adds one new optional field (`coverLetter`) to `ResumeDataSchema` — deliberately inside `data`, not top-level, so it flows through the *existing* `setData`/autosave/duplicate pipeline for free (a duplicated version automatically carries its cover letter over, ready to edit for the new application). The cover letter AI pipeline reuses `flattenAllText` (`lib/ats/scorer.ts`) and `detectHallucinations` (`lib/ai/hallucination-guard.ts`, extended in Sprint 4 to also catch invented skills) rather than building new grounding/verification logic.

**Tech Stack:** Next.js 14, TypeScript, Zod, Mongoose, Zustand, Anthropic SDK (Claude Haiku), Vitest.

## Global Constraints

- All work happens inside `cv-builder/`. All paths below are relative to `cv-builder/`.
- Work on branch `feat/sprint5a-application-tracking-cover-letter` (create from `main`, which now has Sprints 1–4 merged).
- Run tests with `npx vitest run <path>` from `cv-builder/`. Full suite: `npx vitest run`. Type check: `npx tsc --noEmit`. Production build gate at the end: `npm run build`.
- No new npm dependencies.
- `parentResumeId` is set only by server logic (`duplicateResume`), never accepted as user input through `CreateResumeSchema`/`PatchResumeSchema` — don't add it to either Zod schema; set it directly when calling `Resume.create()`.
- Do not add a new editor-level "save as version" action or PDF/DOCX export integration for the cover letter — both are explicitly out of scope for this "lite" sprint (noted as candidates for Sprint 5b). Keep versioning to: dashboard duplicate already exists, this sprint just tags the link and surfaces it.
- Commit after every task with a conventional-commit message ending in:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Schema and model changes

**Files:**
- Modify: `lib/schemas/resume.zod.ts`
- Modify: `lib/schemas/__tests__/resume.zod.test.ts`
- Modify: `models/Resume.ts`

**Changes:**
1. In `resume.zod.ts`, add near the top-level schemas:
   ```ts
   export const ApplicationStatusEnum = z.enum(['draft', 'applied', 'interviewing', 'offer', 'rejected'])
   export type ApplicationStatus = z.infer<typeof ApplicationStatusEnum>
   ```
2. Add `coverLetter: z.string().optional()` to `ResumeDataSchema`.
3. Add to `CreateResumeSchema`: `applicationStatus: ApplicationStatusEnum.optional().default('draft')`, `targetCompany: z.string().trim().max(200).optional()`, `targetRole: z.string().trim().max(200).optional()`. Do NOT add `parentResumeId` here.
4. Add the same three fields (all `.optional()`, no defaults) to `PatchResumeSchema` directly (top-level, alongside `title` — not inside `ResumeMetaPatchSchema`, since these aren't design metadata).
5. In `models/Resume.ts`: add to `IResume` interface: `applicationStatus: ApplicationStatus`, `targetCompany?: string`, `targetRole?: string`, `parentResumeId?: string`. Add to `ResumeSchema` (top-level, siblings of `title`):
   ```ts
   applicationStatus: { type: String, enum: ['draft', 'applied', 'interviewing', 'offer', 'rejected'], default: 'draft' },
   targetCompany: { type: String, maxlength: 200 },
   targetRole: { type: String, maxlength: 200 },
   parentResumeId: { type: String },
   ```

- [ ] **Step 1: Write failing tests.** In `resume.zod.test.ts`: `CreateResumeSchema` defaults `applicationStatus` to `'draft'` when omitted; `PatchResumeSchema` accepts a partial patch with just `applicationStatus`; `ResumeDataSchema` accepts and preserves a `coverLetter` string; `PatchResumeSchema` rejects an invalid `applicationStatus` value.
- [ ] **Step 2: Run tests, confirm they fail.**
- [ ] **Step 3: Apply the schema and model changes above.**
- [ ] **Step 4: Run tests, confirm they pass.** Run the full `lib/schemas` test directory to confirm no existing test broke.
- [ ] **Step 5: Commit.**

---

### Task 2: API layer — duplicate sets the version link, patch handles the new fields

**Files:**
- Modify: `lib/api/resumes.ts`
- Modify: `lib/api/__tests__/resumes.test.ts`
- Modify: `app/api/resumes/[id]/duplicate/route.ts`
- Modify: `app/api/resumes/[id]/duplicate/route.test.ts` (create if it doesn't exist — check first)

**Changes:**
1. `duplicateResume(userId: string, id: string, overrides?: { targetCompany?: string; targetRole?: string })`: after destructuring `_id` from the source, set on the new document: `parentResumeId: String(_id)`, `applicationStatus: 'draft'` (always reset — a new version starts fresh in the tracker regardless of the source's status), `targetCompany: overrides?.targetCompany ?? rest.targetCompany`, `targetRole: overrides?.targetRole ?? rest.targetRole`.
2. `patchResume`: add handling for the three new top-level fields exactly like `title` is handled today: `if (patch.applicationStatus !== undefined) setPayload.applicationStatus = patch.applicationStatus` (and same for `targetCompany`/`targetRole`).
3. `listResumes`: build a `Map<string, string>` of `_id → title` from the same fetched result set (no extra query), and add `parentResumeTitle: r.parentResumeId ? titleById.get(String(r.parentResumeId)) : undefined` to each mapped resume — this resolves the "version of X" display without an N+1 query, and correctly resolves to `undefined` if the parent was since deleted (don't throw or error in that case).
4. `app/api/resumes/[id]/duplicate/route.ts`: read an optional JSON body (`{ targetCompany?, targetRole? }`, sanitize to strings, cap length), pass through to `duplicateResume`.

- [ ] **Step 1: Write failing tests.** In `resumes.test.ts`: `duplicateResume` sets `parentResumeId` to the source's id and resets `applicationStatus` to `'draft'` even if the source had a different status; `duplicateResume` applies `overrides.targetCompany`/`targetRole` when provided, falling back to the source's own values when not; `patchResume` sets `applicationStatus`/`targetCompany`/`targetRole` via `$set` the same way it does `title`; `listResumes` attaches `parentResumeTitle` for a resume whose `parentResumeId` matches another resume in the same result set, and attaches `undefined` when the parent isn't found (deleted). For the duplicate route: body with `targetCompany`/`targetRole` gets passed through to `duplicateResume`.
- [ ] **Step 2: Run tests, confirm they fail.**
- [ ] **Step 3: Apply the changes above.**
- [ ] **Step 4: Run tests, confirm they pass.** Run the full `lib/api` test directory.
- [ ] **Step 5: Commit.**

---

### Task 3: Dashboard UI — status, company/role, and version tag

**Files:**
- Modify: `components/ResumeCard.tsx`
- Modify: `components/ResumeCard.test.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Changes:**
1. Extend `ResumeCardProps.resume` type with `applicationStatus: ApplicationStatus`, `targetCompany?: string`, `targetRole?: string`, `parentResumeTitle?: string`. Pass these through from `dashboard/page.tsx`'s mapped resume object (they come straight from `listResumes`, per Task 2).
2. Add a status control to each card: a small `<select>` styled as a color-coded badge (draft=gray, applied=blue, interviewing=amber, offer=green, rejected=red — reuse the existing chip color conventions from `AtsScorePanel.tsx`/`AtsFixReviewPanel.tsx` rather than inventing new colors). On change, `PATCH /api/resumes/{id}` with `{ applicationStatus: value }`, then `router.refresh()`; on failure, `toast.error(...)` (matching this file's existing error-handling convention for duplicate/delete/download) and revert the select to its previous value.
3. Below the existing metadata row, if `targetCompany` or `targetRole` is set, show them (e.g. `"Acme Corp · Senior Engineer"`); if neither is set, no extra row (don't show an empty placeholder).
4. If `parentResumeTitle` is present, show a small tag/badge (e.g. `↳ Version of "{parentResumeTitle}"`) near the title.
5. This task does NOT add a company/role input UI for *setting* those fields on first duplicate — per the Global Constraints, keep duplicate a one-click action (as it is today); the user sets company/role/status afterward on the resulting card. Do not add a modal or prompt to the duplicate button.

- [ ] **Step 1: Write failing tests.** In `ResumeCard.test.tsx`: renders the status select with the correct current value and color class per status; changing the select fires a PATCH request with the new status and calls `router.refresh()`; renders company/role text when present, omits it when absent; renders the "Version of" tag when `parentResumeTitle` is present, omits it when absent.
- [ ] **Step 2: Run tests, confirm they fail.**
- [ ] **Step 3: Implement the UI changes above**, reusing this file's existing button/toast/error-handling patterns (see `handleDuplicate`/`handleDownload` for the fetch-then-toast-on-failure shape to mirror for the status-change handler).
- [ ] **Step 4: Run tests, confirm they pass.**
- [ ] **Step 5: Commit.**

---

### Task 4: Cover letter AI pipeline and API route

**Files:**
- Create: `lib/ai/cover-letter-pipeline.ts`
- Create: `lib/ai/__tests__/cover-letter-pipeline.test.ts`
- Create: `app/api/resumes/[id]/cover-letter/route.ts`
- Create: `app/api/resumes/[id]/cover-letter/route.test.ts` (follow the pattern in `app/api/resumes/[id]/ats-fix/route.test.ts` if it exists, otherwise `ai-suggest/route.test.ts`)

**Design** (mirror `lib/ai/ats-fix-pipeline.ts`'s shape — a single Claude Haiku call, verbatim-grounded, hallucination-checked):
```ts
// lib/ai/cover-letter-pipeline.ts
import { getAnthropic } from './models'
import { detectHallucinations } from './hallucination-guard'
import { flattenAllText } from '@/lib/ats/scorer'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export interface CoverLetterResult {
  content: string
  pendingApprovals: string[]
}

export async function generateCoverLetter(
  data: ResumeData,
  jobDescription: string,
  opts?: { companyName?: string; roleName?: string }
): Promise<CoverLetterResult> {
  const facts = flattenAllText(data)
  const name = data.basics?.name ?? ''
  const contextLine = [opts?.roleName && `Role: ${opts.roleName}`, opts?.companyName && `Company: ${opts.companyName}`]
    .filter(Boolean).join('. ')

  const prompt = `You are a professional cover letter writer. Candidate name: "${name}". Candidate's resume facts (use ONLY these — do not invent employers, titles, dates, metrics, or skills not listed here): "${facts}". ${contextLine ? contextLine + '.' : ''}

Job description: "${jobDescription}"

Write a 3-paragraph professional cover letter: (1) a greeting and opening line stating interest in the role, (2) one paragraph connecting 2-3 of the candidate's actual achievements above to what the job description asks for, (3) a closing paragraph with a call to action. Do not use em dashes (—); use a regular hyphen or rephrase. Return ONLY the letter text, no subject line, no explanation.`

  const anthropic = getAnthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = msg.content[0]
  const content = block?.type === 'text' ? block.text.trim() : ''
  const pendingApprovals = detectHallucinations(facts, content)
  return { content, pendingApprovals }
}
```
The API route follows the exact auth/rate-limit/error shape of `app/api/resumes/[id]/ats-fix/route.ts`: authenticate, check `AI_RATE_LIMIT` via `checkRateLimit`, load the resume via `getResume`, read `{ jobDescription, companyName?, roleName? }` from the body (validate/sanitize: `jobDescription` required non-empty string, cap length e.g. 10,000 chars; `companyName`/`roleName` optional strings capped at 200 chars), call `generateCoverLetter(resume.data, jobDescription, { companyName, roleName })`, return the result as JSON.

- [ ] **Step 1: Write failing tests.**
  - `cover-letter-pipeline.test.ts` (mock `getAnthropic` the same way `lib/ai/__tests__/pipeline.test.ts` and `ats-fix-pipeline.test.ts` do): generates a letter using resume facts; `pendingApprovals` is empty when the letter only restates resume facts; `pendingApprovals` flags a metric or skill in the letter that isn't in the resume data (reuses the Sprint 4 hallucination-guard extension — this is a real integration test proving the reuse works, not just a mock assertion); includes company/role context in the prompt when provided (assert on the mocked call's message content, matching the pattern in `pipeline.test.ts`'s "passes jobTitle and company in the generation prompt" test).
  - `route.test.ts`: unauthenticated request returns 401; missing `jobDescription` returns 400; resume not found (or not owned by the user) returns 404; rate-limited request returns 429; a valid request returns the pipeline's `{ content, pendingApprovals }`.
- [ ] **Step 2: Run tests, confirm they fail.**
- [ ] **Step 3: Implement the pipeline and route above.**
- [ ] **Step 4: Run tests, confirm they pass.**
- [ ] **Step 5: Commit.**

---

### Task 5: Cover Letter editor tab

**Files:**
- Create: `components/coverletter/CoverLetterPanel.tsx`
- Create: `components/coverletter/CoverLetterPanel.test.tsx`
- Modify: `components/editor/EditorShell.tsx`

**Design:** A new tab, `'coverLetter'`, added to `EditorShell.tsx`'s `Tab` union and `TAB_LABELS` (label: `"Cover Letter"`), rendered in the same conditional-`block`/`hidden` pattern as the other three tabs (see lines ~190, ~219, ~257-265 of `EditorShell.tsx` — three places reference the tab list, all three need the new value added).

`CoverLetterPanel.tsx` mirrors `AtsScorePanel.tsx`'s structure and visual language:
- Reads `resumeId` and `data.coverLetter` from `useResumeEditorStore`, plus `setData`.
- A JD paste `<textarea>` (same styling as `AtsScorePanel`'s), plus two small optional text inputs for company name and role name.
- A "Generate" button that POSTs `{ jobDescription, companyName, roleName }` to `/api/resumes/{resumeId}/cover-letter`, shows a loading state, and on success calls `setData({ coverLetter: result.content })` (this alone persists it — autosave picks it up exactly like any other section) and stores `pendingApprovals` in local state.
- If `pendingApprovals.length > 0`, show the same amber warning-chip treatment used in `AtsFixReviewPanel.tsx` ("Contains figures not in your original text — verify before applying") — but since there's no separate "apply" step here (the letter is already in the editable textarea), phrase it as a review prompt: something like "Double-check these before using this letter:" with the flagged terms as chips.
- The generated (or previously-saved) letter renders in an editable `<textarea>` bound directly to `data.coverLetter`, with `onChange` calling `setData({ coverLetter: e.target.value })` — so the user can freely hand-edit the AI draft, and edits autosave the same as any other field.
- Handle the empty state (no `jobDescription` yet, or no letter generated yet) and the error state (fetch failure) with the same toast/inline-error conventions used elsewhere in this codebase (e.g. `AtsScorePanel.tsx`'s `error` state and `<p className="text-sm text-red-500">`).

- [ ] **Step 1: Write failing tests.** In `CoverLetterPanel.test.tsx` (mirror `AtsScorePanel.test.tsx`'s mocking approach — `vi.stubGlobal('fetch', ...)`): renders the JD textarea and Generate button; clicking Generate with no JD text does nothing (button disabled, matching `AtsScorePanel`'s `disabled={loading || !jobDescription.trim()}` pattern); a successful generate call updates the store's `data.coverLetter` and renders it in the editable textarea; a response with `pendingApprovals` renders the warning chips; editing the textarea directly updates `data.coverLetter` in the store; a failed fetch shows an inline error message.
- [ ] **Step 2: Run tests, confirm they fail.**
- [ ] **Step 3: Implement `CoverLetterPanel.tsx` and wire the new tab into `EditorShell.tsx`.**
- [ ] **Step 4: Run tests, confirm they pass.** Run the full `components/editor` and `components/coverletter` test directories.
- [ ] **Step 5: Commit.**

---

### Task 6: Final verification gate

- [ ] Run `npx vitest run` from `cv-builder/` — full suite must be green. Report the actual starting test count for this branch (it's off current `main`, which has all of Sprints 1–4 merged — report the real number, don't assume).
- [ ] Run `npx tsc --noEmit` — must be clean.
- [ ] Run `npm run build` — must succeed.
- [ ] Write a task-by-task report: commit hashes, test counts before/after per task, any deviations from this plan, and open decisions for the human (e.g. whether the status color mapping reads clearly, whether the cover letter prompt's tone matches expectations, whether a company/role prompt on first duplicate would be worth adding after all).
- [ ] **No push, merge, or PR** — stop here and report, exactly as in Sprints 1–4.
