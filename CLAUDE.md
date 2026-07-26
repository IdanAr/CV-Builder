# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The actual application lives in **`cv-builder/`**, not the repo root. The root only holds `README.md`, `docs/superpowers/` (sprint specs/plans — present on disk but **git-ignored**, internal use only; the same applies to `cv-builder/docs/superpowers/`), and a stray unused `package.json` (single `mongodb` dependency, not wired to anything — ignore it). All commands below are run from `cv-builder/`.

## Commands

```bash
cd cv-builder
npm run dev         # dev server (Next.js App Router, localhost:3000)
npm run build        # production build
npm run lint          # ESLint (next/core-web-vitals + next/typescript)
npx tsc --noEmit      # type check (run this — no separate "typecheck" script exists)
npm run test          # Vitest, watch mode
npm run test:run      # Vitest, single run (what CI runs)
npx vitest run path/to/file.test.ts          # run a single test file
npx vitest run -t "test name substring"      # run tests matching a name
```

CI (`.github/workflows/*.yml`) runs, in order: `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm run test:run`, all with `working-directory: cv-builder`. Match this locally before considering a change done.

Vitest defaults to `environment: 'node'` (`vitest.config.ts`); any test that renders React components must opt into jsdom with a `// @vitest-environment jsdom` comment at the top of the file. The `@/*` path alias resolves to the `cv-builder/` root in both TS and Vitest.

