# ATS-Safe Export Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `ats` export mode (single-column, parser-safe PDF/DOCX) alongside the existing visual exports, per the approved spec at `docs/superpowers/specs/2026-06-11-ats-safe-exports-design.md`.

**Architecture:** Both export endpoints accept `mode: 'ats' | 'designed'` (default `designed`, preserving current behavior). ATS mode routes to a new shared single-column PDF renderer and forces the DOCX builder's existing table-free single-column path. A Vitest harness renders 5 templates × 2 modes × 2 formats and asserts on extracted text/XML so parseability becomes a CI invariant.

**Tech Stack:** Next.js 14 App Router, TypeScript, `@react-pdf/renderer` 4.x, `docx` 9.x, Vitest, `pdf-parse` 2.x (already a dependency — `PDFParse` class), `jszip` (already a dependency), `@testing-library/react`.

**Conventions used by this codebase (read before starting):**
- Path alias `@/` maps to the repo root (`cv-builder/`).
- Tests live in `__tests__/` folders or next to the component (`DesignPanel.test.tsx`). Node environment by default; component tests start with `// @vitest-environment jsdom`.
- Run a single test file: `npx vitest run path/to/file.test.ts`. Full suite: `npm run test:run`.
- DOCX font sizes are half-points (`size: 20` = 10pt). DOCX colors are hex without validation (both `'#333333'` and `'333333'` appear; follow the surrounding code).
- A broken `claude-mem` plugin hook may block the `Read` tool in this workspace. If `Read` fails with "claude-mem worker unreachable", read files via Bash (`cat`, `sed -n`) instead.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/format-date.ts` | Modify | Add `formatDateRange` (hyphen separator, optional "Present") |
| `lib/__tests__/format-date.test.ts` | Create | Tests for `formatDate` + `formatDateRange` |
| `lib/export-mode.ts` | Create | `ExportMode` type + `parseExportMode` request-body parser |
| `lib/__tests__/export-mode.test.ts` | Create | Tests for `parseExportMode` |
| `lib/pdf/templates/pdf-utils.tsx` | Modify | Add `pdfDocumentProps` (PDF metadata helper) |
| `lib/pdf/templates/AtsPdfTemplate.tsx` | Create | Shared single-column ATS PDF renderer |
| `lib/pdf/__tests__/ats-pdf-template.test.tsx` | Create | Renders ATS PDF, asserts extracted text order |
| `lib/pdf/templates/{Classic,Modern,Minimal,Executive,Sidebar}PdfTemplate.tsx` | Modify | `title` prop, `<Document>` metadata, hyphen date ranges |
| `lib/pdf/templates/renderPdfCustomSection.tsx` | Modify | Hyphen date ranges |
| `lib/pdf/select-template.ts` | Create | Mode-aware template selection (shared by route + tests) |
| `lib/docx/resume-docx.ts` | Modify | `mode` param, ATS theme, skip table branches in ATS mode, hyphen date ranges |
| `lib/docx/__tests__/resume-docx.test.ts` | Modify | Add ATS-mode tests |
| `app/api/resumes/[id]/export/pdf/route.ts` | Modify | Parse `mode` from body, use `selectPdfTemplate` |
| `app/api/resumes/[id]/export/docx/route.ts` | Modify | Parse `mode` from body, pass to `buildDocx` |
| `components/editor/ExportMenu.tsx` | Create | Dropdown offering Designed / ATS-optimized per format |
| `components/editor/ExportMenu.test.tsx` | Create | jsdom test for the menu |
| `components/editor/EditorShell.tsx` | Modify | Wire `ExportMenu`, mode-aware `handleExport` |
| `lib/__tests__/ats-export-harness.test.ts` | Create | 5 templates × 2 modes × 2 formats regression harness |

---

### Task 1: `formatDateRange` helper

The spec requires hyphen date separators (replacing en-dashes) in both export modes via a shared helper.

**Files:**
- Modify: `lib/format-date.ts`
- Create: `lib/__tests__/format-date.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/format-date.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatDate, formatDateRange } from '../format-date'

describe('formatDate', () => {
  it('converts YYYY-MM to MM/YYYY', () => {
    expect(formatDate('2020-01')).toBe('01/2020')
  })
  it('passes through bare years and empty input', () => {
    expect(formatDate('2020')).toBe('2020')
    expect(formatDate(undefined)).toBe('')
  })
})

