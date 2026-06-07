# CV Builder — Phase 1: Foundation Design Spec

**Date:** 2026-06-02
**Scope:** Phase 1 only — project scaffold, data layer, auth, CRUD API, dashboard UI
**Out of scope:** Visual editor, PDF/DOCX export, AI agents, ATS scoring (Phases 2–4)

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Database | MongoDB Atlas (free tier) via Mongoose |
| Schema validation | Zod — single source of types; Mongoose schemas derive from Zod |
| Auth | NextAuth.js v5 (Auth.js) — Google + GitHub OAuth, `@auth/mongoose-adapter` |
| API style | REST route handlers under `app/api/` |

---

## 2. Project Structure

```
cv-builder/
├── app/
│   ├── (auth)/
│   │   └── signin/page.tsx
│   ├── (dashboard)/
│   │   └── dashboard/
│   │       ├── page.tsx              ← CV list
│   │       └── resumes/[id]/page.tsx ← placeholder (editor in Phase 2)
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   └── resumes/
│   │       ├── route.ts              ← GET list, POST create
│   │       └── [id]/
│   │           ├── route.ts          ← GET, PATCH, DELETE
│   │           └── duplicate/route.ts ← POST duplicate
│   ├── layout.tsx
│   └── page.tsx                      ← redirects to /dashboard
├── lib/
│   ├── auth.ts                       ← NextAuth config + authOptions
│   ├── db.ts                         ← singleton MongoDB connection
│   └── schemas/
│       └── resume.zod.ts             ← Zod schema + inferred TS types
├── models/
│   ├── Resume.ts                     ← Mongoose model<ResumeDocument>
│   └── User.ts                       ← Mongoose model (NextAuth adapter)
└── middleware.ts                     ← protects /dashboard/* and /api/resumes/*
```

---

## 3. Data Models

### Resume document (`resumes` collection)

```ts
{
  _id: ObjectId,
  userId: ObjectId,        // ref: User — all queries scoped to this
  title: string,           // user-defined label, e.g. "Software Engineer — Google"
  createdAt: Date,         // Mongoose timestamps: true
  updatedAt: Date,

  data: {                  // JSON Resume v1.0.0 — never modified by design operations
    basics: {
      name, label, email, phone, url, summary,
      location: { city, region, countryCode, address, postalCode },
      profiles: [{ network, url, username }]
    },
    work:         [{ name, position, url, startDate, endDate, summary, highlights: string[] }],
    education:    [{ institution, area, studyType, startDate, endDate, score, courses }],
    skills:       [{ name, level, keywords: string[] }],
    certificates: [{ name, date, issuer, url }],
    awards:       [{ title, date, awarder, summary }],
    publications: [{ name, publisher, releaseDate, url, summary }],
    volunteer:    [{ organization, position, url, startDate, endDate, summary, highlights }],
    languages:    [{ language, fluency }],
    interests:    [{ name, keywords }],
    projects:     [{ name, description, highlights, keywords, startDate, endDate, url }]
  },

  meta: {                  // Design state — isolated from career data
    templateId:       string,                          // default: 'classic'
    fontFamily:       string,                          // default: 'Calibri'
    headerFontFamily: string,                          // default: 'Calibri'
    primaryColor:     string,                          // hex, default: '#000000'
    accentColor:      string,
    pageMargins:      number,                          // inches, 0.5–1.5, default: 1.0
    lineSpacing:      number,                          // 1.0–1.15, default: 1.15
    sectionOrder:     string[],                        // drag-and-drop order (Phase 2)
    layout:           'single-column' | 'two-column'   // default: 'single-column'
  }
}
```

`data` and `meta` always persist together in one document. Switching templates updates only `meta.templateId` — career data is never touched.

### User document (`users` collection)

Managed by `@auth/mongoose-adapter`. Fields: `name`, `email`, `image`, `emailVerified`. Associated `accounts` and `sessions` collections are created by the adapter automatically.

### Zod → TypeScript → Mongoose chain

`lib/schemas/resume.zod.ts` defines the Zod schema. TypeScript types are derived with `z.infer<>`. The Mongoose schema in `models/Resume.ts` uses those types as its generic — `mongoose.model<ResumeDocument>('Resume', schema)`. Validation happens only at the Zod layer, not inside Mongoose.

---

## 4. API Surface

