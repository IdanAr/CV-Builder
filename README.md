# CV Builder - AI-Driven Résumé, Cover Letter & Job-Application Platform

> **Build résumés that beat ATS parsers and impress humans - then track every application from a spreadsheet-style board, without ever leaving the tool.**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)
![Vitest](https://img.shields.io/badge/tests-97%20suites-brightgreen?logo=vitest)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [CV Templates & Export Modes](#cv-templates--export-modes)
6. [AI Copilot - Generate → Critique → Refine](#ai-copilot--generate--critique--refine)
7. [ATS Scoring & Auto-Fix](#ats-scoring--auto-fix)
8. [Application Tracking Supertable](#application-tracking-supertable)
9. [Data Model](#data-model)
10. [Project Structure](#project-structure)
11. [Getting Started](#getting-started)
12. [Environment Variables](#environment-variables)
13. [API Reference](#api-reference)
14. [Testing](#testing)
15. [Contributing](#contributing)
16. [License](#license)

---

## Overview

CV Builder is a full-stack, AI-assisted résumé platform for job seekers who need their CVs to pass Applicant Tracking System (ATS) filters **and** look polished to human eyes - and who then need somewhere to track every application they send out. Career data is authored once against the [JSON Resume v1.0.0](https://jsonresume.org/schema/) standard, decoupled from a separate design/meta tree, so switching templates never touches the underlying facts.

Key differentiators:

- **Dual-track, dual-mode export** - a *Designed* PDF (one of five visual templates, or DOCX via native paragraph styles) for humans, and a plain-text *ATS-safe* PDF mode for parsers, selected per export.
- **Generate → Critique → Refine AI pipeline** - every AI draft (bullet points, summaries, ATS rewrites, cover letters) is critiqued by a second pass before it reaches the user, and any invented number or skill is flagged for explicit approval.
- **Real-time ATS scoring with one-click auto-fix** - paste a job description, get a 0–100 score across four vectors, then let AI rewrite the weak sections directly against the missing keywords.
- **AI-generated, hallucination-guarded cover letters**, tailored to a job description and generated from the same résumé facts.
- **A job-application tracking supertable** - an Airtable/Notion-style grid with a Kanban board view, custom columns, multi-column sort, filters, drag-and-drop, and a per-row activity log - to manage every résumé version you send out and where it stands.
- **Live preview** - the editor renders a paginated HTML/CSS mirror of the document on every keystroke via a debounced Zustand store; the actual PDF/DOCX binary is only compiled on export.

---

## Features

### Editor
- Section-based accordion editor covering all JSON Resume sections: Basics, Work, Education, Skills, Certificates, Awards, Publications, Volunteer, Languages, Interests, Projects, plus unlimited custom sections with per-field type configuration.
- Drag-and-drop section reordering via `@dnd-kit`.
- Rich text formatting (bold, italic, underline) in bullet/summary fields.
- Undo/redo, dirty-state tracking, `beforeunload` guard against losing unsaved work, and per-field validation errors.
- Full keyboard and screen-reader accessibility pass on the editor shell.
- Mobile-responsive editor shell and navbar.

### Templates & Design
- Five ATS-safe visual templates: **Classic**, **Modern**, **Minimal**, **Executive**, **Sidebar** - plus a sixth, text-only **ATS** template used exclusively for ATS-safe export.
- Per-document design controls: font family, header font, primary/accent color (with a preset palette), page margins (0.5–1.5 in, hard floor enforced), line spacing (1.0–1.15).
- Single-column and two-column layouts; column assignment is drag-and-drop per section.
- Paginated live preview with zoom controls (fit / percentage / manual).
- Template switching never loses or corrupts career data - the design tree is fully decoupled from the data tree.

### AI Copilot
- One-click bullet-point writer from rough notes, and a professional summary generator - each run through the Generate → Critique → Refine pipeline.
- **ATS Fix**: analyzes the score gap against a job description and proposes targeted rewrites (or a brand-new summary) that weave in missing keywords, shown in a before/after review panel.
- **Cover letter generator**: drafts a 3-paragraph letter tailored to a job description, using only facts already present in the résumé.
- Hallucination guard: any metric or skill in AI output not traceable to the user's original input is highlighted for explicit approval before it's committed to the schema.
- Per-user rate limiting on all AI and upload endpoints.

### ATS Optimizer
- Paste any job description → instant 0–100 ATS score.
- Breakdown across four vectors: Format & Structure (25 pts), Keyword Density (35 pts), Strategic Keyword Placement in summary/recent titles (25 pts), Metric & Outcome Presence (15 pts).
- Matched keywords shown as chips; missing keywords flagged with a fix action. Keywords can be explicitly excluded from scoring without disappearing from the UI.

### Export
- **PDF (Designed)** - via `@react-pdf/renderer`, one of five visual templates, semantic tags, Artifact-tagged decorative elements.
- **PDF (ATS-safe)** - a dedicated single-column, plain-text template that guarantees linear reading order for parsers.
- **DOCX** - via the `docx` package; native paragraph styles only (no text boxes, floating objects, or nested tables); web fonts mapped to ATS-safe system fonts (e.g. Lato → Arial).

### Upload & Parse
- Upload an existing PDF or DOCX résumé; it's parsed and auto-extracted into the JSON Resume schema.

### Application Tracking
- A spreadsheet-style **supertable** of every job application, with a **Table view** and a **Kanban board view** (drag cards between status lanes).
- Built-in columns (Company, Role, Status, Resume, Applied date) plus unlimited custom columns (text, number, date, url, select, status, checkbox), each with editable options and colors.
- Inline-editable cells, row and column drag-and-drop reordering, multi-column sort, and a client-side filter bar with per-column-type filter editors.
- Every change is diffed and written to a per-row activity log, viewable in a popover.
- Quick-add entry points from the dashboard and from individual résumé cards; duplicating a résumé links the new version and resets its application status.

### Auth
- GitHub OAuth and Google OAuth via Auth.js v5, backed by the MongoDB adapter.
- Session-scoped résumé and application library - each user owns their own data.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, Turbopack dev) | 16.2.x |
| UI Runtime | React | 19.2.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.4.x |
| State Management | Zustand | 5.x |
| Schema Validation | Zod | 4.x |
| PDF Export | @react-pdf/renderer | 4.5.x |
| DOCX Export | docx | 9.7.x |
| AI | Anthropic Claude (Haiku 4.5) via `@anthropic-ai/sdk` | 0.100.x |
| Database | MongoDB via Mongoose | 9.x |
| Auth | Auth.js (NextAuth) v5 beta + `@auth/mongodb-adapter` | 5.0.0-beta.31 |
| PDF / DOCX Parsing | pdf-parse, mammoth | latest |
| WebGL Effects | OGL | 1.x |
| Drag & Drop | @dnd-kit (core, sortable, utilities) | 6.x / 10.x |
| Testing | Vitest + @testing-library/react + jsdom | 4.x |

> **Note:** the original PRD scoped a multi-model AI router (Claude / GPT-4o / Groq). The implementation consolidated on a single model - **Claude Haiku 4.5** - for every AI feature (suggestions, ATS fix, cover letters); there is no OpenAI or Groq dependency in the codebase today.

---

## Architecture

### Two-Tree Document Model

Every résumé in the database is stored as two decoupled trees, plus lightweight application-tracking fields on the parent document:

```
{
  title: string
  data: ResumeData            // JSON Resume v1.0.0 payload - all career facts, incl. coverLetter
  meta: ResumeMeta             // Design metadata - template, fonts, colors, margins, layout
  applicationStatus: 'draft' | 'applied' | 'interviewing' | 'offer' | 'rejected'
  targetCompany?: string
  targetRole?: string
}
```

The visual layer is a **consumer** of `data`. Template switching updates `meta` only and never touches `data`. This is the core architectural invariant. Job-specific tracking (company/role/status) lives alongside - but structurally separate from - career facts, so tailoring a résumé for one application never contaminates another.

### State Flow

```
User keystroke
     │
     ▼
useResumeEditorStore (Zustand)
     │
     ├─► immediate update to data/meta trees (isDirty = true)
     │
     ├─► debounced, paginated HTML live-preview re-render
     │         (CSS mirror, no PDF compilation)
     │
     └─► auto-save PATCH /api/resumes/:id  (debounced)

On explicit Export:
     └─► POST /api/resumes/:id/export/pdf   { mode: 'designed' | 'ats' }
     └─► POST /api/resumes/:id/export/docx
```

The PDF binary is **never** compiled on keystroke - `@react-pdf/renderer` only runs on export routes and on the server-side preview-pagination endpoint (rate-limited separately from AI calls).

### Application Tracking Data Model

Applications live in their own collection, decoupled from résumés so the board's columns/sort/filters are user-level configuration rather than per-résumé state:

```
Application        { userId, company, role, status, resumeId, customFields{...} }
ApplicationActivity { applicationId, field, oldValue, newValue, changedAt }  // diff-and-log audit trail
BoardConfig         { userId, columns: BoardColumn[], sort: SortEntry[] }     // one per user
```

`BoardColumn` supports built-in fields (`company`, `role`, `status`, `resumeId`, `createdAt` - reorderable but not deletable) alongside unlimited custom columns of type `text | number | date | url | select | status | checkbox`, each with its own `order`, optional `width`, and (for `select`/`status`) user-defined colored options.

### Directory Layout

```
cv-builder/
├── app/
│   ├── (auth)/signin/                       # GitHub / Google sign-in page
│   ├── (dashboard)/
│   │   ├── dashboard/                       # Resume library
│   │   ├── dashboard/applications/          # Application supertable (table + board views)
│   │   └── dashboard/resumes/[id]/          # Full editor page
│   ├── api/
│   │   ├── resumes/                         # CRUD
│   │   ├── resumes/[id]/ai-suggest/         # Bullet / summary AI copilot
│   │   ├── resumes/[id]/ats-score/          # ATS scoring endpoint
│   │   ├── resumes/[id]/ats-fix/            # AI-proposed ATS rewrites
│   │   ├── resumes/[id]/cover-letter/       # AI cover letter generator
│   │   ├── resumes/[id]/export/{pdf,docx}/  # Export (pdf supports mode: ats | designed)
│   │   ├── resumes/[id]/duplicate/          # Fork a resume (links version, resets status)
│   │   ├── resumes/upload/{parse,extract}/  # Upload + AI extraction into JSON Resume
│   │   ├── applications/                    # Application CRUD (+ diff-and-log on PATCH)
│   │   ├── applications/[id]/activity/      # Per-row activity log
│   │   ├── applications/board-config/       # Column/sort configuration
│   │   └── preview/pagination/              # Server-side paginated preview render
│   └── page.tsx                             # Landing / marketing page
├── components/
│   ├── editor/                              # EditorShell, EditTab, DesignPanel, PreviewTab, forms/
│   ├── templates/                           # HTML/CSS live-preview templates (5 templates)
│   ├── ats/                                 # AtsScorePanel, AtsFixReviewPanel
│   ├── ai/                                  # AiSuggestButton
│   ├── coverletter/                         # CoverLetterPanel
│   ├── applications/                        # ApplicationsView, Board, Table, Filters, ActivityLog, ColumnForm
│   └── ui/                                  # AppNavbar, PlasmaBackground, Toaster, UserProfileButton
├── lib/
│   ├── ai/                                  # pipeline.ts, ats-fix-pipeline.ts, cover-letter-pipeline.ts, hallucination-guard.ts, models.ts
│   ├── ats/                                 # scorer.ts, keywords.ts
│   ├── applications/                        # cells.ts, filter.ts, order.ts, sort.ts, types.ts
│   ├── docx/                                # resume-docx.ts
│   ├── pdf/templates/                       # 6 @react-pdf/renderer templates incl. AtsPdfTemplate
│   ├── schemas/                             # resume.zod.ts, application.zod.ts
│   ├── stores/                              # resume-editor.store.ts, toast.store.ts (Zustand)
│   ├── upload/                              # parse-file.ts, extract-resume.ts
│   ├── rate-limit.ts                        # In-memory token-bucket limiter (AI / upload / preview)
│   ├── export-mode.ts                       # 'ats' | 'designed' export mode parsing
│   ├── preview-pagination.ts, preview-anchor.ts
│   └── mongodb.ts, auth.ts, db.ts, sections.ts, text-diff.ts, format-date.ts, …
├── models/                                  # Resume.ts, Application.ts, ApplicationActivity.ts, BoardConfig.ts
├── types/                                   # Global TypeScript types
└── docs/superpowers/                        # Sprint-by-sprint specs and implementation plans
```

---

## CV Templates & Export Modes

| Template | Layout | Where used |
|---|---|---|
| Classic | Single-column | Live preview + PDF |
| Modern | Single-column | Live preview + PDF |
| Minimal | Single-column | Live preview + PDF |
| Executive | Single/two-column | Live preview + PDF |
| Sidebar | Two-column | Live preview + PDF |
| ATS | Single-column, plain text | PDF export only, when `mode: 'ats'` |

Every export call chooses between two modes:

- **`designed`** (default) - renders the résumé's assigned visual template, styled per its Design tab settings.
- **`ats`** - ignores the visual template entirely and renders the dedicated `AtsPdfTemplate`: strictly linear reading order, no columns, no decorative elements, built for maximum ATS parser compatibility.

DOCX export always uses native paragraph styling regardless of mode, since Word documents are inherently more parser-friendly than PDFs.

---

## AI Copilot - Generate → Critique → Refine

Every AI-authored piece of content - bullet points, summaries, ATS-targeted rewrites, and cover letters - runs through the same three-step chain, all on **Claude Haiku 4.5**:

1. **Generate** - drafts content from the user's rough notes (or, for ATS Fix, from the gap between the résumé and a job description).
2. **Critique** - a second pass checks the draft against the original input: is every number/percentage traceable to source text? Does it start with a strong action verb? Is the tone professional?
3. **Refine** - applies the critique's corrections and returns the final text.

**Hallucination guard:** independent of the critique step, `detectHallucinations()` compares the final output's numeric claims and skill/technology terms against the user's original text. Anything not found in the source is returned as a `pendingApprovals` list and surfaced in the UI - nothing is silently written to the JSON schema without the user explicitly accepting it.

All AI endpoints are rate-limited to 10 requests/minute per user.

---

## ATS Scoring & Auto-Fix

`scoreResume()` computes a 0–100 score across four vectors:

| Vector | Max points | What it measures |
|---|---|---|
| Format & Structure | 25 | Required fields present, summary length, complete work entries, well-formed highlights, structured skills |
| Keyword Density | 35 | Literal (non-semantic) overlap between the job description and the full résumé text |
| Strategic Keyword Placement | 25 | Overlap weighted toward the summary and most recent job titles |
| Metric & Outcome Presence | 15 | Share of bullet points containing a number, percentage, dollar amount, or multiplier |

Keywords can be explicitly excluded from a specific job description's scoring - excluded terms still render as muted chips in the UI rather than disappearing, so the exclusion stays visible and reversible.

**ATS Fix** takes the missing-keyword list and asks the AI pipeline to rewrite the weakest section (or draft a summary from scratch if none exists), producing a diffable before/after suggestion - reviewed through the same hallucination guard before it can be applied.

---

## Application Tracking Supertable

A dedicated `/dashboard/applications` view for managing every job application, independent of résumé editing:

- **Table view** - inline-editable grid, click-to-sort headers (shift-click for multi-column sort), row/column drag-and-drop with fractional-index reordering, and a filter bar with a type-aware editor per column (text contains, number range, date range, select/status membership, checkbox).
- **Board view** - the same data as Kanban lanes by status, with drag-and-drop status changes.
- **Custom columns** - add, edit, or delete columns of type text, number, date, url, select, status, or checkbox; select/status columns get user-defined, colored options. Built-in columns (Company, Role, Status, Resume, Applied) can be reordered but not deleted.
- **Activity log** - every field change is diffed and appended to an audit trail, viewable per row in a popover.
- **Entry points** - quick-add from the applications toolbar, or directly from the dashboard/résumé cards, which pre-fills the linked résumé.

---

## Data Model

```typescript
// JSON Resume v1.0.0 payload, extended with a cover letter field
interface ResumeData {
  basics?: Basics
  work?: Work[]
  education?: Education[]
  skills?: Skill[]
  certificates?: Certificate[]
  awards?: Award[]
  publications?: Publication[]
  volunteer?: Volunteer[]
  languages?: Language[]
  interests?: Interest[]
  projects?: Project[]
  customSections?: CustomSection[]
  coverLetter?: string
}

interface ResumeMeta {
  templateId: string          // 'classic' | 'modern' | 'minimal' | 'executive' | 'sidebar'
  fontFamily: string
  headerFontFamily: string
  primaryColor: string
  accentColor: string
  pageMargins: number          // 0.5–1.5, hard floor at 0.5
  lineSpacing: number           // 1.0–1.15
  sectionOrder: string[]
  layout: 'single-column' | 'two-column'
  columnAssignment: Record<string, 'left' | 'right'>
  excludedAtsKeywords: string[]
}

interface Resume {
  title: string
  data: ResumeData
  meta: ResumeMeta
  applicationStatus: 'draft' | 'applied' | 'interviewing' | 'offer' | 'rejected'
  targetCompany?: string
  targetRole?: string
}

interface Application {
  userId: string
  company: string
  role: string
  status: string               // references a BoardConfig 'status' column option
  resumeId?: string
  customFields: Record<string, unknown>
}

interface BoardConfig {
  userId: string
  columns: BoardColumn[]        // built-in + custom
  sort: SortEntry[]             // ordered = multi-column sort
}
```

All schemas are defined once in Zod (`lib/schemas/resume.zod.ts`, `lib/schemas/application.zod.ts`) and TypeScript types are inferred from them - there is no separate hand-written type layer to drift out of sync.

---

## Getting Started

```bash
# Install dependencies
cd cv-builder
npm install

# Configure environment
cp .env.local.example .env.local
# then fill in MongoDB, Auth.js, OAuth, and Anthropic credentials - see below

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build      # production build
npm run start      # run production build
npm run lint       # ESLint
npm run test       # Vitest, watch mode
npm run test:run   # Vitest, single run (CI)
```

---

## Environment Variables

Copy `cv-builder/.env.local.example` to `cv-builder/.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `AUTH_SECRET` | Auth.js session secret (`openssl rand -base64 32`) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth app credentials |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth app credentials |
| `ANTHROPIC_API_KEY` | Powers all AI Copilot features (suggestions, ATS Fix, cover letters, upload extraction) - Claude Haiku 4.5 |

---

## API Reference

All routes below are session-authenticated via Auth.js (`auth()` wrapper) and scoped to the requesting user.

### Resumes
| Method | Route | Purpose |
|---|---|---|
| `GET` / `POST` | `/api/resumes` | List / create résumés |
| `GET` / `PATCH` / `DELETE` | `/api/resumes/:id` | Read / update / delete a résumé |
| `POST` | `/api/resumes/:id/duplicate` | Fork a résumé; links version, resets application status |
| `POST` | `/api/resumes/:id/ai-suggest` | Generate a bullet point or summary suggestion |
| `POST` | `/api/resumes/:id/ats-score` | Score against a pasted job description |
| `POST` | `/api/resumes/:id/ats-fix` | Propose AI rewrites targeting missing keywords |
| `POST` | `/api/resumes/:id/cover-letter` | Generate a tailored cover letter |
| `POST` | `/api/resumes/:id/export/pdf` | Export PDF (`mode: 'designed' \| 'ats'`) |
| `POST` | `/api/resumes/:id/export/docx` | Export DOCX |
| `POST` | `/api/resumes/upload/parse` | Parse an uploaded PDF/DOCX into raw text |
| `POST` | `/api/resumes/upload/extract` | AI-extract parsed text into the JSON Resume schema |

### Applications
| Method | Route | Purpose |
|---|---|---|
| `GET` / `POST` | `/api/applications` | List / create application rows |
| `PATCH` / `DELETE` | `/api/applications/:id` | Update (diffed to activity log) / delete a row |
| `GET` | `/api/applications/:id/activity` | Fetch the per-row change history |
| `GET` / `PATCH` | `/api/applications/board-config` | Read / update the user's columns and sort spec |

### Preview
| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/preview/pagination` | Server-side paginated render used by the live preview |

### Auth
| Method | Route | Purpose |
|---|---|---|
| `*` | `/api/auth/[...nextauth]` | Auth.js GitHub/Google OAuth handlers |

---

## Testing

The project has **97 Vitest test suites** covering schemas, API routes, AI pipelines (including hallucination detection), the ATS scorer, DOCX/PDF template rendering, pagination math, the application-tracking sort/filter/order logic, and editor components, run via `@testing-library/react` + `jsdom`.

```bash
npm run test        # watch mode
npm run test:run    # single run, CI-friendly
```

---

## Contributing

This repository follows a sprint-based workflow - each feature sprint has a design spec and implementation plan under `docs/superpowers/` before merge. When adding a feature:

1. Extend the relevant Zod schema first (`lib/schemas/`) - it is the single source of truth for both runtime validation and TypeScript types.
2. Keep the data tree and design/meta tree decoupled; never let a visual/template concern reach into `ResumeData`.
3. Any new AI-generated content must pass through the hallucination guard before being committed.
4. Multi-column PDF/DOCX layouts must preserve linear reading order for ATS parsers - verify with the `ats` export mode.
5. Add or update tests alongside the change; `npm run test:run` should stay green.

## License

MIT License

Copyright MIT © 2026 IdanAr (idan.rbel@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

