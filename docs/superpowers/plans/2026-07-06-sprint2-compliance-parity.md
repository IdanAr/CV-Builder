# Sprint 2 — Compliance Hardening & Section Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two categories of gap identified in the 2026-07-06 PM/engineering audit: (1) shipped output that silently violates CLAUDE.md's hard ATS-typography constraints (margin floor, font-size bands) in the Sidebar and Executive templates, and a schema-validation bypass on AI-extracted resumes; (2) five JSON Resume sections — certificates, awards, publications, interests, projects — that are fully modeled in the schema, database, all 6 PDF templates, and DOCX export, but have no editor form and don't render in any of the 5 web preview templates.

**Architecture:** No new dependencies, no schema shape changes to `ResumeDataSchema` (the five section schemas already exist and are correct). Work is: (a) numeric fixes to existing StyleSheet/inline-style objects in the Sidebar/Executive template files across PDF, web-preview, and DOCX; (b) a validation-rejection change in `lib/upload/extract-resume.ts`; (c) five new editor form components following the existing `ListFieldManager` + `useResumeEditorStore.setSectionData` pattern already used by `VolunteerForm.tsx`/`SkillsForm.tsx`; (d) new `case` branches in the 5 web template `render*Section` switch statements, ported directly from the equivalent (already-correct) PDF template switch statements; (e) wiring the new sections into `EditTab.tsx`'s `SECTION_LABELS`/`SECTION_FORMS` maps and unifying the `sectionOrder` default across `resume.zod.ts`, `models/Resume.ts`, and `resume-editor.store.ts` (currently inconsistent: Zod/store default to 5 sections, Mongoose schema-level default already lists all 10).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, Zustand, `@react-pdf/renderer`, `docx`, Vitest + Testing Library.

## Global Constraints

- All work happens inside `cv-builder/` (the Next.js app root). All paths below are relative to `cv-builder/`.
- Work on branch `feat/sprint2-compliance-parity` (create from `main` before Task 1).
- Run tests with `npx vitest run <path>` from `cv-builder/`. Full suite: `npx vitest run`. Type check: `npx tsc --noEmit`. Production build gate at the end: `npm run build`.
- Match the existing visual language: indigo palette, `rounded-lg`/`rounded-xl`, `border-indigo-100/200`, `bg-white/60-70 backdrop-blur` glassmorphism, exactly as in `VolunteerForm.tsx` and `SkillsForm.tsx`.
- No new dependencies.
- Do not change the shape of any Zod schema in `resume.zod.ts` — `CertificateSchema`, `AwardSchema`, `PublicationSchema`, `InterestSchema`, and `ProjectSchema` already exist and are correct as-is.
- Do not touch `customSections` / `CustomSectionForm.tsx` — the custom-section escape hatch stays as-is for users who already used it; this sprint adds native support alongside it, it does not replace it.
- Commit after every task with a conventional-commit message ending in:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: ATS-typography compliance fixes (margin floor + font-size bands)

**Why:** CLAUDE.md states page margins have a "minimum... 0.5 inches (hard constraint — never allow lower)" and typography bands of name 18–22pt / section headers 12–14pt / body 10–12pt "enforced in UI, not just recommended." The Sidebar template currently scales margins below the floor in both PDF and web output, and the Executive template's name and the Sidebar's rail text sit outside their bands on all three export surfaces.

**Files:**
- Modify: `lib/pdf/templates/SidebarPdfTemplate.tsx`
- Modify: `components/templates/SidebarTemplate.tsx`
- Modify: `lib/pdf/templates/ExecutivePdfTemplate.tsx`
- Modify: `components/templates/ExecutiveTemplate.tsx`
- Modify: `lib/docx/resume-docx.ts`
- Create/modify tests: `lib/pdf/__tests__/sidebar-pdf-template.test.tsx` (or nearest existing test file for this template), `components/templates/ExecutiveTemplate.test.tsx`, `lib/docx/__tests__/resume-docx.test.ts`

**Exact fixes:**

1. `lib/pdf/templates/SidebarPdfTemplate.tsx:16` — margin floor violation:
   ```ts
   // before: const margin = inToPt(Math.max(meta.pageMargins * 0.7, 0.35))
   const margin = inToPt(Math.max(meta.pageMargins * 0.7, 0.5))
   ```
