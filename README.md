# CV Builder - AI-Driven Resume, Cover Letter & Job-Application Platform

> **Build resumes that beat ATS parsers and impress humans - then track every application from a spreadsheet-style board, or let the platform find and pre-tailor new matches for you automatically.**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)
![Vitest](https://img.shields.io/badge/tests-196%20suites-brightgreen?logo=vitest)
![Vercel](https://img.shields.io/badge/deployed-Vercel-black?logo=vercel)
![License](https://img.shields.io/badge/license-MIT-green)

**Live:** [cv-builder-indol-zeta.vercel.app](https://cv-builder-indol-zeta.vercel.app)

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [CV Templates & Export Modes](#cv-templates--export-modes)
6. [AI Copilot - Generate → Critique → Refine](#ai-copilot---generate--critique--refine)
7. [ATS Scoring & Auto-Fix](#ats-scoring--auto-fix)
8. [Application Tracking Supertable](#application-tracking-supertable)
9. [Job Search Automation](#job-search-automation)
10. [Data Model](#data-model)
11. [Directory Layout](#directory-layout)
12. [Getting Started](#getting-started)
13. [Environment Variables](#environment-variables)
14. [API Reference](#api-reference)
15. [Testing](#testing)
16. [Deployment](#deployment)
17. [Contributing](#contributing)
18. [License](#license)

---

## Overview

CV Builder is a full-stack, AI-assisted resume platform for job seekers who need their CVs to pass Applicant Tracking System (ATS) filters **and** look polished to human eyes - and who then need somewhere to track every application they send out, or a way to have new matching openings found and pre-tailored for them. Career data is authored once against the [JSON Resume v1.0.0](https://jsonresume.org/schema/) standard, decoupled from a separate design/meta tree, so switching templates never touches the underlying facts.

Key differentiators:

- **Dual-track, dual-mode export** - a *Designed* PDF (one of five visual templates, or DOCX via native paragraph styles) for humans, and a plain-text *ATS-safe* PDF mode for parsers, selected per export.
- **Generate → Critique → Refine AI pipeline** - every AI draft (bullet points, summaries, ATS rewrites, cover letters) is critiqued by a second pass before it reaches the user, and any invented number or skill is flagged for explicit approval.
- **Real-time ATS scoring with one-click auto-fix** - paste a job description, get a 0-100 score across four vectors, then let AI rewrite the weak sections directly against the missing keywords.
- **AI-generated, hallucination-guarded cover letters**, tailored to a job description and generated from the same resume facts.
- **A job-application tracking supertable** - an Airtable/Notion-style grid with a Kanban board view, custom columns, multi-column sort, filters, drag-and-drop, and a per-row activity log - to manage every resume version you send out and where it stands.
- **Job Search Automation** - define a search profile and rule set once, and a daily scan finds new openings, scores them against your resume, and (within daily spend caps) drafts a tailored resume and cover letter ready for review.
- **Live preview** - the editor renders a paginated HTML/CSS mirror of the document on every keystroke via a debounced Zustand store; the actual PDF/DOCX binary is only compiled on export.

---

## Features

### Editor
- Section-based accordion editor covering all JSON Resume sections: Basics, Work, Education, Skills, Certificates, Awards, Publications, Volunteer, Languages, Interests, Projects, plus unlimited custom sections with per-field type configuration.
- Drag-and-drop section reordering via `@dnd-kit`.
- Rich text formatting (bold, italic, underline) in bullet/summary fields.
- Blank-line paragraph breaks in bullet/summary text render as visually distinct paragraphs consistently across live preview, PDF, and DOCX export.
- Undo/redo, dirty-state tracking, `beforeunload` guard against losing unsaved work, and per-field validation errors.
- Full keyboard and screen-reader accessibility pass on the editor shell.
- Mobile-responsive editor shell and navbar.

### Templates & Design
- Five ATS-safe visual templates: **Classic**, **Modern**, **Minimal**, **Executive**, **Sidebar** - plus a sixth, text-only **ATS** template used exclusively for ATS-safe export.
- Per-document design controls: font family, header font, primary/accent color (with a preset palette), page margins (0.5-1.5 in, hard floor enforced), line spacing (1.0-1.15).
- Single-column and two-column layouts; column assignment is drag-and-drop per section.
- Paginated live preview with zoom controls (fit / percentage / manual).
- Template switching never loses or corrupts career data - the design tree is fully decoupled from the data tree.

### AI Copilot
- One-click bullet-point writer from rough notes, and a professional summary generator - each run through the Generate → Critique → Refine pipeline.
- **ATS Fix**: analyzes the score gap against a job description and proposes targeted rewrites (or a brand-new summary) that weave in missing keywords, shown in a before/after review panel.
- **Cover letter generator**: drafts a 3-paragraph letter tailored to a job description, using only facts already present in the resume.
- Hallucination guard: any metric or skill in AI output not traceable to the user's original input is highlighted for explicit approval before it's committed to the schema.
- Per-user rate limiting on all AI and upload endpoints.

### ATS Optimizer
- Paste any job description → instant 0-100 ATS score.
- Breakdown across four vectors: Format & Structure (25 pts), Keyword Density (35 pts), Strategic Keyword Placement in summary/recent titles (25 pts), Metric & Outcome Presence (15 pts).
- Matched keywords shown as chips; missing keywords flagged with a fix action. Keywords can be explicitly excluded from scoring without disappearing from the UI.

### Export
- **PDF (Designed)** - via `@react-pdf/renderer`, one of five visual templates, semantic tags, decorative elements marked as artifacts.
- **PDF (ATS-safe)** - a dedicated single-column, plain-text template that guarantees linear reading order for parsers.
- **DOCX** - via the `docx` package; native paragraph styles only (no text boxes, floating objects, or nested tables); web fonts mapped to ATS-safe system fonts (e.g. Lato → Arial).

### Upload & Parse
- Upload an existing PDF or DOCX resume; it's parsed and auto-extracted into the JSON Resume schema.

### Application Tracking
- A spreadsheet-style **supertable** of every job application, with a **Table view** and a **Kanban board view** (drag cards between status lanes).
- Built-in columns (Company, Role, Status, Resume, Applied date) plus unlimited custom columns (text, number, date, url, select, status, checkbox), each with editable options and colors.
- Inline-editable cells, row and column drag-and-drop reordering, multi-column sort, and a client-side filter bar with per-column-type filter editors.
- Every change is diffed and written to a per-row activity log, viewable in a popover.
- Quick-add entry points from the dashboard and from individual resume cards; duplicating a resume links the new version and resets its application status.

### Job Search Automation
- Define one or more **search profiles**: target roles, work mode, locations, seniority, categories, industries, posting recency, and a minimum ATS-score threshold, each optionally tied to a specific resume.
- Build **rules** per profile (or shared across all of them) that match on ATS score, company, work mode, posting age, or title, and resolve to `notify`, `draft_and_queue`, or `ignore`.
- A daily scan (Vercel Cron → QStash → per-profile worker) searches active job boards, scores every new posting against the linked resume, and evaluates it against the profile's rules.
- Postings resolved to `draft_and_queue` run through the same tailor → cover-letter → hallucination-guard → re-score pipeline used elsewhere, subject to daily per-profile and per-user drafting caps, so spend never runs away.
- A **review queue** surfaces drafted matches for approval, rejection, or one-click conversion into a tracked application; matches resolved to `notify` only appear in an in-app notification feed.

### Auth
- GitHub OAuth and Google OAuth via Auth.js v5, backed by the MongoDB adapter.
- Session-scoped resume and application library - each user owns their own data.
- Cross-provider account linking - signing in with GitHub or Google resolves to the *same* account when the verified email matches, so a user is never split across two identities.

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
| Job Queue | Upstash QStash (`@upstash/qstash`) | 2.11.x |
| PDF / DOCX Parsing | pdf-parse, mammoth | latest |
| WebGL Effects | OGL | 1.x |
| Drag & Drop | @dnd-kit (core, sortable, utilities) | 6.x / 10.x |
| Testing | Vitest + @testing-library/react + jsdom | 4.x |

> **Note:** the original PRD scoped a multi-model AI router (Claude / GPT-4o / Groq). The implementation consolidated on a single model - **Claude Haiku 4.5** - for every AI feature (suggestions, ATS fix, cover letters, job-search tailoring); there is no OpenAI or Groq dependency in the codebase today.

---

## Architecture

### Two-Tree Document Model

Every resume in the database is stored as two decoupled trees, plus lightweight application-tracking fields on the parent document:

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

The visual layer is a **consumer** of `data`. Template switching updates `meta` only and never touches `data`. This is the core architectural invariant. Job-specific tracking (company/role/status) lives alongside - but structurally separate from - career facts, so tailoring a resume for one application never contaminates another.

### State Flow

```
User keystroke
     |
     v
useResumeEditorStore (Zustand)
     |
     +--> immediate update to data/meta trees (isDirty = true)
     |
     +--> debounced, paginated HTML live-preview re-render
     |          (CSS mirror, no PDF compilation)
     |
     +--> auto-save PATCH /api/resumes/:id  (debounced)

On explicit Export:
     +--> POST /api/resumes/:id/export/pdf   { mode: 'designed' | 'ats' }
     +--> POST /api/resumes/:id/export/docx
```

The PDF binary is **never** compiled on keystroke - `@react-pdf/renderer` only runs on export routes and on the server-side preview-pagination endpoint (rate-limited separately from AI calls).

### Application Tracking Data Model

Applications live in their own collection, decoupled from resumes so the board's columns/sort/filters are user-level configuration rather than per-resume state:

```
Application        { userId, company, role, status, resumeId, customFields{...} }
ApplicationActivity { applicationId, field, oldValue, newValue, changedAt }  // diff-and-log audit trail
BoardConfig         { userId, columns: BoardColumn[], sort: SortEntry[] }     // one per user
```

`BoardColumn` supports built-in fields (`company`, `role`, `status`, `resumeId`, `createdAt` - reorderable but not deletable) alongside unlimited custom columns of type `text | number | date | url | select | status | checkbox`, each with its own `order`, optional `width`, and (for `select`/`status`) user-defined colored options.

### Job Search Scan Pipeline

```
Vercel Cron (daily, vercel.json)
     |
     v
GET /api/jobsearch/scan/cron          -- Bearer $CRON_SECRET, lists every active profile
     |
     v
publishScanJob() per profile  --------> Upstash QStash
                                              |
                                              v
                          POST /api/jobsearch/scan/worker  -- signature-verified via
                                              |               QSTASH_CURRENT/NEXT_SIGNING_KEY
                                              v
                                   runScanForProfile(userId, profileId)
                                              |
              +-------------------------------+-------------------------------+
              v                               v                               v
   fetch postings (freehire)      score + rule-match each posting     drain prior backlog
   dedupe against stored jobs     resolve: notify | draft_and_queue |   (draft_and_queue items
   prune stale 'new' postings     ignore                              still capped from last run)
                                              |
                                   draft_and_queue AND caps have room?
                                              |
                                              v
                              runApplyPipeline(): ATS-fix tailor -> cover letter ->
                              hallucination guard -> re-score -> persist draft Resume
                                              |
                                   pendingApprovals empty AND score >= threshold?
                                        yes -> status 'queued'    no -> status 'needs_review'
```

A manual "Scan now" action (`POST /api/jobsearch/scan`) runs `runScanForProfile()` synchronously for one profile, bypassing the QStash hop entirely - only the scheduled cron path needs the queue, to stay under a single cron invocation's duration limit while fanning out across every user's active profiles.

### Directory Layout

```
cv-builder/
├── app/
│   ├── (auth)/signin/                       # GitHub / Google sign-in page
│   ├── (dashboard)/
│   │   ├── dashboard/                       # Resume library
│   │   ├── dashboard/applications/          # Application supertable (table + board views)
│   │   ├── dashboard/resumes/[id]/          # Full editor page
│   │   └── dashboard/jobsearch/             # Profiles list, profile detail/scan page, notifications feed
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
│   │   ├── jobsearch/profiles/              # Search-profile CRUD
│   │   ├── jobsearch/rules/                 # Rule CRUD (per profile or shared)
│   │   ├── jobsearch/scan/                  # Manual scan (sync) + cron fan-out + QStash worker
│   │   ├── jobsearch/scraped-jobs/          # List, approve, convert-to-application, delete
│   │   ├── jobsearch/notifications/         # notify-only matches feed, unread count, mark-read
│   │   └── preview/pagination/              # Server-side paginated preview render
│   └── page.tsx                             # Landing / marketing page
├── components/
│   ├── editor/                              # EditorShell, EditTab, DesignPanel, PreviewTab, forms/
│   ├── templates/                           # HTML/CSS live-preview templates (5 templates) + RichText
│   ├── ats/                                 # AtsScorePanel, AtsFixReviewPanel
│   ├── ai/                                  # AiSuggestButton
│   ├── coverletter/                         # CoverLetterPanel
│   ├── applications/                        # ApplicationsView, Board, Table, Filters, ActivityLog, ColumnForm
│   ├── jobsearch/                           # ProfileWizard, ProfileSettings, RuleBuilder, ScrapedJobsList, QueuedApplicationsPanel, JobMatchesFeed
│   └── ui/                                  # AppNavbar, PlasmaBackground, Toaster, UserProfileButton
├── lib/
│   ├── ai/                                  # pipeline.ts, ats-fix-pipeline.ts, cover-letter-pipeline.ts, hallucination-guard.ts, models.ts
│   ├── api/                                 # Shared route handler logic: resumes.ts, applications.ts, board-config.ts, jobsearch-profiles.ts, jobsearch-rules.ts, scraped-jobs.ts, route-errors.ts
│   ├── ats/                                 # scorer.ts, keywords.ts
│   ├── applications/                        # cells.ts, filter.ts, order.ts, sort.ts, types.ts
│   ├── jobsearch/                           # scan.ts, apply.ts, rules.ts, queue.ts, countries.ts, sources/ (freehire.ts)
│   ├── design/                               # tokens.ts - shared design-panel constants
│   ├── docx/                                # resume-docx.ts, styles.ts
│   ├── fonts/                                # families.ts, registry.ts - web-font → ATS-safe system font mapping
│   ├── hooks/                                # use-debounce.ts, use-media-query.ts, use-pdf-pagination.ts
│   ├── pdf/                                  # extract-pagination.ts, select-template.ts, templates/ (6 @react-pdf/renderer templates incl. AtsPdfTemplate)
│   ├── schemas/                             # resume.zod.ts, application.zod.ts, jobsearch.zod.ts
│   ├── stores/                              # resume-editor.store.ts, toast.store.ts (Zustand)
│   ├── upload/                              # parse-file.ts, extract-resume.ts
│   ├── rate-limit.ts                        # In-memory token-bucket limiter (AI / upload / preview)
│   ├── export-mode.ts                       # 'ats' | 'designed' export mode parsing
│   ├── rich-text.ts                         # Bold/italic/underline markers + blank-line paragraph splitting
│   ├── preview-pagination.ts, preview-anchor.ts
│   └── mongodb.ts, auth.ts, db.ts, sections.ts, text-diff.ts, format-date.ts, ...
├── models/                                  # Resume.ts, Application.ts, ApplicationActivity.ts, BoardConfig.ts, JobSearchProfile.ts, JobSearchRule.ts, ScrapedJob.ts
├── vercel.json                              # Vercel Cron schedule for the job-search scan
└── types/                                   # Global TypeScript types
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

- **`designed`** (default) - renders the resume's assigned visual template, styled per its Design tab settings.
- **`ats`** - ignores the visual template entirely and renders the dedicated `AtsPdfTemplate`: strictly linear reading order, no columns, no decorative elements, built for maximum ATS parser compatibility.

DOCX export always uses native paragraph styling regardless of mode, since Word documents are inherently more parser-friendly than PDFs.

---

## AI Copilot - Generate → Critique → Refine

Every AI-authored piece of content - bullet points, summaries, ATS-targeted rewrites, cover letters, and job-search draft resumes - runs through the same three-step chain, all on **Claude Haiku 4.5**:

1. **Generate** - drafts content from the user's rough notes (or, for ATS Fix, from the gap between the resume and a job description).
2. **Critique** - a second pass checks the draft against the original input: is every number/percentage traceable to source text? Does it start with a strong action verb? Is the tone professional?
3. **Refine** - applies the critique's corrections and returns the final text.

**Hallucination guard:** independent of the critique step, `detectHallucinations()` compares the final output's numeric claims and skill/technology terms against the user's original text. Anything not found in the source is returned as a `pendingApprovals` list and surfaced in the UI - nothing is silently written to the JSON schema without the user explicitly accepting it. Job-search draft resumes carry the same `pendingApprovals` list through to the review queue.

All AI endpoints are rate-limited to 10 requests/minute per user.

---

## ATS Scoring & Auto-Fix

`scoreResume()` computes a 0-100 score across four vectors:

| Vector | Max points | What it measures |
|---|---|---|
| Format & Structure | 25 | Required fields present, summary length, complete work entries, well-formed highlights, structured skills |
| Keyword Density | 35 | Literal (non-semantic) overlap between the job description and the full resume text |
| Strategic Keyword Placement | 25 | Overlap weighted toward the summary and most recent job titles |
| Metric & Outcome Presence | 15 | Share of bullet points containing a number, percentage, dollar amount, or multiplier |

Keywords can be explicitly excluded from a specific job description's scoring - excluded terms still render as muted chips in the UI rather than disappearing, so the exclusion stays visible and reversible.

**ATS Fix** takes the missing-keyword list and asks the AI pipeline to rewrite the weakest section (or draft a summary from scratch if none exists), producing a diffable before/after suggestion - reviewed through the same hallucination guard before it can be applied. The same scorer and fix pipeline power the job-search scan's threshold filter and semi-auto tailoring.

---

## Application Tracking Supertable

A dedicated `/dashboard/applications` view for managing every job application, independent of resume editing:

- **Table view** - inline-editable grid, click-to-sort headers (shift-click for multi-column sort), row/column drag-and-drop with fractional-index reordering, and a filter bar with a type-aware editor per column (text contains, number range, date range, select/status membership, checkbox).
- **Board view** - the same data as Kanban lanes by status, with drag-and-drop status changes.
- **Custom columns** - add, edit, or delete columns of type text, number, date, url, select, status, or checkbox; select/status columns get user-defined, colored options. Built-in columns (Company, Role, Status, Resume, Applied) can be reordered but not deleted.
- **Activity log** - every field change is diffed and appended to an audit trail, viewable per row in a popover.
- **Entry points** - quick-add from the applications toolbar, directly from the dashboard/resume cards (which pre-fills the linked resume), or by converting an approved job-search match into an application row.

---

## Job Search Automation

A dedicated `/dashboard/jobsearch` area that finds and pre-qualifies new openings instead of requiring the user to search manually.

### Profiles
Each **search profile** (`JobSearchProfile`) captures what "a good match" means for one line of search: target roles, work modes, locations (country/region/city), seniority levels, categories, industries, how recent a posting must be, a minimum ATS-score threshold, and an optional linked resume to score and tailor against. Profiles are created and edited through a multi-step wizard and can be toggled active/inactive without deleting them.

### Rules
**Rules** (`JobSearchRule`) sit on top of a profile's baseline filters and resolve every matching posting to one of three actions:

| Action | Effect |
|---|---|
| `notify` | Surfaced in the in-app notification feed; no draft is created. |
| `draft_and_queue` | Runs the semi-auto apply pipeline to produce a tailored draft resume and cover letter. |
| `ignore` | The posting is suppressed outright and never stored, even as a dismissed row. |

Conditions match on ATS score, company (in/not-in a list), work mode, posting age, or title (contains/not-contains). A rule can be scoped to one profile or left unscoped to apply across all of a user's profiles. If any matched rule resolves to `ignore`, that verdict wins outright regardless of what else matched.

### Scan pipeline
A **Vercel Cron** job runs daily and calls `GET /api/jobsearch/scan/cron`, which fans every active profile out as a job on **Upstash QStash**; each profile is then processed independently by the signature-verified `POST /api/jobsearch/scan/worker` route. This keeps one scheduled invocation from ever hitting a duration limit while scanning many users' profiles. A **manual "Scan now"** button runs the same scan logic synchronously for a single profile, bypassing the queue.

For each profile, a scan:
1. Prunes previously stored, still-unreviewed postings that no longer match the profile's current preferences.
2. Drains any backlog of `draft_and_queue` matches left over from a prior capped run, if today's caps still have room.
3. Queries the job source (currently [freehire.me](https://freehire.me)) once per target role to keep results relevant, merges and deduplicates the results, and drops anything already stored.
4. Scores each new posting against the linked resume, drops anything below the profile's threshold, then evaluates it against the profile's rules.
5. For `draft_and_queue` matches, runs the apply pipeline (below) if daily caps allow; otherwise leaves the match queued as backlog for the next scan.

### Semi-auto apply pipeline
For a posting resolved to `draft_and_queue`, `runApplyPipeline()` reuses the same building blocks as the manual AI Copilot:

1. **ATS Fix** rewrites the resume against the posting's missing keywords.
2. **Cover letter generation** drafts a letter tailored to the posting.
3. **Hallucination guard** flags any unverifiable claim across both.
4. The tailored resume is **re-scored** against the posting.
5. A new draft `Resume` is persisted (linked back to its source resume, title reading `"<role> at <company> (tailored)"`), and the `ScrapedJob` is updated with the draft's id, its post-tailor score, and any pending approvals.

A match reaches status `queued` only if it has **zero** pending approvals **and** its post-tailor score meets the profile's threshold; otherwise it lands in `needs_review` for the user to resolve by hand. Two rolling 24-hour caps bound total AI spend: **3 drafts per profile** and **10 drafts per user** across all profiles.

### Review queue and notifications
- The **scraped jobs list** on each profile's page shows every match with its status, score, and matched rules, with actions to dismiss or delete a listing.
- The **queued applications panel** surfaces `queued` and `needs_review` drafts; a `needs_review` item can be approved (once its pending approvals are resolved) or rejected, and any `queued` item can be converted directly into a tracked `Application` row with one click.
- Matches resolved to `notify` never generate a draft; they appear in a dedicated **notifications feed** with an unread-count badge and a mark-as-read action.

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
  pageMargins: number          // 0.5-1.5, hard floor at 0.5
  lineSpacing: number           // 1.0-1.15
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

interface JobSearchProfile {
  userId: string
  name: string
  resumeId?: string
  roles: string[]
  workModes: ('remote' | 'hybrid' | 'onsite')[]
  locations: { country?: string; region?: string; city?: string }[]
  seniority: string[]
  categories: string[]
  industries: string[]
  recencyDays: number            // default 14
  minAtsScore: number             // default 75
  isActive: boolean
}

interface JobSearchRule {
  userId: string
  profileId: string | null       // null = applies to every profile this user has
  name: string
  isActive: boolean
  order: number
  conditions: RuleCondition[]     // discriminated union: atsScore | company | workMode | postedWithinDays | title
  action: 'notify' | 'draft_and_queue' | 'ignore'
}

interface ScrapedJob {
  userId: string
  profileId: string
  source: 'freehire'
  sourceId: string
  title: string
  company: string
  url: string
  description: string
  atsScore?: number
  matchedRules: string[]
  resolvedActions: ('notify' | 'draft_and_queue')[]
  draftResumeId?: string
  postTailorScore?: number
  pendingApprovals: string[]
  tailoredKeywords: string[]
  draftedAt?: Date
  status: 'new' | 'notified' | 'queued' | 'needs_review' | 'submitted' | 'dismissed' | 'expired'
}
```

All schemas are defined once in Zod (`lib/schemas/resume.zod.ts`, `lib/schemas/application.zod.ts`, `lib/schemas/jobsearch.zod.ts`) and TypeScript types are inferred from them - there is no separate hand-written type layer to drift out of sync.

---

## Getting Started

```bash
# Install dependencies
cd cv-builder
npm install

# Configure environment
cp .env.local.example .env.local
# then fill in MongoDB, Auth.js, OAuth, Anthropic, and (optionally) QStash credentials - see below

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build      # production build
npm run start      # run production build
npm run lint       # ESLint
npx tsc --noEmit   # type check
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
| `ANTHROPIC_API_KEY` | Powers all AI Copilot features (suggestions, ATS Fix, cover letters, upload extraction, job-search tailoring) - Claude Haiku 4.5 |
| `QSTASH_TOKEN` | Upstash QStash publish token, used to fan out the daily job-search scan |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | Verify that scan-worker callbacks genuinely came from QStash |
| `QSTASH_URL` | Only needed if your QStash instance is not the default EU region |
| `CRON_SECRET` | Bearer token Vercel Cron sends when calling the scan fan-out route (`openssl rand -base64 32`) |
| `APP_URL` | This app's own canonical base URL, so the QStash publish call knows where to send the worker callback |

In production one additional variable is set on the hosting platform - see [Deployment](#deployment):

| Variable | Purpose |
|---|---|
| `AUTH_URL` | Canonical production origin (e.g. `https://your-app.vercel.app`). Optional on Vercel, which infers the host, but pinning it keeps OAuth callback URLs stable across deployments. |

---

## API Reference

All routes below are session-authenticated via Auth.js (`auth()` wrapper) and scoped to the requesting user, except the cron and QStash worker routes noted otherwise.

### Resumes
| Method | Route | Purpose |
|---|---|---|
| `GET` / `POST` | `/api/resumes` | List / create resumes |
| `GET` / `PATCH` / `DELETE` | `/api/resumes/:id` | Read / update / delete a resume |
| `POST` | `/api/resumes/:id/duplicate` | Fork a resume; links version, resets application status |
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

### Job Search
| Method | Route | Purpose |
|---|---|---|
| `GET` / `POST` | `/api/jobsearch/profiles` | List / create search profiles |
| `GET` / `PATCH` / `DELETE` | `/api/jobsearch/profiles/:id` | Read / update / delete a profile |
| `GET` / `POST` | `/api/jobsearch/rules` | List / create rules |
| `GET` / `PATCH` / `DELETE` | `/api/jobsearch/rules/:id` | Read / update / delete a rule |
| `POST` | `/api/jobsearch/scan` | Run a synchronous scan for one profile ("Scan now") |
| `GET` | `/api/jobsearch/scan/cron` | Vercel Cron target - Bearer `CRON_SECRET`, fans every active profile out to QStash |
| `POST` | `/api/jobsearch/scan/worker` | QStash callback target - signature-verified, runs the scan for one profile |
| `GET` | `/api/jobsearch/scraped-jobs` | List scraped jobs for a profile |
| `PATCH` / `DELETE` | `/api/jobsearch/scraped-jobs/:id` | Update (dismiss/undismiss) / delete a scraped job |
| `POST` | `/api/jobsearch/scraped-jobs/:id/approve` | Approve a `needs_review` match once pending approvals are resolved |
| `POST` | `/api/jobsearch/scraped-jobs/:id/convert` | Convert a `queued` match into a tracked application |
| `GET` | `/api/jobsearch/notifications` | List `notify`-resolved matches |
| `GET` | `/api/jobsearch/notifications/unread-count` | Unread notification count for the badge |
| `POST` | `/api/jobsearch/notifications/mark-read` | Mark all notifications as read |

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

The project has **196 Vitest test suites (1,861 tests)** covering schemas, API routes, AI pipelines (including hallucination detection), the ATS scorer, DOCX/PDF template rendering, pagination math, the application-tracking sort/filter/order logic, the job-search scan/rules/apply pipeline, and editor components, run via `@testing-library/react` + `jsdom`.

```bash
npm run test        # watch mode
npm run test:run    # single run, CI-friendly
```

---

## Deployment

The app is deployed on **Vercel**, built from this repository's `main` branch - every push triggers an automatic deployment.

**Live:** [cv-builder-indol-zeta.vercel.app](https://cv-builder-indol-zeta.vercel.app)

### Project settings

The Next.js app lives in the `cv-builder/` subdirectory rather than the repository root, so the **Root Directory** must be set accordingly - otherwise the build runs in the wrong context and fails to detect the framework.

| Setting | Value |
|---|---|
| Root Directory | `cv-builder` |
| Framework Preset | Next.js (auto-detected) |
| Build / Install / Output | Platform defaults |
| Production branch | `main` |

### Production environment variables

Every variable from [Environment Variables](#environment-variables) must be configured in the Vercel project, plus `AUTH_URL`. Variables are read at **build time**, so adding or changing one requires a redeploy before it takes effect.

### OAuth callback URLs

Each provider must explicitly allow the production callback, or sign-in fails *after* the user authorizes - the provider rejects the `redirect_uri` it was handed:

| Provider | Authorized callback URL |
|---|---|
| GitHub | `https://your-app.vercel.app/api/auth/callback/github` |
| Google | `https://your-app.vercel.app/api/auth/callback/google` |

**A GitHub OAuth app accepts only one callback URL**, so production and local development need **two separate GitHub OAuth apps**: production credentials live in the Vercel environment, local credentials in `.env.local` pointing at `http://localhost:3000/api/auth/callback/github`. Google permits multiple redirect URIs, so a single Google app can serve both environments.

### Cross-provider account linking

A sign-in that fails with `OAuthAccountNotLinked` - *after* the provider has been authorized - is an account-linking issue, not a callback one. Auth.js refuses by default to attach a second provider to an existing user with the same email, since providers returning unverified emails would make that an account-takeover vector.

Both providers therefore set `allowDangerousEmailAccountLinking: true` in `auth.config.ts`. GitHub and Google both verify email ownership, so matching on email is safe here, and a user who first signed up with Google can subsequently sign in with GitHub and reach the same account rather than being blocked.

### MongoDB Atlas network access

Vercel's serverless functions use dynamic outbound IPs, so there is no fixed address to allowlist; Atlas **Network Access** must permit `0.0.0.0/0`. (Dedicated egress IPs require Vercel's Enterprise Secure Compute tier.) Security therefore rests on credentials rather than network origin:

- Scope the database user to `readWrite` on this database only - not `atlasAdmin`.
- Keep `MONGODB_URI` in environment variables, never committed to the repository.
- TLS is enforced by the `mongodb+srv://` connection string.

### Job search scan schedule

`vercel.json` at the repository's `cv-builder/` root defines the cron schedule (`30 8 * * *`, run daily at 08:30 UTC) that triggers `GET /api/jobsearch/scan/cron`. This requires `CRON_SECRET`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, and `QSTASH_NEXT_SIGNING_KEY` to be set in the Vercel project, and a QStash instance created in the [Upstash console](https://console.upstash.com/qstash). If the project has Vercel Deployment Protection enabled, a "Protection Bypass for Automation" secret must also exist so QStash's own callback isn't redirected to a login page.

---

## Contributing

This repository follows a sprint-based workflow - each feature sprint has a design spec and an implementation plan written and reviewed before merge. Those specs and plans are kept internally and are not published in this repository. When adding a feature:

1. Extend the relevant Zod schema first (`lib/schemas/`) - it is the single source of truth for both runtime validation and TypeScript types.
2. Keep the data tree and design/meta tree decoupled; never let a visual/template concern reach into `ResumeData`.
3. Any new AI-generated content must pass through the hallucination guard before being committed.
4. Multi-column PDF/DOCX layouts must preserve linear reading order for ATS parsers - verify with the `ats` export mode.
5. Add or update tests alongside the change; `npm run test:run` should stay green.

---

## License

MIT (c) [IdanAr](https://github.com/IdanAr) - see [LICENSE](LICENSE).
