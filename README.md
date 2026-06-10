# CV Builder — AI-Driven Résumé & ATS Optimization Platform

> **Build résumés that beat ATS parsers and impress humans — powered by a three-agent AI pipeline, a live editor, and five ATS-safe templates.**

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Design System](#design-system)
6. [CV Templates](#cv-templates)
7. [AI Copilot — Teacher-Student Pipeline](#ai-copilot--teacher-student-pipeline)
8. [ATS Scoring Engine](#ats-scoring-engine)
9. [Data Model](#data-model)
10. [Project Structure](#project-structure)
11. [Getting Started](#getting-started)
12. [Environment Variables](#environment-variables)
13. [API Reference](#api-reference)
14. [Testing](#testing)
15. [Implementation Phases](#implementation-phases)
16. [Contributing](#contributing)
17. [License](#license)

---

## Overview

CV Builder is a full-stack, AI-assisted résumé builder built for job seekers who need their CVs to pass Applicant Tracking System (ATS) filters **and** look polished to human eyes. The platform decouples visual presentation from structural data: you author once against the [JSON Resume v1.0.0](https://jsonresume.org/schema/) standard, and the engine outputs both a pixel-perfect PDF and a machine-readable DOCX that ATS software can parse without errors.

Key differentiators:

- **Dual-track export** — PDF rendered by `@react-pdf/renderer` for visual fidelity; DOCX rendered by the `docx` package using only native paragraph styles (no text boxes, no floating objects, no nested tables that break parsers).
- **Three-agent AI pipeline** — a Generate → Critique → Refine chain flags any invented metrics before they reach your document.
- **Real-time ATS scoring** — paste a job description and get an immediate 0–100 score broken down across four vectors, with matched and missing keywords highlighted.
- **Live preview** — the editor renders an HTML/CSS mirror of your document on every keystroke via a debounced Zustand store; the actual PDF binary is only compiled on export.

---

## Features

### Editor
- Section-based accordion editor covering all JSON Resume sections: Basics, Work, Education, Skills, Certificates, Awards, Publications, Volunteer, Languages, Interests, Projects, plus unlimited custom sections.
- Drag-and-drop section reordering via `@dnd-kit`.
- Undo / redo history (50-step stack).
- Auto-save with dirty-state tracking and per-field error display.
- Rich text input (bold, italic, underline) in bullet / summary fields.

### Templates & Design
- Five ATS-safe CV templates: **Classic**, **Modern**, **Minimal**, **Executive**, **Sidebar**.
- Per-document design controls: font family, header font, primary color, accent color, page margins (0.5–1.5 in), line spacing (1.0–1.15).
- Single-column and two-column layouts; column assignment is drag-and-drop per section.
- Template switching never loses or corrupts career data (design tree is fully decoupled from data tree).

### AI Copilot
- One-click bullet-point writer from rough notes.
- Professional summary generator.
- Hallucination guard: any metric or skill not present in the user's original input is highlighted for explicit approval before being committed to the schema.

### ATS Optimizer
- Paste any job description → instant 0–100 ATS score.
- Breakdown across four vectors: Format & Structure (25 pts), Keyword Density (35 pts), Strategic Keyword Placement (25 pts), Metric Presence (15 pts).
- Matched keywords shown in green; missing keywords shown in red with suggested placements.

### Export
- **PDF** — via `@react-pdf/renderer` with semantic tags and Artifact-tagged decorative elements.
- **DOCX** — via the `docx` package; web fonts mapped to ATS-safe system fonts (e.g. Lato → Arial).

### Upload & Parse
- Upload an existing PDF or DOCX résumé and have it parsed into the JSON Resume schema automatically.

### Auth
- GitHub OAuth and Google OAuth via Auth.js v5.
- Session-scoped résumé library (each user owns their own documents).

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.4.x |
| State Management | Zustand (with `subscribeWithSelector`) | 5.x |
| Schema Validation | Zod | 4.x |
| PDF Export | @react-pdf/renderer | 4.5.x |
| DOCX Export | docx | 9.7.x |
| AI | Anthropic Claude (Haiku 4.5) | SDK 0.100.x |
| Database | MongoDB via Mongoose | 9.x |
| Auth | Auth.js (NextAuth) v5 beta | 5.0.0-beta.31 |
| PDF / DOCX Parsing | pdf-parse, mammoth | latest |
| WebGL Effects | OGL | 1.x |
| DnD | @dnd-kit (core, sortable, utilities) | 6.x / 10.x |
| Testing | Vitest + @testing-library/react | 4.x |

---

## Architecture

### Two-Tree Document Model

Every résumé in the database is stored as two decoupled trees:

```
{
  data: ResumeData   // JSON Resume v1.0.0 payload — all career facts
  meta: ResumeMeta   // Design metadata — template, fonts, colors, margins, layout
}
```

The visual layer is a **consumer** of `data`. Template switching updates `meta` only and never touches `data`. This is the core architectural invariant.

### State Flow

```
User keystroke
     │
     ▼
useResumeEditorStore (Zustand)
     │
     ├─► immediate update to data/meta trees (isDirty = true)
     │
     ├─► debounced HTML live-preview re-render
     │         (CSS mirror, no PDF compilation)
     │
     └─► auto-save PATCH /api/resumes/:id  (debounced ~1 s)

On explicit Export:
     └─► POST /api/resumes/:id/export/pdf  (compiles @react-pdf/renderer)
     └─► POST /api/resumes/:id/export/docx (compiles docx package)
```

The PDF binary is **never** compiled on keystroke. `@react-pdf/renderer` is only invoked on the export API routes.

### Directory Layout

```
cv-builder/
├── app/
│   ├── (auth)/signin/          # GitHub / Google sign-in page
│   ├── (dashboard)/
│   │   ├── dashboard/          # Resume library page
│   │   └── dashboard/resumes/[id]/   # Full editor page
│   ├── api/
│   │   ├── resumes/            # CRUD: GET, POST
│   │   ├── resumes/[id]/       # CRUD: GET, PATCH, DELETE
│   │   ├── resumes/[id]/ai-suggest/  # AI copilot endpoint
│   │   ├── resumes/[id]/ats-score/   # ATS scoring endpoint
│   │   ├── resumes/[id]/export/pdf/  # PDF export
│   │   ├── resumes/[id]/export/docx/ # DOCX export
│   │   ├── resumes/[id]/duplicate/   # Fork a resume
│   │   └── resumes/upload/     # PDF/DOCX parse-and-import
│   ├── demo/                   # Public demo page
│   └── page.tsx                # Landing / marketing page
├── components/
│   ├── editor/                 # EditorShell, EditTab, DesignPanel, PreviewTab
│   │   └── forms/              # BasicsForm, WorkForm, EducationForm, …
│   ├── templates/              # HTML/CSS live-preview templates (5 templates)
│   ├── ats/                    # AtsScorePanel
│   ├── ai/                     # AiSuggestButton
│   └── ui/                     # AppNavbar, PlasmaBackground, UserProfileButton
├── lib/
│   ├── ai/                     # pipeline.ts, hallucination-guard.ts, models.ts
│   ├── ats/                    # scorer.ts, keywords.ts
│   ├── docx/                   # resume-docx.ts (DOCX builder)
│   ├── pdf/templates/          # @react-pdf/renderer templates (5 templates)
│   ├── schemas/                # resume.zod.ts — all Zod schemas & TypeScript types
│   ├── stores/                 # resume-editor.store.ts (Zustand)
│   ├── upload/                 # parse-file.ts, extract-resume.ts
│   ├── hooks/                  # use-debounce.ts
│   └── mongodb.ts, auth.ts, db.ts, …
├── models/
│   └── Resume.ts               # Mongoose schema
├── types/                      # Global TypeScript types
├── docs/                       # Architecture specs and implementation plans
└── design-export/              # CV Builder Design System bundle
```

---

## Design System

The project ships with a compiled Design System bundle (`design-export/`) that documents all brand tokens, UI components, and CV template components.

### Visual Registers

The platform has **two distinct visual registers**:

| Register | Where | Stack |
|---|---|---|
| **App UI** | Editor, dashboard, navbar | Indigo/purple glassmorphism on **Inter** |
| **CV Documents** | Exported PDFs/DOCX, live preview | Black-on-white, ATS-safe A4, one accent color |

These are kept strictly separate. App UI chrome never bleeds into exported documents.

### Design Tokens

All tokens are CSS custom properties. Key categories:

| Token Group | Examples |
|---|---|
| **Colors** | `--color-primary: #4f46e5` (indigo-600 — the action color), `--color-primary-hover`, `--app-bg`, `--glass-bg` |
| **Typography** | `--font-ui: 'Inter'`, `--font-ats-calibri`, `--font-ats-garamond`, `--font-ats-lato`, `--font-ats-plex` |
| **Spacing** | `--page-margin-min: 48px` (0.5 in hard floor) |
| **Radius** | `--radius-sm`, `--radius-md`, `--radius-lg` |
| **Shadow** | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glow` |

### UI Components

The Design System exposes a compiled bundle at `window.CVBuilderDesignSystem_1d5ed3` (loaded from `_ds_bundle.js`). Available components:

| Component | Purpose |
|---|---|
| `Button` | Primary, secondary, ghost, danger variants; sm/md/lg sizes |
| `Badge` | `solid`, default, `matched` (green ✓), `missing` (red), `warn` (amber) |
| `Input` | Controlled text input with label, error, helper |
| `Select` | Dropdown select |
| `Tabs` | Edit / Design / ATS tab switcher |
| `RangeSlider` | Margins and line-spacing controls |
| `ScoreBar` | ATS score sub-vector progress bar |
| `Avatar` | Initials avatar with background derived from name |
| `GlassCard` | Glassmorphism panel container |
| `PlasmaBackground` | Animated WebGL plasma backdrop (OGL-powered, with fallback) |
| `Logo` | Brand wordmark SVG |

### ATS-Safe Font Tiers

Only these fonts are offered in the UI:

**Tier 1 (highest ATS compatibility):** Calibri, Arial, Helvetica, Garamond (EB Garamond), Cambria, Georgia (Source Serif 4)

**Tier 2 (high compatibility):** Lato, Roboto, IBM Plex Sans

Web fonts that are not natively available in Word are mapped to their nearest system equivalent in DOCX export (e.g. Lato → Arial, IBM Plex Sans → Calibri).

### Typography Constraints (enforced in UI)

| Element | Range |
|---|---|
| Name header | 18–22 pt |
| Section headers | 12–14 pt |
| Body text | 10–12 pt |
| Page margins | 0.5–1.5 in (0.5 in hard minimum) |
| Line spacing | 1.0–1.15 only |

---

## CV Templates

Five templates ship, all rendering from the same `{ data, meta }` payload:

| Template | Character | ATS Notes |
|---|---|---|
| **Classic** | Centered header, thin accent dividers | Single or two-column |
| **Modern** | Bold colored header banner, uppercase section titles | Single or two-column |
| **Minimal** | Typography only, maximum whitespace | Best raw ATS score |
| **Executive** | Serif fonts, traditional senior tone | Single column |
| **Sidebar** | Colored left rail for contact/skills + main column | Two-column (structural) |

Each template is implemented twice:

1. `components/templates/*.tsx` — HTML/CSS live-preview component (rendered in the browser).
2. `lib/pdf/templates/*PdfTemplate.tsx` — `@react-pdf/renderer` component (compiled server-side on export).

### PDF Export Rules

- All text uses semantic tags (`<H1>`, `<H2>`, `<P>`); no raw unstyled text nodes.
- Multi-column layouts render column 1 top-to-bottom, then column 2. Never cross-column horizontal rendering.
- Decorative elements (dividers, background shapes) are tagged as PDF Artifacts so parsers and screen readers skip them.
- `window.print()` is never used.

### DOCX Export Rules

- Only native paragraph styling, line spacing, and document margins.
- No Word text boxes, floating objects, or nested layout tables.
- Font mapping applied automatically (see ATS-Safe Font Tiers above).

---

## AI Copilot — Teacher-Student Pipeline

The AI content generation system is a three-agent chain that prevents hallucinated metrics from reaching the final document.

```
User rough notes
      │
      ▼
┌─────────────────┐
│  Generation     │  (Student)  — drafts bullet / summary from terse input
│  Agent          │             — model: claude-haiku-4-5-20251001
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Critique       │  (Teacher)  — validates: action verb, metrics from source,
│  Agent          │               no invented facts, professional tone
└────────┬────────┘             — returns "APPROVED" or specific issues
         │
         ▼
┌─────────────────┐
│  Refinement     │             — applies corrections; returns "APPROVED"
│  Agent          │               draft unchanged if no issues found
└────────┬────────┘
         │
         ▼
Hallucination Guard
      │
      ├─ Scans for: percentages (\d+%), dollar amounts ($\d+k/m), multipliers (\d+x),
      │  standalone 2+ digit numbers
      │
      └─ Any claim NOT present verbatim in the user's original input
         is returned as `pendingApprovals[]` and highlighted in the UI
         for explicit user sign-off before being committed to the schema.
```

**Route selection:** The architecture targets fast/cheap tasks (grammar check, real-time suggestions) to models with lower latency, and complex tasks (full document tailoring, tone matching) to more capable models. Currently all three agents use `claude-haiku-4-5-20251001`. The `models.ts` module provides the singleton client; swap the model string there to upgrade any agent independently.

---

## ATS Scoring Engine

Scores 0–100 across four vectors when given a `ResumeData` object and a job description string.

### Scoring Vectors

| Vector | Max | How it's measured |
|---|---|---|
| **Format & Structure** | 25 | Name present (+5), email present (+5), summary present (+5), work history present (+5), at least one work highlight present (+5) |
| **Keyword Density** | 35 | `matched / totalJdKeywords × 35` — literal string matching against all resume text |
| **Strategic Placement** | 25 | Same keyword match but only against high-value text: `basics.label`, `basics.summary`, most-recent job title and highlights |
| **Metric Presence** | 15 | Ratio of bullet highlights containing a number/%, dollar amount, multiplier, or team-size phrase — capped at 15 pts |

**Total = min(100, format + density + placement + metrics)**

Keyword extraction normalizes to lowercase, splits on non-alphanumeric boundaries, and filters stopwords. Matching is **literal** (not semantic) to mirror how real ATS software operates.

---

## Data Model

### ResumeData (JSON Resume v1.0.0 + extensions)

Validated by `ResumeDataSchema` (Zod). Sections:

`basics` · `work` · `education` · `skills` · `certificates` · `awards` · `publications` · `volunteer` · `languages` · `interests` · `projects` · `customSections`

`customSections` is an extension on top of the standard. Each custom section has an `id`, a `name`, a set of `enabledFields` chosen from `['subtitle', 'url', 'dateRange', 'summary', 'highlights', 'keywords', 'level']`, and an array of items.

### ResumeMeta

```ts
{
  templateId:        string           // 'classic' | 'modern' | 'minimal' | 'executive' | 'sidebar'
  fontFamily:        string           // body font
  headerFontFamily:  string           // name / section title font
  primaryColor:      string           // hex
  accentColor:       string           // hex
  pageMargins:       number           // 0.5–1.5 inches
  lineSpacing:       number           // 1.0–1.15
  sectionOrder:      string[]         // drag-and-drop ordering
  layout:            'single-column' | 'two-column'
  columnAssignment:  Record<string, 'left' | 'right'>
}
```

### MongoDB Document

```ts
{
  _id:       ObjectId
  userId:    string          // Auth.js session user id
  title:     string          // max 200 chars
  data:      ResumeData      // Mixed (JSON Resume payload)
  meta:      ResumeMeta
  createdAt: Date
  updatedAt: Date
}
```

---

## Project Structure

```
CV Builder/                     ← repo root
├── cv-builder/                 ← Next.js application
│   ├── app/                    ← Next.js App Router
│   ├── components/             ← React components
│   ├── lib/                    ← Business logic, utilities, AI, ATS, PDF, DOCX
│   ├── models/                 ← Mongoose schemas
│   ├── types/                  ← Global TypeScript type declarations
│   ├── docs/                   ← Architecture specs and phase plans
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── vitest.config.ts
│   └── .env.local.example
├── design-export/              ← Compiled CV Builder Design System
│   ├── _ds_bundle.js           ← All DS components compiled to a single UMD bundle
│   ├── _ds_manifest.json       ← Component registry and token catalogue
│   ├── styles.css              ← All design tokens as CSS custom properties
│   ├── components/             ← Source JSX + TypeScript declarations
│   │   ├── brand/              ← Logo
│   │   ├── core/               ← Button, Badge, Input, Select, Tabs, etc.
│   │   ├── effects/            ← PlasmaBackground (WebGL)
│   │   └── resume/             ← Five CV template components + shared utilities
│   ├── tokens/                 ← colors.css, typography.css, spacing.css, …
│   └── fonts/                  ← Calibri (6 weights), Cambria, Geist Mono
├── AI CV Builder PRD & Plan.md ← Full Product Requirements Document
├── CLAUDE.md                   ← Architecture reference for AI tooling
└── docs/                       ← Additional project documentation
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- A MongoDB Atlas cluster (free tier is fine for development)
- A GitHub OAuth app and/or a Google OAuth app (for authentication)
- An Anthropic API key (for the AI Copilot)

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/<your-org>/cv-builder.git
cd cv-builder/cv-builder

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.local.example .env.local
# Edit .env.local and fill in the values (see below)

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Copy `cv-builder/.env.local.example` to `cv-builder/.env.local` and fill in:

```env
# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority

# Auth.js secret — generate with: openssl rand -base64 32
AUTH_SECRET=

# GitHub OAuth
# Create at: https://github.com/settings/applications/new
# Homepage URL:   http://localhost:3000
# Callback URL:   http://localhost:3000/api/auth/callback/github
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# Google OAuth
# Create at: https://console.cloud.google.com/
# Authorized redirect URI: http://localhost:3000/api/auth/callback/google
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Anthropic API key — get at: https://console.anthropic.com/
ANTHROPIC_API_KEY=
```

You do **not** need all OAuth providers — comment out the ones you aren't using, and update `auth.config.ts` accordingly.

---

## API Reference

All routes are under `/api/` and require an authenticated session (except the demo page).

### Résumé CRUD

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/resumes` | List all résumés for the current user |
| `POST` | `/api/resumes` | Create a new résumé (`{ title, data?, meta? }`) |
| `GET` | `/api/resumes/:id` | Get a single résumé |
| `PATCH` | `/api/resumes/:id` | Update title, data, or meta (partial) |
| `DELETE` | `/api/resumes/:id` | Delete a résumé |
| `POST` | `/api/resumes/:id/duplicate` | Fork a résumé |

### Export

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/resumes/:id/export/pdf` | Download as PDF (compiled server-side) |
| `GET` | `/api/resumes/:id/export/docx` | Download as DOCX |

### AI Copilot

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/resumes/:id/ai-suggest` | `{ field, input, jobTitle?, company? }` | Generate a polished bullet or summary via the three-agent pipeline |

`field` is `"highlight"` or `"summary"`. The response includes `suggestion` (the final text) and `pendingApprovals` (array of strings representing metrics not found in the original input that need user confirmation).

### ATS Scoring

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/resumes/:id/ats-score` | `{ jobDescription: string }` | Score the résumé against a job description |

Returns `{ total, breakdown: { format, keywordDensity, keywordPlacement, metrics }, matchedKeywords, missingKeywords }`.

### Upload & Parse

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/resumes/upload/parse` | `multipart/form-data` with `file` | Extract raw text from a PDF or DOCX |
| `POST` | `/api/resumes/upload/extract` | `{ text: string }` | Convert raw text into a JSON Resume object via AI |

---

## Testing

The project uses **Vitest** with `@testing-library/react`.

```bash
# Run all tests (watch mode)
npm test

# Run once (CI mode)
npm run test:run
```

Test files are colocated with the source they cover using the `*.test.ts(x)` convention, and also live in `lib/**/__tests__/` directories.

Key test coverage areas:

| Area | File(s) |
|---|---|
| Zod schemas | `lib/schemas/__tests__/resume.zod.test.ts`, `resume-meta.test.ts` |
| ATS scorer | `lib/ats/__tests__/scorer.test.ts`, `keywords.test.ts` |
| AI pipeline | `lib/ai/__tests__/pipeline.test.ts`, `hallucination-guard.test.ts` |
| Zustand store | `lib/stores/__tests__/resume-editor.store.test.ts` |
| DOCX builder | `lib/docx/__tests__/resume-docx.test.ts` |
| Upload / parse | `lib/upload/__tests__/extract-resume.test.ts`, `parse-file.test.ts` |
| API routes | `app/api/resumes/[id]/ai-suggest/route.test.ts`, `ats-score/route.test.ts`, `export/pdf/route.test.ts`, etc. |
| UI components | `components/editor/*.test.tsx`, `components/*.test.tsx` |

---

## Implementation Phases

| Phase | Status | Focus |
|---|---|---|
| **1 — Foundation** | ✅ Complete | MongoDB, Zod schemas, JSON Resume types, Auth.js, CRUD API |
| **2a — Core Editor** | ✅ Complete | Drag-and-drop editor, accordion forms, design panel, live preview, undo/redo |
| **2b — Export Pipeline** | ✅ Complete | PDF (`@react-pdf/renderer`) and DOCX (`docx`) for all five templates |
| **3a — ATS Scoring** | ✅ Complete | Four-vector scorer, keyword extraction and overlap, missing-keyword suggestions |
| **3b — AI Copilot** | ✅ Complete | Three-agent pipeline (Generate → Critique → Refine), hallucination guard, upload-and-parse |
| **4 — Polish** | 🚧 In progress | Accessibility audits, PDF tag verification, performance, beta |

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-feature`.
3. Follow the architecture invariants in `CLAUDE.md` — particularly:
   - The visual layer never owns or transforms the schema.
   - The data tree and design tree are strictly decoupled.
   - PDF export must use semantic tags; DOCX export must use only native paragraph styles.
   - ATS compliance is a hard requirement, not a suggestion.
4. Add tests for new functionality.
5. Run `npm run test:run` and `npm run lint` before opening a PR.
6. Open a pull request against `main` with a clear description of the change.

---

## License

MIT © 2026 'CV Builder' Contributors, Idan Arbel (idan.rbel@gmail.com)
