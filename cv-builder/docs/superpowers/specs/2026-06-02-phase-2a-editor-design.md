# Phase 2a — Editor + State + Live Preview + Design Controls

## Goal

Build the resume editor at `/dashboard/resumes/[id]`: a tabbed UI with an accordion form editor, debounced auto-save, a live HTML/CSS preview, design controls, and PDF/DOCX/JSON export triggers.

## Architecture

Approach: Zustand store as single client-side source of truth, separate HTML/CSS preview components (not `@react-pdf/renderer`), and on-demand PDF/DOCX export via server routes. The store shape mirrors the DB document and auto-saves via debounced PATCH to the existing `/api/resumes/[id]` endpoint.

Tech stack additions: `zustand`, `@react-pdf/renderer`, `docx`.

---

## Section 1: State Management

**Store location:** `lib/stores/resume-editor.store.ts`

**Shape:**
```ts
interface ResumeEditorStore {
  resumeId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
  isDirty: boolean
  isSaving: boolean
  setTitle: (title: string) => void
  setData: (patch: Partial<ResumeData>) => void
  setMeta: (patch: Partial<ResumeMeta>) => void
  setSectionData: <K extends keyof ResumeData>(section: K, value: ResumeData[K]) => void
}
```

**Auto-save:** A single store subscriber watches `data`, `meta`, and `title`. Any change sets `isDirty: true` and schedules a debounced PATCH (1 000 ms delay). On success, `isDirty` resets to `false`. On failure, the store retries once after 3 seconds; if it fails again, a toast surfaces "Changes couldn't be saved — retrying…" and `isDirty` stays `true`.

No context providers — the store is module-scoped and imported directly.

---

## Section 2: Editor UI

**Page:** `app/(dashboard)/dashboard/resumes/[id]/page.tsx` — remains a Server Component. Calls `getResume(userId, id)` directly (no HTTP round-trip), then passes the result to `<EditorShell resume={resume} />`. On null return, calls `notFound()`. The `EditorShell` Client Component hydrates the Zustand store with the server-fetched initial data on mount.

**Shell layout:**
- Header bar: inline-editable resume title, save-status indicator ("Saving…" / "Saved" / unsaved dot), export buttons (PDF, DOCX, JSON).
- Three tabs below the header: **Edit**, **Preview**, **Design**.

**Edit tab — Accordion:**

Items ordered by `meta.sectionOrder`. One item expands at a time. Each item header shows the section name and a filled/empty badge.

Section form components (in `components/editor/forms/`):

| Component | Fields |
|---|---|
| `BasicsForm` | name, label, email, phone, url, summary, location (city, region, countryCode), profiles (network, url, username) |
| `WorkForm` | list: name, position, url, startDate, endDate, summary, highlights[] |
| `EducationForm` | list: institution, url, area, studyType, startDate, endDate, score, courses[] |
| `SkillsForm` | list: name, level, keywords[] |
| `CertificatesForm` | list: name, date, issuer, url |
| `ProjectsForm` | list: name, description, highlights[], keywords[], startDate, endDate, url, roles[], entity, type |
| `LanguagesForm` | list: language, fluency |
| `VolunteerForm` | list: organization, position, url, startDate, endDate, summary, highlights[] |
| `AwardsForm` | list: title, date, awarder, summary |
| `PublicationsForm` | list: name, publisher, releaseDate, url, summary |
| `InterestsForm` | list: name, keywords[] |

All form inputs write directly to the Zustand store via `setSectionData`. No local form state. Changes fire on every input event (no submit button per section).

---

## Section 3: Live Preview

**Preview tab** renders a live HTML/CSS React component reading from the Zustand store.

**Template components** (in `components/templates/`):

| Component | Style |
|---|---|
| `ClassicTemplate` | Clean layout, thin horizontal dividers between sections, serif-adjacent typography |
| `ModernTemplate` | Bold dark header block, accent-colored section titles |
| `MinimalTemplate` | Typography-only, no lines or decorative elements, hierarchy via font weight and size |

Each template accepts `{ data: ResumeData, meta: ResumeMeta }`. `meta.templateId` selects which component renders. `meta.layout` (`'single-column'` | `'two-column'`) is handled inside each template. Two-column variant renders column 1 fully top-to-bottom, then column 2 — never horizontally across columns.

**Performance:** Preview re-renders on a 300 ms debounce — the store updates immediately but the preview component is throttled to ~3 re-renders/second.

**Display:** A4 aspect ratio container, scaled via CSS `transform: scale()` to fit the pane. Zoom control: 75%, 100%, fit-to-pane.

**Typography constraints enforced in template CSS:**
- Name/header: 18–22 pt
- Section headers: 12–14 pt
- Body text: 10–12 pt
- Page margins: minimum 0.5 in (hard — `meta.pageMargins` is clamped at the store level)
- Line spacing: 1.0–1.15 only

---

## Section 4: Design Panel

**Design tab** contains controls that write to `meta` in the Zustand store (triggering the same debounced auto-save).