describe('formatDateRange', () => {
  it('joins start and end with a plain hyphen', () => {
    expect(formatDateRange('2020-01', '2022-06')).toBe('01/2020 - 06/2022')
  })
  it('falls back to Present for open-ended ranges when requested', () => {
    expect(formatDateRange('2020-01', undefined, true)).toBe('01/2020 - Present')
  })
  it('omits Present when not requested', () => {
    expect(formatDateRange('2020-01', undefined)).toBe('01/2020')
  })
  it('returns Present alone when only the flag applies', () => {
    expect(formatDateRange(undefined, undefined, true)).toBe('Present')
  })
  it('returns empty string when nothing is set', () => {
    expect(formatDateRange(undefined, undefined)).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/format-date.test.ts`
Expected: FAIL — `formatDateRange` is not exported.

- [ ] **Step 3: Implement `formatDateRange`**

Append to `lib/format-date.ts`:

```ts
// Joins two dates with a plain hyphen (" - "), the most reliably parsed
// separator for ATS date-range extraction (en-dashes confuse some parsers).
// When `presentWhenOpen` is true, a missing end date renders as "Present".
export function formatDateRange(
  start: string | undefined | null,
  end: string | undefined | null,
  presentWhenOpen = false
): string {
  const endStr = formatDate(end) || (presentWhenOpen ? 'Present' : '')
  return [formatDate(start), endStr].filter(Boolean).join(' - ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/format-date.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/format-date.ts lib/__tests__/format-date.test.ts
git commit -m "feat: add formatDateRange helper with hyphen separator"
```

---

### Task 2: Replace en-dash date joins across all exports

Every date range in the PDF templates and DOCX builder currently uses `[formatDate(a), formatDate(b)…].filter(Boolean).join(' – ')` (en-dash). Replace all of them with `formatDateRange`.

**Files:**
- Modify: `lib/pdf/templates/ClassicPdfTemplate.tsx`
- Modify: `lib/pdf/templates/ModernPdfTemplate.tsx`
- Modify: `lib/pdf/templates/MinimalPdfTemplate.tsx`
- Modify: `lib/pdf/templates/ExecutivePdfTemplate.tsx`
- Modify: `lib/pdf/templates/SidebarPdfTemplate.tsx`
- Modify: `lib/pdf/templates/renderPdfCustomSection.tsx`
- Modify: `lib/docx/resume-docx.ts`

- [ ] **Step 1: Find every date-range join**

Run: `grep -rn "join(' – ')" lib/pdf lib/docx`

Expected: matches in the 7 files above. **Do not touch** non-date en-dashes (e.g. languages `` ` – ${l.fluency}` `` and similar fluency separators — those are not date ranges and stay as-is).

- [ ] **Step 2: Apply the replacement mapping in each file**

In every matched file, add `formatDateRange` to the existing `@/lib/format-date` import (keep `formatDate` only where still used; remove it if it becomes unused — lint will flag it). Then apply this exact mapping:

| Old expression | New expression |
|---|---|
| `[formatDate(job.startDate), formatDate(job.endDate) \|\| 'Present'].filter(Boolean).join(' – ')` | `formatDateRange(job.startDate, job.endDate, true)` |
| `[formatDate(v.startDate), formatDate(v.endDate) \|\| 'Present'].filter(Boolean).join(' – ')` | `formatDateRange(v.startDate, v.endDate, true)` |
| `[formatDate(edu.startDate), formatDate(edu.endDate)].filter(Boolean).join(' – ')` | `formatDateRange(edu.startDate, edu.endDate)` |
| `[formatDate(p.startDate), formatDate(p.endDate)].filter(Boolean).join(' – ')` | `formatDateRange(p.startDate, p.endDate)` |
| `[formatDate(item.startDate), formatDate(item.endDate)].filter(Boolean).join(' – ')` | `formatDateRange(item.startDate, item.endDate)` |

In `lib/docx/resume-docx.ts` the same expressions appear assigned to `const dates = …` — apply the same mapping (e.g. `const dates = formatDateRange(job.startDate, job.endDate, true)`).

- [ ] **Step 3: Verify no date joins remain and nothing broke**

Run: `grep -rn "join(' – ')" lib/pdf lib/docx`
Expected: no matches.

Run: `npm run test:run`
Expected: PASS. If any existing test asserts an en-dash in a date range, update that assertion to the hyphen format (` - `).

Run: `npm run lint`
Expected: clean (catches now-unused `formatDate` imports).

- [ ] **Step 4: Commit**

```bash
git add lib/pdf lib/docx
git commit -m "refactor: use formatDateRange (hyphen) for all export date ranges"
```

---

### Task 3: `ExportMode` type and body parser

**Files:**
- Create: `lib/export-mode.ts`
- Create: `lib/__tests__/export-mode.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/export-mode.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseExportMode } from '../export-mode'

describe('parseExportMode', () => {
  it('returns ats for "ats"', () => {
    expect(parseExportMode('ats')).toBe('ats')
  })
  it('defaults to designed for anything else', () => {
    expect(parseExportMode('designed')).toBe('designed')
    expect(parseExportMode(undefined)).toBe('designed')
    expect(parseExportMode(null)).toBe('designed')
    expect(parseExportMode('ATS')).toBe('designed')
    expect(parseExportMode(42)).toBe('designed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/export-mode.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/export-mode.ts`:

```ts
export type ExportMode = 'ats' | 'designed'

// Invalid/missing values fall back to 'designed' (backward compatible:
// requests without a mode behave exactly as before this feature existed).
export function parseExportMode(value: unknown): ExportMode {
  return value === 'ats' ? 'ats' : 'designed'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/export-mode.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/export-mode.ts lib/__tests__/export-mode.test.ts
git commit -m "feat: add ExportMode type and parseExportMode"
```

---

### Task 4: ATS-safe PDF renderer

One shared single-column renderer used by all templates in ATS mode. Also adds the `pdfDocumentProps` metadata helper to `pdf-utils.tsx` (reused by designed templates in Task 5).

**Files:**
- Modify: `lib/pdf/templates/pdf-utils.tsx`
- Create: `lib/pdf/templates/AtsPdfTemplate.tsx`
- Create: `lib/pdf/__tests__/ats-pdf-template.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `lib/pdf/__tests__/ats-pdf-template.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFParse } from 'pdf-parse'
import { AtsPdfTemplate } from '../templates/AtsPdfTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const meta: ResumeMeta = {
  templateId: 'sidebar', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f', accentColor: '#0066cc',
  pageMargins: 0.5, lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills', 'languages'],
  layout: 'two-column', columnAssignment: {},
}

const data: ResumeData = {
  basics: {
    name: 'Jane Smith', label: 'Principal Architect',
    email: 'jane.smith@example.com', phone: '+1 555 0100',
    location: { city: 'Tel Aviv', region: 'IL' },
    summary: 'Engineer with a decade of platform experience.',
  },
  work: [{
    name: 'Acme Corp', position: 'Senior Engineer', startDate: '2020-01',
    summary: 'Led the platform team.',
    highlights: ['Cut infra costs 40%', 'Shipped v2 to 1M users'],
  }],
  education: [{ institution: 'MIT', area: 'Computer Science', studyType: 'BSc', startDate: '2012-09', endDate: '2016-06', score: '3.9' }],
  skills: [{ name: 'TypeScript', level: 'Expert', keywords: ['React', 'Node.js'] }],
  languages: [{ language: 'English', fluency: 'Native' }],
}

async function extractText(element: React.ReactElement): Promise<string> {
  const buffer = await renderToBuffer(element as React.ReactElement<never>)
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return result.text.replace(/\s+/g, ' ')
}

function assertOrdered(text: string, parts: string[]) {
  let last = -1
  for (const part of parts) {
    const idx = text.indexOf(part)
    expect(idx, `"${part}" missing or out of order`).toBeGreaterThan(last)
    last = idx
  }
}

describe('AtsPdfTemplate', () => {
  it('renders strictly linear content regardless of template/layout meta', async () => {
    const text = await extractText(<AtsPdfTemplate data={data} meta={meta} title="My Resume" />)
    assertOrdered(text, [
      'Jane Smith', 'Principal Architect', 'jane.smith@example.com',
      'WORK EXPERIENCE', 'Acme Corp', '01/2020 - Present', 'Senior Engineer',
      'Cut infra costs 40%',
      'EDUCATION', 'MIT', 'BSc in Computer Science',
      'SKILLS', 'TypeScript',
      'LANGUAGES', 'English',
    ])
  })

  it('embeds document metadata', async () => {
    const buffer = await renderToBuffer(
      (<AtsPdfTemplate data={data} meta={meta} title="My Resume" />) as React.ReactElement<never>
    )
    const raw = buffer.toString('latin1')
    expect(raw).toContain('/Title')
    expect(raw).toContain('/Author')
  })

  it('renders without error on empty data', async () => {
    const buffer = await renderToBuffer(
      (<AtsPdfTemplate data={{}} meta={meta} />) as React.ReactElement<never>
    )
    expect(buffer.byteLength).toBeGreaterThan(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/pdf/__tests__/ats-pdf-template.test.tsx`
Expected: FAIL — `AtsPdfTemplate` module not found.

- [ ] **Step 3: Add `pdfDocumentProps` to pdf-utils**

In `lib/pdf/templates/pdf-utils.tsx`, change the type import to include `ResumeData`:

```ts
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
```

and append:

```ts
/**
 * Standard <Document> metadata for all PDF exports. Untagged PDFs are all
 * @react-pdf/renderer can produce, so title/author/language metadata is the
 * structural signal we can give parsers.
 */
export function pdfDocumentProps(data: ResumeData, title?: string) {
  const name = data.basics?.name ?? ''
  return {
    title: title || (name ? `${name} - Resume` : 'Resume'),
    author: name,
    subject: 'Resume',
    language: 'en',
  }
}
```

- [ ] **Step 4: Implement `AtsPdfTemplate`**

Create `lib/pdf/templates/AtsPdfTemplate.tsx`:

```tsx
import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import {
  mapToPdfFont, inToPt, resolveSectionOrder, pdfDocumentProps,
  renderPdfRichText, renderPdfRichTextRuns,
} from './pdf-utils'
import { renderPdfCustomSection } from './renderPdfCustomSection'
import { formatDate, formatDateRange } from '@/lib/format-date'

/**
 * Shared ATS-safe renderer used by every template in "ats" export mode.
 * Strictly linear single column: no flex rows, no backgrounds, no
 * light-on-dark text. The template's visual identity is reduced to its
 * fonts and heading color.
 */
export function AtsPdfTemplate({ data, meta, title }: { data: ResumeData; meta: ResumeMeta; title?: string }) {
  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [] } = data

  const bodyFont = mapToPdfFont(meta.fontFamily)
  const headFont = mapToPdfFont(meta.headerFontFamily)
  // Hard ATS floors: margins never below 0.5in, line spacing clamped to 1.0–1.15
  const margin = inToPt(Math.max(meta.pageMargins, 0.5))
  const lineHeight = Math.min(Math.max(meta.lineSpacing, 1.0), 1.15)
  const sectionOrder = resolveSectionOrder(meta)

  const styles = StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: 10.5, lineHeight, color: '#000000', padding: margin },
    name: { fontFamily: headFont, fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
    label: { fontSize: 11, color: '#333333', marginBottom: 2 },
    contact: { fontSize: 10, color: '#333333', marginBottom: 6 },
    sectionTitle: {
      fontFamily: headFont, fontSize: 13, fontWeight: 'bold', color: meta.primaryColor,
      textTransform: 'uppercase', marginTop: 10, marginBottom: 4,
    },
    entryHead: { fontSize: 10.5, fontWeight: 'bold', marginTop: 5 },
    dates: { fontWeight: 'normal', color: '#333333' },
    position: { fontSize: 10.5, color: '#333333' },
    body: { fontSize: 10.5, marginTop: 1 },
    bullet: { fontSize: 10.5, marginLeft: 12, marginBottom: 1 },
    small: { fontSize: 10, color: '#333333' },
  })

  const contactLine = [
    basics.email, basics.phone, basics.url,
    [basics.location?.city, basics.location?.region].filter(Boolean).join(', '),
  ].filter(Boolean).join(' | ')

  // Single text line per entry head — never a flex row, so Y-order parsers
  // can't split name and dates across columns.
  const entryHead = (name: string, dates: string) => (
    <Text style={styles.entryHead}>
      {name}
      {dates ? <Text style={styles.dates}> | {dates}</Text> : null}
    </Text>
  )

  function renderSection(section: string): React.ReactNode {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = data.customSections?.find((s) => s.id === id)
      if (!cs) return null
      // entryRow deliberately has no flexDirection: title and dates stack vertically
      return renderPdfCustomSection(cs, {
        sectionTitle: styles.sectionTitle,
        entryRow: { marginBottom: 2 },
        bold: { fontSize: 10.5, fontWeight: 'bold' },
        accent: styles.position,
        small: styles.small,
        body: styles.body,
        bullet: styles.bullet,
      })
    }
    switch (section) {
      case 'work':
        if (!work.length) return null
        return (
          <View key="work">
            <Text style={styles.sectionTitle}>Work Experience</Text>
            {work.map((job, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                {entryHead(job.name ?? '', formatDateRange(job.startDate, job.endDate, true))}
                {job.position ? <Text style={styles.position}>{job.position}</Text> : null}
                {renderPdfRichText(job.summary, styles.body)}
                {(job.highlights ?? []).map((h, hi) => (
                  <Text key={hi} style={styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
                ))}
              </View>
            ))}
          </View>
        )
      case 'education':
        if (!education.length) return null
        return (
          <View key="education">
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((edu, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                {entryHead(edu.institution ?? '', formatDateRange(edu.startDate, edu.endDate))}
                <Text style={styles.body}>{[edu.studyType, edu.area].filter(Boolean).join(' in ')}</Text>
                {edu.score ? <Text style={styles.small}>Score: {edu.score}</Text> : null}
              </View>
            ))}
          </View>
        )
      case 'skills':
        if (!skills.length) return null
        return (
          <View key="skills">
            <Text style={styles.sectionTitle}>Skills</Text>
            {skills.map((s, i) => (
              <Text key={i} style={styles.body}>
                <Text style={{ fontWeight: 'bold' }}>{s.name ?? ''}</Text>
                {s.level ? ` (${s.level})` : ''}
                {(s.keywords ?? []).length > 0 ? `: ${(s.keywords ?? []).join(', ')}` : ''}
              </Text>
            ))}
          </View>
        )
      case 'certificates':
        if (!certificates.length) return null
        return (
          <View key="certificates">
            <Text style={styles.sectionTitle}>Certifications</Text>
            {certificates.map((c, i) => (
              <Text key={i} style={styles.body}>
                <Text style={{ fontWeight: 'bold' }}>{c.name ?? ''}</Text>
                {c.issuer ? ` - ${c.issuer}` : ''}
                {c.date ? ` | ${formatDate(c.date)}` : ''}
              </Text>
            ))}
          </View>
        )
      case 'languages':
        if (!languages.length) return null
        return (
          <View key="languages">
            <Text style={styles.sectionTitle}>Languages</Text>
            {languages.map((l, i) => (
              <Text key={i} style={styles.body}>
                <Text style={{ fontWeight: 'bold' }}>{l.language ?? ''}</Text>
                {l.fluency ? ` - ${l.fluency}` : ''}
              </Text>
            ))}
          </View>
        )
      case 'awards':
        if (!awards.length) return null
        return (
          <View key="awards">
            <Text style={styles.sectionTitle}>Awards</Text>
            {awards.map((a, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                {entryHead(a.title ?? '', a.date ? formatDate(a.date) : '')}
                {a.awarder ? <Text style={styles.small}>{a.awarder}</Text> : null}
                {a.summary ? <Text style={styles.body}>{a.summary}</Text> : null}
              </View>
            ))}
          </View>
        )
      case 'publications':
        if (!publications.length) return null
        return (
          <View key="publications">
            <Text style={styles.sectionTitle}>Publications</Text>
            {publications.map((p, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                {entryHead(p.name ?? '', p.releaseDate ? formatDate(p.releaseDate) : '')}
                {p.publisher ? <Text style={styles.small}>{p.publisher}</Text> : null}
                {p.summary ? <Text style={styles.body}>{p.summary}</Text> : null}
              </View>
            ))}
          </View>
        )
      case 'volunteer':
        if (!volunteer.length) return null
        return (
          <View key="volunteer">
            <Text style={styles.sectionTitle}>Volunteer</Text>
            {volunteer.map((v, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                {entryHead(v.organization ?? '', formatDateRange(v.startDate, v.endDate, true))}
                {v.position ? <Text style={styles.position}>{v.position}</Text> : null}
                {renderPdfRichText(v.summary, styles.body)}
                {(v.highlights ?? []).map((h, hi) => (
                  <Text key={hi} style={styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
                ))}
              </View>
            ))}
          </View>
        )
      case 'interests':
        if (!interests.length) return null
        return (
          <View key="interests">
            <Text style={styles.sectionTitle}>Interests</Text>
            {interests.map((int, i) => (
              <Text key={i} style={styles.body}>
                <Text style={{ fontWeight: 'bold' }}>{int.name ?? ''}</Text>
                {(int.keywords ?? []).length > 0 ? `: ${(int.keywords ?? []).join(', ')}` : ''}
              </Text>
            ))}
          </View>
        )
      case 'projects':
        if (!projects.length) return null
        return (
          <View key="projects">
            <Text style={styles.sectionTitle}>Projects</Text>
            {projects.map((p, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                {entryHead(p.name ?? '', formatDateRange(p.startDate, p.endDate))}
                {p.description ? <Text style={styles.body}>{p.description}</Text> : null}
                {(p.highlights ?? []).map((h, hi) => (
                  <Text key={hi} style={styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
                ))}
                {(p.keywords ?? []).length > 0 ? <Text style={styles.small}>{(p.keywords ?? []).join(', ')}</Text> : null}
              </View>
            ))}
          </View>
        )
      default:
        return null
    }
  }

  return (
    <Document {...pdfDocumentProps(data, title)}>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.name}>{basics.name ?? ''}</Text>
          {basics.label ? <Text style={styles.label}>{basics.label}</Text> : null}
          {contactLine ? <Text style={styles.contact}>{contactLine}</Text> : null}
          {renderPdfRichText(basics.summary, styles.body)}
          {sectionOrder.map(renderSection)}
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/pdf/__tests__/ats-pdf-template.test.tsx`
Expected: PASS (3 tests). If the order assertion fails, log the extracted text (`console.log(text)`) to see how pdf-parse linearizes it, and fix the renderer (not the assertion) unless the difference is pure whitespace.

- [ ] **Step 6: Commit**

```bash
git add lib/pdf/templates/pdf-utils.tsx lib/pdf/templates/AtsPdfTemplate.tsx lib/pdf/__tests__/ats-pdf-template.test.tsx
git commit -m "feat: add shared ATS-safe PDF renderer with document metadata"
```

---

### Task 5: PDF metadata on the five designed templates

Each designed template gets an optional `title` prop and `<Document>` metadata via `pdfDocumentProps`.

**Files:**
- Modify: `lib/pdf/templates/ClassicPdfTemplate.tsx` (two `<Document>` occurrences)
- Modify: `lib/pdf/templates/ModernPdfTemplate.tsx` (two)
- Modify: `lib/pdf/templates/ExecutivePdfTemplate.tsx` (two)
- Modify: `lib/pdf/templates/MinimalPdfTemplate.tsx` (one)
- Modify: `lib/pdf/templates/SidebarPdfTemplate.tsx` (one)

- [ ] **Step 1: Apply the same three-part edit to each of the five templates**

(a) Add `pdfDocumentProps` to the existing `./pdf-utils` import.

(b) Change the component signature — e.g. for Modern:

```tsx
export function ModernPdfTemplate({ data, meta, title }: { data: ResumeData; meta: ResumeMeta; title?: string }) {
```

(same pattern for Classic/Minimal/Executive/Sidebar).

(c) Change **every** `<Document>` opening tag in the file (some templates return two documents — two-column and single-column branches):

```tsx
<Document {...pdfDocumentProps(data, title)}>
```

- [ ] **Step 2: Verify**

Run: `grep -rn "<Document" lib/pdf/templates`
Expected: every occurrence (8 across the 5 designed templates + 1 in AtsPdfTemplate) uses `{...pdfDocumentProps(data, title)}`.

Run: `npm run test:run` — Expected: PASS.
Run: `npm run lint` — Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/pdf/templates
git commit -m "feat: add PDF document metadata to designed templates"
```

---

### Task 6: Mode-aware PDF template selection + route

Extract template selection into `lib/pdf/select-template.ts` (shared by the route and the test harness), then make the route parse `mode`.

**Files:**
- Create: `lib/pdf/select-template.ts`
- Modify: `app/api/resumes/[id]/export/pdf/route.ts`

- [ ] **Step 1: Create the selector**

Create `lib/pdf/select-template.ts`:

```ts
import React from 'react'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import type { ExportMode } from '@/lib/export-mode'
import { ClassicPdfTemplate } from './templates/ClassicPdfTemplate'
import { ModernPdfTemplate } from './templates/ModernPdfTemplate'
import { MinimalPdfTemplate } from './templates/MinimalPdfTemplate'
import { ExecutivePdfTemplate } from './templates/ExecutivePdfTemplate'
import { SidebarPdfTemplate } from './templates/SidebarPdfTemplate'
import { AtsPdfTemplate } from './templates/AtsPdfTemplate'

export function selectPdfTemplate(
  data: ResumeData,
  meta: ResumeMeta,
  mode: ExportMode,
  title?: string
): React.ReactElement {
  if (mode === 'ats') return React.createElement(AtsPdfTemplate, { data, meta, title })
  switch (meta.templateId) {
    case 'modern':
      return React.createElement(ModernPdfTemplate, { data, meta, title })
    case 'minimal':
      return React.createElement(MinimalPdfTemplate, { data, meta, title })
    case 'executive':
      return React.createElement(ExecutivePdfTemplate, { data, meta, title })
    case 'sidebar':
      return React.createElement(SidebarPdfTemplate, { data, meta, title })
    default:
      return React.createElement(ClassicPdfTemplate, { data, meta, title })
  }
}
```

- [ ] **Step 2: Rewrite the PDF route to use it**

Replace the full contents of `app/api/resumes/[id]/export/pdf/route.ts` with:

```ts
import { renderToBuffer } from '@react-pdf/renderer'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { parseExportMode } from '@/lib/export-mode'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import type React from 'react'

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { id } = await (ctx?.params as Promise<{ id: string }>)
  const resume = await getResume(req.auth.user.id, id)
  if (!resume) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const mode = parseExportMode((body as { mode?: unknown }).mode)

  const data = (resume.data ?? {}) as ResumeData
  const meta = resume.meta as ResumeMeta
  const element = selectPdfTemplate(data, meta, mode, resume.title)

  const buffer = await renderToBuffer(element as React.ReactElement<never>)

  const baseName = resume.title.replace(/[^a-z0-9]/gi, '-')
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${baseName}${mode === 'ats' ? '-ATS' : ''}.pdf"`,
      'Content-Length': String(buffer.byteLength),
    },
  })
})
```

- [ ] **Step 3: Verify**

Run: `npm run lint` — Expected: clean.
Run: `npm run test:run` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/pdf/select-template.ts "app/api/resumes/[id]/export/pdf/route.ts"
git commit -m "feat: mode-aware PDF export (ats|designed) with shared template selector"
```

---

### Task 7: DOCX ATS mode

`buildDocx` gains a `mode` parameter. ATS mode uses a neutral dark-on-white theme and **never** enters the sidebar-rail or two-column table branches — it always takes the existing single-column paragraph path, with rail sections folding back into `sectionOrder`.

**Files:**
- Modify: `lib/docx/resume-docx.ts`
- Modify: `lib/docx/__tests__/resume-docx.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/docx/__tests__/resume-docx.test.ts` (reuse the existing `defaultMeta`/`sampleData` consts and `JSZip` import already in the file):

```ts
describe('buildDocx ats mode', () => {
  async function docXml(doc: ReturnType<typeof buildDocx>): Promise<string> {
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    return zip.file('word/document.xml')!.async('string')
  }

  const fullData = {
    ...sampleData,
    languages: [{ language: 'English', fluency: 'Native' }],
  }

  it('sidebar template has no tables in ats mode', async () => {
    const meta = { ...defaultMeta, templateId: 'sidebar', sectionOrder: ['work', 'education', 'skills', 'languages'] }
    const xml = await docXml(buildDocx(fullData, meta, 'ats'))
    expect(xml).not.toContain('<w:tbl')
    // Rail content folds back inline, in sectionOrder order
    const order = ['Jane Smith', 'WORK EXPERIENCE', 'Acme', 'EDUCATION', 'MIT', 'SKILLS', 'TypeScript', 'LANGUAGES', 'English']
    let last = -1
    for (const part of order) {
      const idx = xml.indexOf(part)
      expect(idx, `"${part}" missing or out of order`).toBeGreaterThan(last)
      last = idx
    }
  })

  it('two-column layout has no tables in ats mode', async () => {
    const xml = await docXml(buildDocx(fullData, { ...defaultMeta, layout: 'two-column' }, 'ats'))
    expect(xml).not.toContain('<w:tbl')
  })

  it('ats mode has no shading anywhere (no filled header, no rail)', async () => {
    const meta = { ...defaultMeta, templateId: 'modern', primaryColor: '#1e3a5f' }
    const xml = await docXml(buildDocx(fullData, meta, 'ats'))
    expect(xml).not.toContain('<w:shd')
  })

  it('defaults to designed mode (sidebar still renders its rail table)', async () => {
    const meta = { ...defaultMeta, templateId: 'sidebar' }
    const xml = await docXml(buildDocx(fullData, meta))
    expect(xml).toContain('<w:tbl')
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run lib/docx/__tests__/resume-docx.test.ts`
Expected: the four new tests FAIL (mode parameter does not exist / tables still rendered); existing tests still PASS.

- [ ] **Step 3: Implement ATS mode in `buildDocx`**

In `lib/docx/resume-docx.ts`:

(a) Add the import:

```ts
import type { ExportMode } from '@/lib/export-mode'
```

(b) Add the ATS theme factory directly below `buildDocxTheme`:

```ts
// Neutral dark-on-white theme for ATS exports: no header fill, no light
// tints, headings keep the template's primary color. Sizes per the
// typography constraints (name 20pt, headings 13pt — half-points here).
function buildAtsDocxTheme(meta: ResumeMeta): DocxTheme {
  return {
    sectionTitleColor: meta.primaryColor,
    sectionUppercase: true,
    sectionBorder: true,
    sectionBorderSize: 6,
    accentColor: '333333',
    nameSize: 40,
    headingSize: 26,
    headerAlign: AlignmentType.LEFT,
    summaryHeading: true,
  }
}
```

(c) Change the `buildDocx` signature:

```ts
export function buildDocx(data: ResumeData, meta: ResumeMeta, mode: ExportMode = 'designed'): Document {
```

(d) Change the theme selection line from `const theme = buildDocxTheme(meta)` to:

```ts
const theme = mode === 'ats' ? buildAtsDocxTheme(meta) : buildDocxTheme(meta)
```

(e) Guard the sidebar rail-table branch — change:

```ts
if (meta.templateId === 'sidebar') {
```

to:

```ts
if (mode === 'designed' && meta.templateId === 'sidebar') {
```

(f) Guard the two-column table branch — change:

```ts
if (meta.layout === 'two-column' && meta.templateId !== 'minimal') {
```

to:

```ts
if (mode === 'designed' && meta.layout === 'two-column' && meta.templateId !== 'minimal') {
```

No other changes: with the ATS theme having no `headerFill`, the normal header path already renders plain dark paragraphs, and the single-column `buildSectionParas` path already handles every section (including skills/languages that the sidebar would have put in the rail).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/docx/__tests__/resume-docx.test.ts`
Expected: PASS (all, including pre-existing tests — designed mode is untouched).

- [ ] **Step 5: Commit**

```bash
git add lib/docx/resume-docx.ts lib/docx/__tests__/resume-docx.test.ts
git commit -m "feat: table-free single-column DOCX output in ats export mode"
```

---

### Task 8: DOCX route mode support

**Files:**
- Modify: `app/api/resumes/[id]/export/docx/route.ts`

- [ ] **Step 1: Parse mode and pass it through**

In `app/api/resumes/[id]/export/docx/route.ts`:

(a) Add the import:

```ts
import { parseExportMode } from '@/lib/export-mode'
```

(b) After the `if (!resume)` guard, add:

```ts
const body = await req.json().catch(() => ({} as Record<string, unknown>))
const mode = parseExportMode((body as { mode?: unknown }).mode)
```

(c) Change `const doc = buildDocx(data, meta)` to:

```ts
const doc = buildDocx(data, meta, mode)
```

(d) Change the `Content-Disposition` header line to:

```ts
'Content-Disposition': `attachment; filename="${resume.title.replace(/[^a-z0-9]/gi, '-')}${mode === 'ats' ? '-ATS' : ''}.docx"`,
```

- [ ] **Step 2: Verify**

Run: `npm run lint` — Expected: clean.
Run: `npm run test:run` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/api/resumes/[id]/export/docx/route.ts"
git commit -m "feat: mode-aware DOCX export route"
```

---

### Task 9: Export menu UI

Replace the separate PDF/DOCX buttons in `EditorShell` with one `Export ▾` dropdown offering Designed / ATS-optimized per format. The menu is its own small component so it can be tested in isolation.

**Files:**
- Create: `components/editor/ExportMenu.tsx`
- Create: `components/editor/ExportMenu.test.tsx`
- Modify: `components/editor/EditorShell.tsx` (`handleExport` around line 122, export buttons around lines 164–175)

- [ ] **Step 1: Write the failing test**

Create `components/editor/ExportMenu.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExportMenu } from './ExportMenu'

describe('ExportMenu', () => {
  it('opens on click and fires onExport with format and mode', () => {
    const onExport = vi.fn()
    render(<ExportMenu onExport={onExport} />)

    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    fireEvent.click(screen.getByText('PDF — ATS-optimized'))

    expect(onExport).toHaveBeenCalledWith('pdf', 'ats')
  })

  it('offers designed and ats variants for both formats', () => {
    render(<ExportMenu onExport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    expect(screen.getByText('PDF — Designed')).toBeTruthy()
    expect(screen.getByText('PDF — ATS-optimized')).toBeTruthy()
    expect(screen.getByText('DOCX — Designed')).toBeTruthy()
    expect(screen.getByText('DOCX — ATS-optimized')).toBeTruthy()
  })

  it('closes after selecting an item', () => {
    render(<ExportMenu onExport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    fireEvent.click(screen.getByText('DOCX — Designed'))
    expect(screen.queryByText('PDF — Designed')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/editor/ExportMenu.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ExportMenu`**

Create `components/editor/ExportMenu.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { ExportMode } from '@/lib/export-mode'

export interface ExportMenuProps {
  onExport: (format: 'pdf' | 'docx', mode: ExportMode) => void
}

export function ExportMenu({ onExport }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const item = (label: string, sub: string, format: 'pdf' | 'docx', mode: ExportMode) => (
    <button
      type="button"
      onClick={() => { setOpen(false); onExport(format, mode) }}
      className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors"
    >
      <span className="block text-xs font-medium text-indigo-900">{label}</span>
      <span className="block text-[10px] text-indigo-400">{sub}</span>
    </button>
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 transition-colors"
      >
        Export ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded border border-indigo-100 bg-white shadow-lg z-50 py-1">
          {item('PDF — Designed', 'Exact match of the preview', 'pdf', 'designed')}
          {item('PDF — ATS-optimized', 'Single-column, parser-safe', 'pdf', 'ats')}
          <div className="my-1 border-t border-indigo-100" />
          {item('DOCX — Designed', 'Exact match of the preview', 'docx', 'designed')}
          {item('DOCX — ATS-optimized', 'Single-column, parser-safe', 'docx', 'ats')}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/editor/ExportMenu.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into `EditorShell`**

In `components/editor/EditorShell.tsx`:

(a) Add imports at the top with the other component imports:

```tsx
import { ExportMenu } from './ExportMenu'
import type { ExportMode } from '@/lib/export-mode'
```

(b) Replace the existing `handleExport` function (currently `async function handleExport(format: 'pdf' | 'docx') { … }`) with:

```tsx
async function handleExport(format: 'pdf' | 'docx', mode: ExportMode = 'designed') {
  const { resumeId: rid, title: t } = useResumeEditorStore.getState()
  try {
    const res = await fetch(`/api/resumes/${rid}/export/${format}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    if (!res.ok) throw new Error(`Export failed: ${res.status}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t.replace(/\s+/g, '-')}${mode === 'ats' ? '-ATS' : ''}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    alert('Export failed. Please try again.')
  }
}
```

(c) Replace the two export buttons in the navbar JSX:

```tsx
<button
  onClick={() => handleExport('pdf')}
  className="text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 transition-colors"
>
  PDF
</button>
<button
  onClick={() => handleExport('docx')}
  className="text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 transition-colors"
>
  DOCX
</button>
```

with:

```tsx
<ExportMenu onExport={handleExport} />
```

- [ ] **Step 6: Verify**

Run: `npm run test:run` — Expected: PASS.
Run: `npm run lint` — Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add components/editor/ExportMenu.tsx components/editor/ExportMenu.test.tsx components/editor/EditorShell.tsx
git commit -m "feat: export menu with Designed and ATS-optimized modes"
```

---

### Task 10: ATS regression harness

The CI invariant: render a realistic fixture through **5 templates × 2 modes × 2 formats** and assert on extracted text (PDF) and document XML (DOCX). Uses `selectPdfTemplate` and `buildDocx` directly — the same code paths the routes call.

**Files:**
- Create: `lib/__tests__/ats-export-harness.test.ts`

- [ ] **Step 1: Write the harness**

Create `lib/__tests__/ats-export-harness.test.ts`:

```ts
import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFParse } from 'pdf-parse'
import { Packer } from 'docx'
import JSZip from 'jszip'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { buildDocx } from '@/lib/docx/resume-docx'
import type { ExportMode } from '@/lib/export-mode'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const TEMPLATES = ['classic', 'modern', 'minimal', 'executive', 'sidebar'] as const
const MODES: ExportMode[] = ['designed', 'ats']

function makeMeta(overrides: Partial<ResumeMeta> = {}): ResumeMeta {
  return {
    templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
    primaryColor: '#1e3a5f', accentColor: '#0066cc',
    pageMargins: 0.75, lineSpacing: 1.1,
    sectionOrder: ['work', 'education', 'skills', 'languages', 'custom:extra1'],
    layout: 'single-column', columnAssignment: {},
    ...overrides,
  }
}

const fixture: ResumeData = {
  basics: {
    name: 'Jane Smith', label: 'Principal Architect',
    email: 'jane.smith@example.com', phone: '+1 555 0100', url: 'janesmith.dev',
    location: { city: 'Tel Aviv', region: 'IL' },
    summary: 'Engineer with a decade of platform experience.',
  },
  work: [{
    name: 'Acme Corp', position: 'Senior Engineer', startDate: '2020-01',
    summary: 'Led the platform team.',
    highlights: ['Cut infra costs 40%', 'Shipped v2 to 1M users'],
  }],
  education: [{ institution: 'MIT', area: 'Computer Science', studyType: 'BSc', startDate: '2012-09', endDate: '2016-06', score: '3.9' }],
  skills: [{ name: 'TypeScript', level: 'Expert', keywords: ['React', 'Node.js'] }],
  languages: [{ language: 'English', fluency: 'Native' }],
  customSections: [{
    id: 'extra1', name: 'Patents', enabledFields: ['summary'],
    items: [{ id: 'p1', title: 'Distributed Cache Patent', summary: 'Granted 2023.' }],
  }],
}

// Every key fact that must survive export in any mode
const KEY_FACTS = [
  'Jane Smith', 'jane.smith@example.com',
  'Acme Corp', 'Senior Engineer', 'Cut infra costs 40%',
  'MIT', 'TypeScript', 'English', 'Distributed Cache Patent',
]

// Strict linear reading order required in ats mode (headings are uppercased)
const ATS_ORDER = [
  'Jane Smith', 'Principal Architect', 'jane.smith@example.com',
  'WORK EXPERIENCE', 'Acme Corp', 'Senior Engineer', 'Cut infra costs 40%',
  'EDUCATION', 'MIT',
  'SKILLS', 'TypeScript',
  'LANGUAGES', 'English',
  'PATENTS', 'Distributed Cache Patent',
]

async function pdfText(data: ResumeData, meta: ResumeMeta, mode: ExportMode): Promise<string> {
  const element = selectPdfTemplate(data, meta, mode, 'Harness Resume')
  const buffer = await renderToBuffer(element as React.ReactElement<never>)
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return result.text.replace(/\s+/g, ' ')
}

async function docxXml(data: ResumeData, meta: ResumeMeta, mode: ExportMode): Promise<string> {
  const buffer = await Packer.toBuffer(buildDocx(data, meta, mode))
  const zip = await JSZip.loadAsync(buffer)
  return zip.file('word/document.xml')!.async('string')
}

function assertOrdered(text: string, parts: string[]) {
  let last = -1
  for (const part of parts) {
    const idx = text.indexOf(part)
    expect(idx, `"${part}" missing or out of order`).toBeGreaterThan(last)
    last = idx
  }
}

describe('ATS export harness (5 templates x 2 modes x 2 formats)', () => {
  for (const templateId of TEMPLATES) {
    describe(`template: ${templateId}`, () => {
      it('ats PDF is strictly linear', async () => {
        const text = await pdfText(fixture, makeMeta({ templateId }), 'ats')
        assertOrdered(text, ATS_ORDER)
      })

      it('ats PDF stays linear even with two-column meta', async () => {
        const meta = makeMeta({
          templateId, layout: 'two-column',
          columnAssignment: { education: 'right', skills: 'right' },
        })
        const text = await pdfText(fixture, meta, 'ats')
        assertOrdered(text, ATS_ORDER)
      })

      it('designed PDF contains every key fact', async () => {
        const text = await pdfText(fixture, makeMeta({ templateId }), 'designed')
        for (const fact of KEY_FACTS) expect(text).toContain(fact)
      })

      it('ats DOCX has no tables and is strictly ordered', async () => {
        const meta = makeMeta({ templateId, layout: 'two-column' })
        const xml = await docxXml(fixture, meta, 'ats')
        expect(xml).not.toContain('<w:tbl')
        assertOrdered(xml, [
          'Jane Smith', 'WORK EXPERIENCE', 'Acme Corp',
          'EDUCATION', 'MIT', 'SKILLS', 'TypeScript',
          'LANGUAGES', 'English', 'PATENTS', 'Distributed Cache Patent',
        ])
      })

      it('designed DOCX still serializes', async () => {
        const buffer = await Packer.toBuffer(buildDocx(fixture, makeMeta({ templateId }), 'designed'))
        expect(buffer.byteLength).toBeGreaterThan(1000)
      })
    })
  }

  it('every exported PDF carries document metadata', async () => {
    const element = selectPdfTemplate(fixture, makeMeta({ templateId: 'classic' }), 'designed', 'Harness Resume')
    const buffer = await renderToBuffer(element as React.ReactElement<never>)
    const raw = buffer.toString('latin1')
    expect(raw).toContain('/Title')
    expect(raw).toContain('/Author')
  })
})
```

- [ ] **Step 2: Run the harness**

Run: `npx vitest run lib/__tests__/ats-export-harness.test.ts`
Expected: PASS — 26 tests (5 templates × 5 cases + 1 metadata test).

Debugging guidance if a case fails:
- **`designed PDF contains every key fact` fails for a template:** log the extracted text. If pdf-parse mangles a fact across a flex-row boundary (e.g. name and dates joined without a space), the fix is to relax only that fact to its longest stable substring — designed mode does not guarantee linear order, only content presence.
- **`ats PDF is strictly linear` fails:** that is a real renderer bug — fix `AtsPdfTemplate`, never the assertion order.
- **`ats DOCX` fails on `'PATENTS'`:** check that the ATS theme has `sectionUppercase: true` (custom section headings go through `sectionHeading`, which uppercases).

- [ ] **Step 3: Commit**

```bash
git add lib/__tests__/ats-export-harness.test.ts
git commit -m "test: ATS export regression harness across templates, modes, formats"
```

---

### Task 11: Full verification

- [ ] **Step 1: Run everything**

Run: `npm run test:run`
Expected: full suite PASS (no skips, no pre-existing failures introduced).

Run: `npm run lint`
Expected: clean.

- [ ] **Step 2: Manual smoke test (requires dev server + a saved resume)**

Run: `npm run dev`, open a resume in the editor, and from the `Export ▾` menu download all four variants. Verify:
- `*-ATS.pdf`: single column, dark text on white, opens fine.
- `*.pdf` (Designed): visually identical to before this change.
- `*-ATS.docx`: opens in Word, no table grid anywhere (Word: click inside content — no Table Tools tab appears).
- Copy-paste the ATS PDF's text into a plain editor: sections appear top-to-bottom in `sectionOrder` order.

- [ ] **Step 3: Final commit if any stragglers remain**

```bash
git status
```

Expected: clean tree (everything committed in Tasks 1–10). If files remain, commit them with an appropriate message.

**Post-implementation (user, external):** re-run the Jobscan-style checkers and Gemini parsing review on ATS-mode exports of all five templates — this was the original failure signal and is the real acceptance test.