2. `components/templates/SidebarTemplate.tsx:19` — same violation, web units (96 dpi, 0.5in = 48px):
   ```ts
   // before: const pad = Math.max(meta.pageMargins * 96 * 0.7, 34)
   const pad = Math.max(meta.pageMargins * 96 * 0.7, 48)
   ```
3. Sidebar rail text is below the 12–14pt (headers) / 10–12pt (body) bands in all three surfaces. Apply these exact size bumps:
   - `SidebarPdfTemplate.tsx` StyleSheet: `railSectionTitle.fontSize` 10 → 12; `railBody.fontSize`, `railLang.fontSize`, `railBold.fontSize`, `railMuted.fontSize`, `railKeywords.fontSize` — all currently 9.5 → 10.
   - `SidebarTemplate.tsx` inline styles: `railTitleStyle.fontSize` `'10pt'` → `'12pt'`; the contact block font size `'9pt'` (line ~172) → `'10pt'`; the skills/languages rail block font sizes `'9.5pt'` (lines ~185, 205) → `'10pt'`.
   - `lib/docx/resume-docx.ts`, inside `buildRailParas` (~lines 220–400): the `railHeading` helper uses `size: 20` (10pt) for rail section headings — bump to `size: 24` (12pt). All rail body/contact `TextRun`s using `size: 18` (9pt) or `size: 19` (9.5pt) — bump to `size: 20` (10pt). Do **not** change `nameSize`/`labelSize` parameters passed into the function — those are already in-band (18pt name, 10.5pt label).
4. Executive name is 26pt, above the 18–22pt band. Clamp to 22pt (top of band) in all three surfaces:
   - `lib/pdf/templates/ExecutivePdfTemplate.tsx:21` — `name.fontSize`: 26 → 22.
   - `components/templates/ExecutiveTemplate.tsx:178` — `fontSize: '26pt'` → `fontSize: '22pt'`.
   - `lib/docx/resume-docx.ts:108` — `buildDocxTheme`'s `'executive'` case: `nameSize: 52` → `nameSize: 44` (half-points; 44 = 22pt, matching `modern`/`minimal`'s existing value).

- [ ] **Step 1: Write failing tests** asserting: (a) Sidebar PDF/web computed margin/padding never drops below 0.5in/48px for any `pageMargins` in `[0.5, 1.5]`; (b) Sidebar rail section-title and body font sizes are ≥12 and ≥10 respectively (PDF pt values and web `pt` strings); (c) Executive name font size is 22 (not 26) in PDF, web (`'22pt'`), and DOCX (`nameSize: 44`).
- [ ] **Step 2: Run tests, confirm they fail** against current values (0.35/34/9.5/10/26/52 etc).
- [ ] **Step 3: Apply the exact fixes listed above.**
- [ ] **Step 4: Run tests, confirm they pass.** Also visually sanity-check: run `npx vitest run` full suite to confirm no snapshot/pixel-adjacent test elsewhere hardcodes the old values.
- [ ] **Step 5: Commit.**

---

### Task 2: Reject invalid AI-extracted resumes instead of silently persisting them

**Why:** `lib/upload/extract-resume.ts:71` currently does `return result.success ? result.data : (normalized as ResumeData)` — if the AI's JSON output fails `ResumeDataSchema` validation, the unvalidated data is cast and returned anyway, letting malformed data reach persistence.

**Files:**
- Modify: `lib/upload/extract-resume.ts`
- Modify: `lib/upload/extract-resume.test.ts` (or nearest existing test file)

**Fix:**
```ts
// before:
const result = ResumeDataSchema.safeParse(normalized)
return result.success ? result.data : (normalized as ResumeData)

// after:
const result = ResumeDataSchema.safeParse(normalized)
if (!result.success) {
  throw new ExtractionError('AI returned data that did not match the expected resume format. Please try again.')
}
return result.data
```
Check the call site (`app/api/resumes/upload/extract/route.ts`) already catches `ExtractionError` and surfaces it as a user-facing error (it should, since malformed-JSON already throws the same error type at line 66) — if it doesn't, add a catch branch there too.