| Control | Values | `meta` field |
|---|---|---|
| Template selector | Classic / Modern / Minimal (card picker) | `templateId` |
| Layout toggle | Single column / Two column | `layout` |
| Body font | Calibri, Arial, Helvetica, Garamond, Cambria, Georgia, Lato, Roboto, IBM Plex Sans | `fontFamily` |
| Heading font | Same list | `headerFontFamily` |
| Primary color | Hex color picker + swatch | `primaryColor` |
| Accent color | Hex color picker + swatch | `accentColor` |
| Page margins | Slider 0.5–1.5 in, step 0.1 | `pageMargins` |
| Line spacing | Slider 1.0–1.15, step 0.05 | `lineSpacing` |

**Hard constraints enforced in UI (not just recommended):**
- Margin slider minimum: 0.5 in — physically cannot go lower.
- Line spacing clamped to 1.0–1.15.
- Only ATS-safe fonts offered (Tier 1: Calibri, Arial, Helvetica, Garamond, Cambria, Georgia; Tier 2: Lato, Roboto, IBM Plex Sans).

---

## Section 5: Export

Three export buttons in the header bar. All read from the Zustand store at click time.

**JSON export** — client-side only. `JSON.stringify({ data, meta })` → `Blob` → browser download. No server call.

**PDF export** — server route `POST /api/resumes/[id]/export/pdf`.
- Renders via `@react-pdf/renderer` using PDF-specific template components in `lib/pdf/templates/` (`ClassicPdfTemplate`, `ModernPdfTemplate`, `MinimalPdfTemplate`).
- These are separate from the HTML preview components and use only `@react-pdf/renderer` primitives (`Document`, `Page`, `View`, `Text`).
- Rules enforced:
  - Semantic tags on every text block — no raw unstyled text nodes.
  - Two-column: render column 1 top-to-bottom, then column 2.
  - Decorative elements (dividers, background shapes) tagged as PDF Artifacts.
  - Never `window.print()`.
- Response: `application/pdf` stream → browser download.

**DOCX export** — server route `POST /api/resumes/[id]/export/docx`.
- Renders via the `docx` npm package.
- Rules enforced:
  - Native paragraph styles and document margins only.
  - No Word text boxes, floating objects, or nested layout tables.
  - Custom fonts mapped to nearest system font (e.g. Lato → Arial, Calibri stays Calibri).
  - ATS-linear reading order regardless of visual two-column layout.
- Response: `application/vnd.openxmlformats-officedocument.wordprocessingml.document` stream → browser download.

Both export routes use the same auth guard pattern as Phase 1 API routes.

---

## Section 6: Error Handling & Testing

**Error handling:**
- Resume not found on initial fetch → `notFound()`.
- Auto-save PATCH failure → retry once after 3 s; if still failing, non-blocking toast; `isDirty` stays `true`.
- Export failure → toast with error message; export button returns to idle state.
- No optimistic UI for saves — store is the source of truth, DB is eventually consistent.

**Testing (Vitest):**
- Zustand store: all actions, debounce subscriber, `isDirty` state transitions, retry logic.
- `meta` clamping: margin hard minimum, line spacing bounds.
- Each form component: write-through to store (mock store, assert `setSectionData` called with correct args).
- PDF template renderer: assert document structure — section order, no raw text nodes, two-column reading order.
- DOCX template renderer: assert no text boxes or floating objects, font mapping, linear reading order.

---

## File Map

**New files:**
- `lib/stores/resume-editor.store.ts` — Zustand store
- `components/editor/EditorShell.tsx` — tab shell + header bar
- `components/editor/forms/BasicsForm.tsx`
- `components/editor/forms/WorkForm.tsx`
- `components/editor/forms/EducationForm.tsx`
- `components/editor/forms/SkillsForm.tsx`
- `components/editor/forms/CertificatesForm.tsx`
- `components/editor/forms/ProjectsForm.tsx`
- `components/editor/forms/LanguagesForm.tsx`
- `components/editor/forms/VolunteerForm.tsx`
- `components/editor/forms/AwardsForm.tsx`
- `components/editor/forms/PublicationsForm.tsx`
- `components/editor/forms/InterestsForm.tsx`
- `components/editor/AccordionSection.tsx` — reusable accordion item wrapper
- `components/editor/DesignPanel.tsx` — design controls tab
- `components/templates/ClassicTemplate.tsx`
- `components/templates/ModernTemplate.tsx`
- `components/templates/MinimalTemplate.tsx`
- `lib/pdf/templates/ClassicPdfTemplate.tsx`
- `lib/pdf/templates/ModernPdfTemplate.tsx`
- `lib/pdf/templates/MinimalPdfTemplate.tsx`
- `app/api/resumes/[id]/export/pdf/route.ts`
- `app/api/resumes/[id]/export/docx/route.ts`

**Modified files:**
- `app/(dashboard)/dashboard/resumes/[id]/page.tsx` — replace placeholder with editor
- `package.json` — add `zustand`, `@react-pdf/renderer`, `docx`

---

## Out of Scope for Phase 2a

- Drag-and-drop section reordering (Phase 3, tied to AI section suggestions)
- ATS scoring display (Phase 3)
- AI content generation (Phase 3)
- Section visibility toggles (Phase 3)
- Mobile/responsive editor layout (Phase 4 QA)
