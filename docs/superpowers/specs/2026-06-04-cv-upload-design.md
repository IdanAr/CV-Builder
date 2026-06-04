# CV Upload Design Spec
**Date:** 2026-06-04
**Status:** Approved

## Goal

Let users upload an existing CV (PDF or DOCX) from the dashboard. The system parses the file server-side, sends the extracted text to Claude for structured extraction, and opens the pre-filled editor — no blank-slate required.

---

## User Flow

1. User clicks **"Upload CV"** on the My Resumes dashboard (alongside "New Resume").
2. Native file picker opens — accepts `.pdf` and `.docx`, max 5 MB.
3. User selects a file. A loading overlay replaces the button area.
4. **Phase 1** — "Reading your CV…" — file is sent to the parse endpoint; server extracts raw text.
5. **Phase 2** — "Extracting information…" — extracted text is sent to the extract endpoint; Claude structures it.
6. On success: browser redirects to `/editor/[resumeId]`. The editor opens with all found fields pre-filled. User edits normally.
7. On error: inline error message with "Try another file" and "Create manually" actions.

No separate review step. No hallucination guard. What is extracted goes straight into the editor.

---

## Architecture

### Two-step API pipeline

```
POST /api/resumes/upload/parse
  Request:  multipart/form-data { file: File }
  Validates: file present · MIME type PDF or DOCX · size ≤ 5 MB
  Returns:  { text: string }
  Errors:   FILE_TOO_LARGE (400) · UNSUPPORTED_FORMAT (400) · PARSE_FAILED (422)

POST /api/resumes/upload/extract
  Request:  application/json { text: string }   (non-empty, max 50 000 chars)
  Returns:  { resumeId: string }
  Errors:   EXTRACTION_FAILED (422) · INTERNAL_ERROR (500)
```

Both routes require authentication (same `auth()` wrapper as all other API routes).

The client holds the extracted text in a JavaScript variable between the two calls. Text is never persisted on the server between steps.

### Parsing libraries (server-side Node.js)

| Format | Library | Notes |
|--------|---------|-------|
| PDF | `pdf-parse` | Handles text-based PDFs; returns empty string for scanned/image-only PDFs |
| DOCX | `mammoth` | Extracts body text; ignores headers, footers, text boxes |

### AI extraction

Model: **Claude Haiku** (fast, cheap, adequate for structured extraction).

System prompt instructs Claude to:
- Return **only** a raw JSON object matching the JSON Resume v1.0.0 shape — no markdown fences, no explanation.
- Include only fields explicitly stated in the CV text.
- Format dates as `YYYY-MM` or `YYYY` strings.
- Omit sections entirely if absent (no empty arrays).

Response is parsed with `JSON.parse()`, then validated with the existing `ResumeDataSchema.safeParse()`. Because every schema field is `optional()`, partial extractions pass without errors — a CV with only basics + work experience is valid.

### Resume creation

Calls the existing `createResume(userId, { title, data, meta })` from `lib/api/resumes.ts`. No new DB layer needed.

**Auto-title:** `"${basics.name}'s CV"` if a name was extracted, otherwise `"Uploaded CV — ${YYYY-MM-DD}"`. User can rename in the editor.

---

## File Map

| File | Change |
|------|--------|
| `lib/upload/parse-file.ts` | New — pure function: `(buffer: Buffer, mimeType: string) => Promise<string>`. Uses `pdf-parse` or `mammoth` based on MIME type. Throws `ParseError` if output is empty. |
| `lib/upload/extract-resume.ts` | New — `(text: string) => Promise<ResumeData>`. Calls Claude Haiku, parses JSON, runs `ResumeDataSchema.safeParse()`. Throws `ExtractionError` on JSON parse failure. |
| `app/api/resumes/upload/parse/route.ts` | New — auth + file validation + `parseFile()` |
| `app/api/resumes/upload/extract/route.ts` | New — auth + text validation + `extractResume()` + `createResume()` |
| `components/dashboard/UploadCVButton.tsx` | New — client component: file input, two-phase fetch, loading states, error display, redirect |
| `app/(dashboard)/dashboard/page.tsx` | Modify — add `<UploadCVButton />` next to "New Resume" button |
| `lib/upload/__tests__/parse-file.test.ts` | New — unit tests for parse-file |
| `lib/upload/__tests__/extract-resume.test.ts` | New — unit tests for extract-resume (Claude mocked) |
| `app/api/resumes/upload/parse/route.test.ts` | New — API route tests |
| `app/api/resumes/upload/extract/route.test.ts` | New — API route tests |
| `components/dashboard/UploadCVButton.test.tsx` | New — component tests |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Scanned / image-only PDF | `pdf-parse` returns empty or near-empty string → `PARSE_FAILED` (422) with "scanned PDF" message to user |
| Password-protected PDF | `pdf-parse` throws → caught → `PARSE_FAILED` (422) |
| Wrong file type (e.g. `.txt`) | Client-side `accept` attribute blocks it; server also validates MIME type → `UNSUPPORTED_FORMAT` (400) |
| File > 5 MB | Rejected before parsing → `FILE_TOO_LARGE` (400) |
| CV text > 50 000 chars | Truncated to 50 000 before sending to Claude (real CVs never exceed this; guards against abuse) |
| Claude returns non-JSON | `JSON.parse()` throws → `EXTRACTION_FAILED` (422); user sees error with "Try another file" |
| Claude returns partial JSON | `ResumeDataSchema.safeParse()` passes (all fields optional) — partial data lands in editor |
| Unauthenticated request | 401 at route level, same as all other API routes |

---

## UI States

### Idle
"Upload CV" button (secondary style) to the left of "New Resume" (primary) in the dashboard header.

### Loading — Phase 1
Spinner + "Reading your CV…" + filename + step indicator (● ○).

### Loading — Phase 2
Spinner + "Extracting information…" + description + step indicator (● ●).

### Error
Red inline alert with specific message (scanned PDF, file too large, etc.) + "Try another file" button + "Create manually" fallback link.

---

## Testing

| File | Coverage |
|------|----------|
| `lib/upload/__tests__/parse-file.test.ts` | PDF buffer → non-empty text; DOCX buffer → non-empty text; empty output → throws `ParseError` |
| `lib/upload/__tests__/extract-resume.test.ts` | Valid JSON from Claude → `ResumeData`; malformed JSON → throws `ExtractionError`; partial JSON → passes Zod |
| `app/api/resumes/upload/parse/route.test.ts` | File too large → 400; wrong MIME → 400; unauthenticated → 401; valid PDF → 200 with `{ text }` |
| `app/api/resumes/upload/extract/route.test.ts` | Empty text → 400; unauthenticated → 401; valid text → 201 with `{ resumeId }` |
| `components/dashboard/UploadCVButton.test.tsx` | Renders button; shows "Reading your CV…" during phase 1; shows "Extracting information…" during phase 2; shows error message on API failure |

---

## What Does NOT Change

- JSON Resume schema — no new fields required
- `createResume()` in `lib/api/resumes.ts` — called unchanged
- Editor, preview, ATS, export — untouched
- Auth layer — same `auth()` wrapper

---

## Dependencies to Add

```json
"pdf-parse": "^1.1.1",
"mammoth": "^1.8.0"
```

And their types:

```json
"@types/pdf-parse": "^1.1.4"
```

(`mammoth` ships its own types.)