- [ ] **Step 1: Write a failing test** that feeds `extractResume` a mocked Anthropic response whose JSON parses but fails schema validation (e.g. a field with the wrong type), asserting it throws `ExtractionError` rather than returning data.
- [ ] **Step 2: Run test, confirm it fails** (current code returns the bad data instead of throwing).
- [ ] **Step 3: Apply the fix.**
- [ ] **Step 4: Run test, confirm it passes.** Run the full `lib/upload` test directory to confirm no existing test relied on the old cast-through behavior.
- [ ] **Step 5: Commit.**

---

### Task 3: Editor forms — Certificates, Awards, Publications

**Why:** These three sections share a near-identical shape (name/title, issuer/awarder/publisher, date, optional summary) and are fully rendered in every PDF template already — only the editor form is missing.

**Files:**
- Create: `components/editor/forms/CertificatesForm.tsx`, `components/editor/forms/CertificatesForm.test.tsx`
- Create: `components/editor/forms/AwardsForm.tsx`, `components/editor/forms/AwardsForm.test.tsx`
- Create: `components/editor/forms/PublicationsForm.tsx`, `components/editor/forms/PublicationsForm.test.tsx`

**Pattern to follow exactly:** `components/editor/forms/VolunteerForm.tsx` (uses `ListFieldManager<Item>` + `useResumeEditorStore((s) => s.setSectionData)`). Schema shapes (from `lib/schemas/resume.zod.ts`):
- `CertificateSchema`: `{ name?, date?, issuer?, url? }` — fields: text input for Name, text input for Issuer, `MonthYearPicker` for Date, text input for URL.
- `AwardSchema`: `{ title?, date?, awarder?, summary? }` — fields: text input for Title, text input for Awarder, `MonthYearPicker` for Date, `RichTextField` (rows=2) for Summary.
- `PublicationSchema`: `{ name?, publisher?, releaseDate?, url?, summary? }` — fields: text input for Name, text input for Publisher, `MonthYearPicker` for Release Date (map to `releaseDate`, no end date), text input for URL, `RichTextField` (rows=2) for Summary.

Each form: `createEmpty()` returning an all-empty item; `setSectionData('certificates' | 'awards' | 'publications', items)`; a per-item remove button with `aria-label="Remove {section} entry"` matching `VolunteerForm.tsx`'s convention; `addLabel` of `"Add certificate"` / `"Add award"` / `"Add publication"` respectively.