Env vars live in `cv-builder/.env.local` (copy from `.env.local.example`): `MONGODB_URI`, `AUTH_SECRET`, `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, `ANTHROPIC_API_KEY`.

## Architecture

CV Builder is a Next.js 16 App Router app (React 19, Turbopack dev): AI-assisted résumé builder (JSON Resume schema) with PDF/DOCX export and a separate job-application tracking supertable. Auth via Auth.js v5 (GitHub/Google OAuth, MongoDB adapter, JWT sessions). AI features run on a single model, Claude Haiku 4.5 via `@anthropic-ai/sdk` (`lib/ai/models.ts`) — there is no multi-provider router despite what an old PRD might suggest.

### Two-tree document model (core invariant)

Every résumé document has two decoupled trees plus tracking fields:

```
{
  title: string
  data: ResumeData   // JSON Resume v1.0.0 payload — all career facts, incl. coverLetter
  meta: ResumeMeta    // design metadata — template, fonts, colors, margins, layout
  applicationStatus: 'draft' | 'applied' | 'interviewing' | 'offer' | 'rejected'
  targetCompany?: string
  targetRole?: string
}
```

The visual layer only ever *consumes* `data`. Switching templates or design settings touches `meta` exclusively. **Never let a visual/template concern reach into `ResumeData`** — this is the invariant every editor/template/export change must preserve.

Schemas are defined once in Zod (`lib/schemas/resume.zod.ts`, `lib/schemas/application.zod.ts`); TypeScript types are inferred from them, not hand-written separately. Extend the Zod schema first when adding fields.

### State flow

`useResumeEditorStore` (Zustand, `lib/stores/resume-editor.store.ts`) is the single source of truth in the editor: every keystroke updates `data`/`meta` immediately (marking `isDirty`), triggers a debounced paginated HTML/CSS live-preview re-render, and a separate debounced autosave `PATCH /api/resumes/:id`. The actual PDF/DOCX binary is **never** compiled on keystroke — `@react-pdf/renderer` only runs on the export routes and the server-side preview-pagination endpoint (`/api/preview/pagination`, rate-limited separately from AI calls).

### AI pipeline: Generate → Critique → Refine

Every AI-authored piece of content (bullet points, summaries, ATS rewrites, cover letters) goes through the same three-step chain in `lib/ai/pipeline.ts` (plus `ats-fix-pipeline.ts`, `cover-letter-pipeline.ts`): generate a draft → critique it against the source input (numbers traceable? action verbs? tone?) → refine into final text. Independently, `hallucination-guard.ts`'s `detectHallucinations()` compares the final output's numeric claims and skill terms against the user's original text; anything unmatched is returned as `pendingApprovals` and must be surfaced in the UI for explicit user approval before being written to the schema. **Any new AI-generated content must pass through this guard.** All AI and upload endpoints are rate-limited (`lib/rate-limit.ts`, in-memory token bucket, 10 req/min/user — swap for a shared store like Upstash before scaling to multiple processes).

### Templates & export modes

Five visual templates (Classic, Modern, Minimal, Executive, Sidebar; `components/templates/` for live preview, `lib/pdf/templates/` for PDF) plus a dedicated `AtsPdfTemplate` used only for ATS-safe export. Every export call picks a mode:
- `designed` (default) — the résumé's assigned visual template.
- `ats` — ignores the visual template entirely, renders `AtsPdfTemplate`: strictly linear reading order, no columns/decoration, for parser compatibility.

DOCX export (`lib/docx/resume-docx.ts`) always uses native paragraph styles regardless of mode (no text boxes/floating objects/nested tables; web fonts mapped to ATS-safe system fonts). **Any multi-column PDF/DOCX layout change must preserve linear reading order in `ats` mode** — verify by actually exporting in that mode, not just visually inspecting `designed`.

### Application tracking (separate subsystem)

Lives in its own collection/UI (`/dashboard/applications`, `components/applications/`, `lib/applications/`), decoupled from résumés so board columns/sort/filters are user-level config rather than per-résumé state:

```
Application        { userId, company, role, status, resumeId, customFields{...} }
ApplicationActivity { applicationId, field, oldValue, newValue, changedAt }  // diff-and-log audit trail
BoardConfig         { userId, columns: BoardColumn[], sort: SortEntry[] }    // one per user
```

`BoardColumn` mixes built-in fields (`company`, `role`, `status`, `resumeId`, `createdAt` — reorderable, not deletable) with unlimited custom columns (`text | number | date | url | select | status | checkbox`). Every `PATCH` to an application row is diffed and appended to `ApplicationActivity` — when adding a new editable field, wire it into the diff-and-log path, not just the update handler.

### Auth & route protection

`middleware.ts` uses Auth.js's `authorized` callback (`auth.config.ts`) gated on `matcher: ['/dashboard/:path*', '/api/resumes/:path*', '/api/applications/:path*', '/api/preview/:path*']`. All API routes under those prefixes are expected to be session-scoped via the `auth()` wrapper and filtered to the requesting user — new routes under these paths must follow the same pattern, and `middleware.test.ts` should be extended when matcher coverage changes.

### Directory map

```
cv-builder/
├── app/
│   ├── (auth)/signin/                       # GitHub / Google sign-in
│   ├── (dashboard)/dashboard/                # Résumé library, applications view, editor ([id]/)
│   └── api/                                  # resumes/, applications/, preview/pagination/, auth/
├── components/
│   ├── editor/       # EditorShell, EditTab, DesignPanel, PreviewTab, forms/
│   ├── templates/     # HTML/CSS live-preview templates (5)
│   ├── ats/            # AtsScorePanel, AtsFixReviewPanel
│   ├── ai/              # AiSuggestButton
│   ├── coverletter/      # CoverLetterPanel
│   ├── applications/      # ApplicationsView, Board, Table, Filters, ActivityLog, ColumnForm
│   └── ui/                  # AppNavbar, PlasmaBackground, Toaster, UserProfileButton
├── lib/
│   ├── ai/             # pipeline.ts, ats-fix-pipeline.ts, cover-letter-pipeline.ts, hallucination-guard.ts, models.ts
│   ├── ats/             # scorer.ts, keywords.ts
│   ├── applications/     # cells.ts, filter.ts, order.ts, sort.ts, types.ts
│   ├── docx/               # resume-docx.ts
│   ├── pdf/templates/       # 6 @react-pdf/renderer templates incl. AtsPdfTemplate
│   ├── schemas/               # resume.zod.ts, application.zod.ts — single source of truth
│   ├── stores/                  # resume-editor.store.ts, toast.store.ts (Zustand)
│   ├── upload/                    # parse-file.ts, extract-resume.ts
│   └── rate-limit.ts, export-mode.ts, preview-pagination.ts, mongodb.ts, auth.ts, db.ts
├── models/                # Mongoose models: Resume.ts, Application.ts, ApplicationActivity.ts, BoardConfig.ts
└── docs/superpowers/       # sprint-by-sprint specs/ and plans/ — git-ignored, local only
```

## Contributing conventions (from README)

This repo follows a sprint-based workflow: each feature sprint has a design spec (`docs/superpowers/specs/`) and implementation plan (`docs/superpowers/plans/`) before merge. These live on disk but are git-ignored, so they are visible while working locally and never pushed. When adding a feature:

1. Extend the relevant Zod schema first (`lib/schemas/`) — it drives both runtime validation and inferred TS types.
2. Keep the `data` tree and `meta`/design tree decoupled — never let template concerns leak into `ResumeData`.
3. New AI-generated content must pass through the hallucination guard.
4. Multi-column PDF/DOCX layouts must preserve linear reading order for ATS parsers — verify with the `ats` export mode.
5. Add/update tests alongside the change; `npm run test:run` should stay green.
