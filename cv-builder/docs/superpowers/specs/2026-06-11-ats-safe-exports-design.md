# ATS-Safe Export Modes — Design

**Date:** 2026-06-11
**Status:** Approved pending user spec review

## Problem

PDF and DOCX exports fail ATS compatibility checks (Jobscan-style online checkers and
AI-based parsing review). The reported failures are parsing and structure failures, not
content failures. Root causes identified in the codebase:

1. **Multi-column layouts leak into export structure.**
   - `SidebarPdfTemplate` is always two-column (33% colored rail + main column rendered
     as a flexbox row). `ModernPdfTemplate`, `ClassicPdfTemplate`, and
     `ExecutivePdfTemplate` support a two-column mode the same way. ATS parsers that
     reconstruct reading order by Y-coordinate interleave the columns line by line,
     scrambling the extracted text.
   - The DOCX builder (`lib/docx/resume-docx.ts`) renders the Sidebar template and all
     two-column layouts with a borderless layout `Table` (one with a shaded rail cell).
     This violates the project rule "never use layout tables" (CLAUDE.md, DOCX Export
     Rules) and is the reason those DOCX files fail while single-column ones pass.
2. **PDFs are untagged and carry no metadata.** `@react-pdf/renderer` cannot emit tagged
   PDF structure (the CLAUDE.md semantic-tag rule is not implementable with this
   library), and the templates set no document title/author/language.
3. **Render-hostile details.** White text on colored backgrounds (Sidebar rail, Modern
   header), `justifyContent: space-between` rows for company/date pairs, sub-0.5in
   margins in the Sidebar PDF (`meta.pageMargins * 0.7` floored at 0.35in).

## Goals

- Every user can produce a PDF and a DOCX that pass extraction-based ATS checks for all
  five templates, regardless of the visual layout they chose.
- The existing visual ("Designed") exports remain available and unchanged in look.
- Parseability becomes a CI-enforced invariant, not a manual QA step.

## Non-Goals

- Tagged/accessible PDF output (impossible with `@react-pdf/renderer`; revisit only if
  the PDF library is ever replaced).
- Changing the on-screen live preview in any way.
- Wiring the ATS scorer (`lib/ats/scorer.ts`) into the export UI (follow-up item).

## Design

### 1. Two export modes

Each export endpoint accepts a mode:

- **`designed`** (default) — today's renderers, byte-for-byte the current behavior.
  Default keeps backward compatibility: requests without `mode` behave as before.
- **`ats`** — new single-column, parser-safe renderers over the same JSON Resume data.

API: `POST /api/resumes/[id]/export/pdf` and `/export/docx` take `{ mode?: 'ats' | 'designed' }`
in the JSON body (default `designed`).

UI: the export action in `EditorShell` (`components/editor/EditorShell.tsx:125`) becomes
a small chooser with two options per format:

- **Designed** — exact match of the preview (sidebar / two columns). May score lower in
  ATS scans.
- **ATS-optimized** — single-column, parser-safe structure. Same content, simplified
  layout.

The data tree is never transformed — both modes are pure renderers over the same
`ResumeData`, per the PRD principle that the visual layer is a consumer of JSON data.

### 2. ATS-safe PDF renderer

New `lib/pdf/templates/AtsPdfTemplate.tsx`, shared by all five templates and
parameterized by a small theme derived from `ResumeMeta` (mapped body/header fonts,
heading color). Rules:

- Single column, strict linear order: name → contact line → summary → sections in
  `sectionOrder`. Sidebar rail sections (skills, languages) fold back into their natural
  position in `sectionOrder`.
- Entry headers are single plain-text lines ("Acme Corp | Jan 2020 - Present"), not
  space-between flex rows.
- No backgrounds, no white or near-white text, no decorative borders. Dark text on white
  only. Headings may use the template's heading color.
- Typography constraints enforced: name 18–22pt, section headers 12–14pt, body 10–12pt,
  margins ≥ 0.5in (uses `meta.pageMargins`, never scaled below 0.5in), line spacing from
  `meta.lineSpacing` clamped to 1.0–1.15.
- Bullets remain literal "• " text prefixes (extraction-safe).
- Dates use plain hyphen separators instead of en-dashes.
- Document metadata set on `<Document>`: `title` (resume title), `author` (basics.name),
  `subject` ("Resume"), `language` ("en").

### 3. ATS-safe DOCX path

The DOCX builder's existing single-column paragraph path (`buildSectionParas`) becomes
the only path in ATS mode:

- Zero `Table` elements. Sidebar's shaded-rail table and the two-column layout table are
  bypassed entirely; rail sections merge back into linear `sectionOrder`.
- No header shading and no light-on-dark text; plain dark name/contact/summary
  paragraphs.
- Native paragraph styling only (already true of the single-column path).
- Designed mode DOCX output is unchanged.

### 4. Designed-mode cheap fixes (visuals preserved)

- Add the same `<Document>` metadata to all five designed PDF templates.
- Replace en-dash date separators with hyphens in both modes (shared date-range helper).
- No other structural changes — Designed mode is explicitly the "looks exact, may scan
  lower" option.

### 5. Verification harness (CI regression tests)

New Vitest suite that renders a realistic fixture resume through
**5 templates × 2 modes × 2 formats** and asserts on the actual output bytes:

- **PDF** (`pdf-parse` or `pdfjs-dist` as devDependency): every key fact present (name,
  email, employers, titles, metric-bearing bullets); for ATS mode, strict linear order —
  section headings appear in `sectionOrder` order, each job title adjacent to its
  employer, no rail content interleaved into other sections.
- **DOCX** (unzip `word/document.xml`): ATS mode contains zero `<w:tbl>` elements,
  section order matches `sectionOrder`, full content present.

These tests codify "parseable" so future template work cannot silently regress it.

## Error handling

- Unknown/invalid `mode` values fall back to `designed` (HTTP behavior unchanged).
- ATS renderers must handle the same sparse-data cases as existing templates (empty
  sections skipped, optional fields nullable) — covered by reusing the existing fixture
  patterns from `lib/docx/__tests__/resume-docx.test.ts`.

## Testing

- Unit: ATS PDF/DOCX renderer section-by-section tests, mirroring the existing
  `resume-docx.test.ts` style.
- Integration: the verification harness above (20 render combinations).
- Manual (user): re-run Jobscan-style checkers and Gemini parsing review on ATS-mode
  exports of all five templates after implementation.

## Follow-ups (out of scope)

- Show an ATS-score warning badge in the export chooser when Designed mode is selected,
  powered by `lib/ats/scorer.ts`.
- Consider amending CLAUDE.md's PDF semantic-tag rule to reflect that tagged PDF is not
  achievable with `@react-pdf/renderer` and is addressed via the ATS export mode.