- [ ] **Step 1: Write failing tests** for each form (mirror `WorkForm.test.tsx`/`BasicsForm.test.tsx` structure): renders empty state with an "Add X" button; clicking it adds one item and renders its inputs; typing into an input updates the store via `setSectionData`; remove button removes the item.
- [ ] **Step 2: Run tests, confirm they fail** (components don't exist yet).
- [ ] **Step 3: Implement all three forms**, following `VolunteerForm.tsx` structure and the field lists above.
- [ ] **Step 4: Run tests, confirm they pass.**
- [ ] **Step 5: Commit** (all three forms in one commit — they're one cohesive unit of work).

---

### Task 4: Editor forms — Interests, Projects

**Files:**
- Create: `components/editor/forms/InterestsForm.tsx`, `components/editor/forms/InterestsForm.test.tsx`
- Create: `components/editor/forms/ProjectsForm.tsx`, `components/editor/forms/ProjectsForm.test.tsx`

**Pattern to follow:**
- `InterestsForm.tsx`: schema `InterestSchema = { name?, keywords? }` — closest existing pattern is the keywords-list portion of `SkillsForm.tsx` (name input + add/remove keyword chips), minus the `level` select. `addLabel="Add interest"`.
- `ProjectsForm.tsx`: schema `ProjectSchema = { name?, description?, highlights?, keywords?, startDate?, endDate?, url?, roles?, entity?, type? }` — closest existing pattern is `VolunteerForm.tsx` (name/org + date range + `RichTextField` summary + highlights list) combined with the keywords-chip pattern from `SkillsForm.tsx`. Map: Name → `name`, Description → `description` (`RichTextField`, rows=2), Start/End → `MonthYearPicker` pair on `startDate`/`endDate`, Highlights → same add/remove pattern as `VolunteerForm.tsx`'s highlights, Keywords → same add/remove chip pattern as `SkillsForm.tsx`, URL → text input. `roles`, `entity`, `type` are optional JSON Resume fields with low practical usage — skip them in the form UI (they remain in the schema and are preserved on read/write, just not editable in this form); note this explicitly in the task report as a deliberate scope cut, not an oversight. `addLabel="Add project"`.

- [ ] **Step 1: Write failing tests** for both forms, same assertions style as Task 3.
- [ ] **Step 2: Run tests, confirm they fail.**
- [ ] **Step 3: Implement both forms.**
- [ ] **Step 4: Run tests, confirm they pass.**
- [ ] **Step 5: Commit.**

---

### Task 5: Web template rendering for the 5 new sections (all 5 templates)

**Why:** The PDF templates (`ExecutivePdfTemplate.tsx`, `SidebarPdfTemplate.tsx`, and by extension `ClassicPdfTemplate.tsx`/`ModernPdfTemplate.tsx`/`MinimalPdfTemplate.tsx`) already have complete, correct `case` branches for `certificates`, `awards`, `publications`, `interests`, `projects`. The 5 web templates (`ClassicTemplate.tsx`, `ModernTemplate.tsx`, `MinimalTemplate.tsx`, `ExecutiveTemplate.tsx`, `SidebarTemplate.tsx`) have none — their `renderSection`/`renderMainSection` switch statements only handle `work`/`education`/`skills`/`volunteer`/`languages`, and `SidebarTemplate.tsx`/`ExecutivePdfTemplate.tsx`'s equivalents for rail-eligible sections (`certificates`, `awards`, `publications`, `interests`, `projects`, per `SidebarPdfTemplate.tsx`'s `renderRailSection`) are also missing from `SidebarTemplate.tsx`'s rail rendering.

**Files:**
- Modify: `components/templates/ClassicTemplate.tsx`
- Modify: `components/templates/ModernTemplate.tsx`
- Modify: `components/templates/MinimalTemplate.tsx`
- Modify: `components/templates/ExecutiveTemplate.tsx`
- Modify: `components/templates/SidebarTemplate.tsx`
- Modify tests: `components/templates/ExecutiveTemplate.test.tsx` and any other existing template test files — add assertions per template.

**Approach:** For each of the 5 files:
1. Update the `ALL_SECTIONS` constant from `['work', 'education', 'skills', 'volunteer', 'languages']` to `['work', 'education', 'skills', 'certificates', 'awards', 'publications', 'volunteer', 'languages', 'interests', 'projects']`.
2. Add five new `case` branches to the template's section-rendering switch (`renderSection` in Classic/Minimal/Modern, `renderMainSection` in Executive/Sidebar), one per new section. **Content and field usage must exactly mirror the equivalent PDF template's `case` branch** — read `ExecutivePdfTemplate.tsx`'s `renderPdfSection` (lines 135–255 in that file, covering exactly these 5 cases) as the field-by-field reference for what to show and in what order (e.g. `certificates`: name, issuer, date; `awards`: title, date, awarder, summary; `publications`: name, releaseDate, publisher, summary; `interests`: name + keywords joined with commas, entries separated by " | "; `projects`: name, dates, description, highlights list, keywords line). Translate each PDF `<Text style={styles.X}>` block into the equivalent web `<div style={...}>` using that template's own existing inline-style conventions (e.g. in `ClassicTemplate.tsx`, follow how the existing `volunteer` case builds its `<div>` structure and reuses `sectionTitle`/inline font-size/color patterns — do the same for the 5 new cases rather than inventing a new visual style).
3. `SidebarTemplate.tsx` additionally needs rail-side rendering for `certificates`, `awards`, `publications`, `interests`, `projects` when `getColumnSide` assigns them to `'left'` — mirror `SidebarPdfTemplate.tsx`'s `renderRailSection` cases for these 5 (lines 161–267 in that file) using `railTitleStyle` and matching inline rail styles (10pt body, 12pt heading, per Task 1's fixed values) instead of the PDF `StyleSheet` objects.