All `/api/resumes/*` routes require a valid session. Unauthenticated requests are rejected by `middleware.ts` before the handler runs. Every query is scoped to `{ userId: session.user.id }` — users can never read or mutate another user's data.

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/resumes` | List all resumes for the authenticated user. Returns `sectionsFilledCount` (computed) per resume. |
| `POST` | `/api/resumes` | Create a new resume. Body validated by Zod. Returns the created document. |
| `GET` | `/api/resumes/[id]` | Fetch one resume. 404 if not found or owned by another user. |
| `PATCH` | `/api/resumes/[id]` | Partial update — accepts `{ data }`, `{ meta }`, or both. Deep-merges, never replaces. |
| `DELETE` | `/api/resumes/[id]` | Hard delete. Returns `{ success: true }`. |
| `POST` | `/api/resumes/[id]/duplicate` | Copies `data` + `meta`, sets title to `"Copy of [original]"`, returns new document. |

### Route handler pattern (every endpoint)

1. `auth()` from `lib/auth.ts` (Auth.js v5) → return 401 if no session
2. `ZodSchema.safeParse(body)` → return 400 with `{ error, code: "VALIDATION_ERROR", details }` if invalid
3. `await dbConnect()` → pooled singleton connection
4. Mongoose query scoped to `{ userId: session.user.id }`
5. `NextResponse.json(result)` or structured error

### Error response shape

```ts
{ error: string, code: "UNAUTHORIZED" | "NOT_FOUND" | "VALIDATION_ERROR" | "INTERNAL_ERROR", details?: ZodIssue[] }
```

### `sectionsFilledCount`

Computed inside `GET /api/resumes` (list endpoint). Counts top-level arrays in `data` where the array is non-empty (`work`, `education`, `skills`, `certificates`, `awards`, `publications`, `volunteer`, `languages`, `interests`, `projects`). Returned alongside each resume summary, never stored in MongoDB.

---

## 5. Auth

NextAuth.js v5 with `@auth/mongoose-adapter`. Providers: Google OAuth, GitHub OAuth. Config lives in `lib/auth.ts` and is exported as `authOptions`. The `[...nextauth]` route handler imports and forwards it.

`middleware.ts` re-exports `auth` from `lib/auth.ts` as the default middleware export (Auth.js v5 pattern: `export { auth as middleware } from "@/lib/auth"`). A `matcher` config guards all routes matching `/dashboard/:path*` and `/api/resumes/:path*`. The sign-in page lives at `/signin` (configured as `pages.signIn` in `lib/auth.ts`).

---

## 6. Dashboard UI

### Screen 1 — Sign-in (`/signin`)
Minimal centered layout: product name, "Continue with Google" button, "Continue with GitHub" button. Redirects to `/dashboard` on success.

### Screen 2 — Dashboard (`/dashboard`)
Header: "My CVs" + "New CV" button.

Each CV card shows:
- **Title** (user-defined) + **target role** (`data.basics.label`) as subtitle
- **Template name** (`meta.templateId`)
- Metadata row: Created date · Last edited (relative) · Sections filled · Layout · ATS Score (placeholder "—" until Phase 3)
- Action buttons: **Open** → `/dashboard/resumes/[id]` · **⬇ JSON** (download) · **⧉ Duplicate** · **✕** (delete with confirmation)

### JSON download
Client-side only — no new endpoint. Fetches `GET /api/resumes/[id]`, serializes `data` to a JSON Blob, triggers `<a download="[title].json">`. The download button becomes a format dropdown (JSON / PDF / DOCX) in Phase 2 once the export pipeline exists.

### `/dashboard/resumes/[id]`
Placeholder page in Phase 1 — displays the resume title and a "Editor coming in Phase 2" message. Full editor built in Phase 2.

---

## 7. Success Criteria

Phase 1 is complete when:

1. Sign in with Google or GitHub works; session persists across page refreshes
2. Creating a new CV stores a valid JSON Resume skeleton + default `meta` in MongoDB
3. List, fetch, patch, delete, and duplicate all work via REST with correct per-user scoping
4. Zod rejects invalid payloads with structured errors; valid data round-trips without loss
5. Unauthenticated requests to any `/dashboard/*` or `/api/resumes/*` route are blocked at middleware
6. Dashboard shows CV cards with full metadata row; JSON download and duplicate work end-to-end
7. `sectionsFilledCount` is accurate and returned by the list endpoint