- [ ] **Step 1: Write failing tests.** For at least `ExecutiveTemplate.test.tsx` (already exists) and one new/updated test file per remaining template, assert that a resume with data in all 5 new sections renders each section's key text (e.g. certificate name, award title, publication name, interest name, project name) somewhere in the rendered output when `sectionOrder` includes them.
- [ ] **Step 2: Run tests, confirm they fail** (sections currently render nothing).
- [ ] **Step 3: Implement the 5 new cases + `ALL_SECTIONS` update in all 5 files**, per the mirroring approach above.
- [ ] **Step 4: Run tests, confirm they pass.** Run the full suite — some existing tests may assert exact `ALL_SECTIONS` contents or exact rendered section counts and will need their expectations updated to include the 5 new entries; update those assertions to match the new intentional behavior (do not weaken them otherwise).
- [ ] **Step 5: Commit** (all 5 template files in one commit — it's one cohesive change ported from one reference).

---

### Task 6: Wire new forms into the editor + unify `sectionOrder` defaults

**Why:** Forms and rendering exist after Tasks 3–5, but nothing surfaces them in the Edit tab, and the three places that define a default `sectionOrder` disagree (`resume.zod.ts` and `resume-editor.store.ts` default to the 5 old sections; `models/Resume.ts`'s Mongoose schema-level default already lists all 10 — this task makes all three consistent).

**Files:**
- Modify: `components/editor/EditTab.tsx`
- Modify: `lib/schemas/resume.zod.ts`
- Modify: `lib/schemas/__tests__/resume.zod.test.ts` (has an existing test asserting the 5 sections are *excluded* from the default — this test's premise changes; update it to assert the new full-10 default, per this sprint's intent to make them first-class)
- Modify: `lib/stores/resume-editor.store.ts`
- Modify: `lib/stores/resume-editor.store.test.ts` / `__tests__/resume-editor.store.test.ts` (same reasoning)

**Exact changes:**
1. `EditTab.tsx`: import the 5 new form components; add to `SECTION_LABELS` — `certificates: 'Certificates'`, `awards: 'Awards'`, `publications: 'Publications'`, `interests: 'Interests'`, `projects: 'Projects'`; add matching entries to `SECTION_FORMS`; update the fallback array at line 87 from `['work', 'education', 'skills', 'volunteer', 'languages']` to the full 10-section order matching the new Zod default (see below).
2. `resume.zod.ts:169` — `ResumeMetaSchema.sectionOrder` default: change from `['work', 'education', 'skills', 'volunteer', 'languages']` to `['work', 'education', 'skills', 'certificates', 'awards', 'publications', 'volunteer', 'languages', 'interests', 'projects']` (matches `models/Resume.ts`'s existing order exactly).
3. `resume-editor.store.ts:68` — same array update, same new order.
4. Leave `models/Resume.ts` untouched — it's already correct and is the reference order the other two now match.

- [ ] **Step 1: Update the two existing tests** (`resume.zod.test.ts` lines ~172-179, and the equivalent in the store test) that currently assert the 5 sections are excluded — change them to assert the new 10-section default, documenting in the test description that this reflects Sprint 2's native-section-support decision.
- [ ] **Step 2: Run those tests, confirm they fail** against current (old) defaults.
- [ ] **Step 3: Apply the default-array changes** in `resume.zod.ts` and `resume-editor.store.ts`, and the `EditTab.tsx` wiring.
- [ ] **Step 4: Write/update an `EditTab` test** asserting all 5 new sections appear as accordion items with working forms when present in `sectionOrder`.
- [ ] **Step 5: Run full suite, confirm all green.** Existing tests that hardcode the old 5-item default array anywhere (grep `sectionOrder.*work.*education.*skills.*volunteer.*languages` across test files) will need their fixture data updated to the new order — update fixtures, not the assertions under test, unless the assertion's premise was specifically "only these 5 exist."
- [ ] **Step 6: Commit.**

---

### Task 7: Final verification gate

- [ ] Run `npx vitest run` from `cv-builder/` — full suite must be green, note before/after test counts.
- [ ] Run `npx tsc --noEmit` — must be clean.
- [ ] Run `npm run build` — must succeed (this is the gate that caught the pre-existing lint errors in Sprint 1; re-verify no new lint errors from the 5 new form components or template edits).
- [ ] Write a task-by-task report: commit hashes, test counts before/after, any deviations from this plan (e.g. the `roles`/`entity`/`type` scope-cut in Projects, or any template-specific visual adaptation that didn't map 1:1 from the PDF reference), and open decisions for the human.
- [ ] **No push, merge, or PR** — stop here and report. The human decides integration, exactly as in Sprint 1.
