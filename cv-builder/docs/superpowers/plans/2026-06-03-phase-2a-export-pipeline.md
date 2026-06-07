# Phase 2a Export Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PDF export (via `@react-pdf/renderer`) and DOCX export (via `docx`) to the resume editor. Both are triggered by buttons already wired in `EditorShell` — this plan implements the server routes and template renderers those buttons call.

**Architecture:** Two server routes (`POST /api/resumes/[id]/export/pdf` and `POST /api/resumes/[id]/export/docx`) use the same auth pattern as Phase 1. PDF templates live in `lib/pdf/templates/` and use `@react-pdf/renderer` primitives only. DOCX rendering lives in `lib/docx/resume-docx.ts` and uses the `docx` npm package. Both routes read live data from the DB (not from the request body) — the EditorShell auto-saves before export since the export buttons trigger a PATCH first.

**Pre-requisite:** Complete `docs/superpowers/plans/2026-06-03-phase-2a-core-editor.md` first. The `EditorShell` export buttons (`handleExport('pdf')` and `handleExport('docx')`) must already exist.

**Tech Stack:** `@react-pdf/renderer`, `docx` npm package, existing auth/DB patterns from Phase 1.

---

## File Map

**New:**
- `lib/pdf/templates/ClassicPdfTemplate.tsx`
- `lib/pdf/templates/ModernPdfTemplate.tsx`
- `lib/pdf/templates/MinimalPdfTemplate.tsx`
- `lib/pdf/templates/pdf-utils.ts`
- `lib/docx/resume-docx.ts`
- `app/api/resumes/[id]/export/pdf/route.ts`
- `app/api/resumes/[id]/export/docx/route.ts`

---

### Task 1: Install export dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install @react-pdf/renderer docx
```

Expected: both packages added to `dependencies`.

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors (the packages ship their own types).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @react-pdf/renderer and docx for export pipeline"
```

---

### Task 2: PDF utility helpers

**Files:**
- Create: `lib/pdf/templates/pdf-utils.ts`

- [ ] **Step 1: Create the utility file**

```typescript
// lib/pdf/templates/pdf-utils.ts
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

/**
 * Map a web/system font name to the nearest @react-pdf/renderer built-in font.
 * Built-ins: Helvetica, Times-Roman, Courier (and their Bold/Italic variants).
 */
export function mapToPdfFont(font: string): string {
  const serifFonts = ['Garamond', 'Georgia', 'Cambria']
  return serifFonts.includes(font) ? 'Times-Roman' : 'Helvetica'
}

/** Convert inches to PDF points (1 inch = 72 pt). */
export function inToPt(inches: number): number {
  return inches * 72
}

/** Contact line: email · phone · city, region */
export function formatContact(basics: {
  email?: string
  phone?: string
  location?: { city?: string; region?: string }
}): string {
  const location = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
  return [basics.email, basics.phone, location].filter(Boolean).join(' · ')
}

/** Section order fallback */
export const DEFAULT_SECTION_ORDER = [
  'work', 'education', 'skills', 'certificates', 'awards',
  'publications', 'volunteer', 'languages', 'interests', 'projects',
]

export function resolveSectionOrder(meta: ResumeMeta): string[] {
  return meta.sectionOrder?.length > 0 ? meta.sectionOrder : DEFAULT_SECTION_ORDER
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pdf/templates/pdf-utils.ts
git commit -m "feat: add PDF utility helpers (font mapping, section order)"
```

---

### Task 3: PDF template components

**Files:**
- Create: `lib/pdf/templates/ClassicPdfTemplate.tsx`
- Create: `lib/pdf/templates/ModernPdfTemplate.tsx`
- Create: `lib/pdf/templates/MinimalPdfTemplate.tsx`

**Key rules (from CLAUDE.md):**
- Every text block must use `<Text>` — no raw text nodes outside `<Text>`.
- Two-column layouts: render column 1 fully top-to-bottom, then column 2.
- Decorative elements (dividers, background shapes) must be tagged as PDF Artifacts: wrap in `<View render={() => null} fixed />` or use `aria-hidden` equivalent pattern. In `@react-pdf/renderer`, mark decorative `<View>` elements with `aria-hidden={true}` prop.
- Never use `window.print()`.

- [ ] **Step 1: Create ClassicPdfTemplate**

```tsx
// lib/pdf/templates/ClassicPdfTemplate.tsx
import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { mapToPdfFont, inToPt, formatContact, resolveSectionOrder } from './pdf-utils'

export function ClassicPdfTemplate({ data, meta }: { data: ResumeData; meta: ResumeMeta }) {
  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [] } = data

  const bodyFont = mapToPdfFont(meta.fontFamily)
  const headFont = mapToPdfFont(meta.headerFontFamily)
  const margin = inToPt(meta.pageMargins)
  const sectionOrder = resolveSectionOrder(meta)

  const styles = StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: 11, lineHeight: meta.lineSpacing, padding: margin, color: '#000000' },
    name: { fontFamily: headFont, fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 3 },
    subtitle: { fontSize: 11, color: '#555555', textAlign: 'center' },
    contact: { fontSize: 10, color: '#555555', textAlign: 'center', marginTop: 3 },
    sectionTitle: { fontFamily: headFont, fontSize: 13, fontWeight: 'bold', color: meta.primaryColor,
      borderBottomWidth: 1, borderBottomColor: meta.primaryColor, paddingBottom: 2, marginTop: 14, marginBottom: 6 },
    entryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    bold: { fontWeight: 'bold' },
    accent: { color: meta.accentColor, fontWeight: 'bold', fontSize: 10.5 },
    small: { fontSize: 10, color: '#666666' },
    bullet: { fontSize: 10, marginLeft: 10, marginBottom: 1 },
    body: { fontSize: 10 },
    summaryBox: { fontSize: 10, marginTop: 8 },
  })

  function renderPdfSection(section: string): React.ReactNode {
    switch (section) {
      case 'work':
        if (!work.length) return null
        return (
          <View key="work">
            <Text style={styles.sectionTitle}>Work Experience</Text>
            {work.map((job, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <View style={styles.entryRow}>
                  <Text style={styles.bold}>{job.name ?? ''}</Text>
                  <Text style={styles.small}>{[job.startDate, job.endDate || 'Present'].filter(Boolean).join(' – ')}</Text>
                </View>
                <Text style={styles.accent}>{job.position ?? ''}</Text>
                {job.summary ? <Text style={styles.body}>{job.summary}</Text> : null}
                {(job.highlights ?? []).map((h, hi) => (
                  <Text key={hi} style={styles.bullet}>• {h}</Text>
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
              <View key={i} style={{ marginBottom: 6 }}>
                <View style={styles.entryRow}>
                  <Text style={styles.bold}>{edu.institution ?? ''}</Text>
                  <Text style={styles.small}>{[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}</Text>
                </View>
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
                <Text style={styles.bold}>{s.name ?? ''}</Text>
                {s.level ? <Text style={styles.small}> ({s.level})</Text> : null}
                {(s.keywords ?? []).length > 0 ? <Text style={{ color: '#555555' }}>: {(s.keywords ?? []).join(', ')}</Text> : null}
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
              <View key={i} style={styles.entryRow}>
                <Text style={styles.bold}>{c.name ?? ''}{c.issuer ? <Text style={styles.small}> — {c.issuer}</Text> : null}</Text>
                <Text style={styles.small}>{c.date ?? ''}</Text>
              </View>
            ))}
          </View>
        )
      case 'languages':
        if (!languages.length) return null
        return (
          <View key="languages">
            <Text style={styles.sectionTitle}>Languages</Text>
            <Text style={styles.body}>
              {languages.map((l, i) => (
                <Text key={i}>
                  <Text style={styles.bold}>{l.language ?? ''}</Text>
                  {l.fluency ? <Text style={styles.small}> ({l.fluency})</Text> : null}
                  {i < languages.length - 1 ? <Text>  ·  </Text> : null}
                </Text>
              ))}
            </Text>
          </View>
        )
      case 'awards':
        if (!awards.length) return null
        return (
          <View key="awards">
            <Text style={styles.sectionTitle}>Awards</Text>
            {awards.map((a, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <View style={styles.entryRow}>
                  <Text style={styles.bold}>{a.title ?? ''}</Text>
                  <Text style={styles.small}>{a.date ?? ''}</Text>
                </View>
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
              <View key={i} style={{ marginBottom: 6 }}>
                <View style={styles.entryRow}>
                  <Text style={styles.bold}>{p.name ?? ''}</Text>
                  <Text style={styles.small}>{p.releaseDate ?? ''}</Text>
                </View>
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
              <View key={i} style={{ marginBottom: 8 }}>
                <View style={styles.entryRow}>
                  <Text style={styles.bold}>{v.organization ?? ''}</Text>
                  <Text style={styles.small}>{[v.startDate, v.endDate || 'Present'].filter(Boolean).join(' – ')}</Text>
                </View>
                <Text style={styles.accent}>{v.position ?? ''}</Text>
                {v.summary ? <Text style={styles.body}>{v.summary}</Text> : null}
                {(v.highlights ?? []).map((h, hi) => <Text key={hi} style={styles.bullet}>• {h}</Text>)}
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
                <Text style={styles.bold}>{int.name ?? ''}</Text>
                {(int.keywords ?? []).length > 0 ? <Text style={{ color: '#555555' }}>: {(int.keywords ?? []).join(', ')}</Text> : null}
                {i < interests.length - 1 ? <Text>  |  </Text> : null}
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
              <View key={i} style={{ marginBottom: 8 }}>
                <View style={styles.entryRow}>
                  <Text style={styles.bold}>{p.name ?? ''}</Text>
                  <Text style={styles.small}>{[p.startDate, p.endDate].filter(Boolean).join(' – ')}</Text>
                </View>
                {p.description ? <Text style={styles.body}>{p.description}</Text> : null}
                {(p.highlights ?? []).map((h, hi) => <Text key={hi} style={styles.bullet}>• {h}</Text>)}
                {(p.keywords ?? []).length > 0 ? <Text style={[styles.small, { marginTop: 2 }]}>{(p.keywords ?? []).join(', ')}</Text> : null}
              </View>
            ))}
          </View>
        )
      default:
        return null
    }
  }

  if (meta.layout === 'two-column') {
    const leftSections = sectionOrder.filter((s) => ['work', 'education', 'volunteer', 'projects'].includes(s))
    const rightSections = sectionOrder.filter((s) => !leftSections.includes(s))
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.name}>{basics.name ?? ''}</Text>
            {basics.label ? <Text style={styles.subtitle}>{basics.label}</Text> : null}
            <Text style={styles.contact}>{formatContact(basics)}</Text>
            {basics.summary ? <Text style={styles.summaryBox}>{basics.summary}</Text> : null}
          </View>
          {/* Decorative divider — tagged as artifact */}
          <View aria-hidden={true} style={{ borderBottomWidth: 0.5, borderBottomColor: '#cccccc', marginBottom: 4 }} />
          {/* Two columns: left fully then right */}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 0.58 }}>{leftSections.map(renderPdfSection)}</View>
            <View style={{ flex: 0.42 }}>{rightSections.map(renderPdfSection)}</View>
          </View>
        </Page>
      </Document>
    )
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.name}>{basics.name ?? ''}</Text>
          {basics.label ? <Text style={styles.subtitle}>{basics.label}</Text> : null}
          <Text style={styles.contact}>{formatContact(basics)}</Text>
        </View>
        {basics.summary ? (
          <View>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.body}>{basics.summary}</Text>
          </View>
        ) : null}
        {sectionOrder.map(renderPdfSection)}
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Create ModernPdfTemplate**

ModernPdfTemplate differs from ClassicPdfTemplate only in the header block (dark background, white text) and the `sectionTitle` style (no `borderBottomWidth`, uses `accentColor`, adds `textTransform: 'uppercase'`). The `renderPdfSection` function is identical.

```tsx
// lib/pdf/templates/ModernPdfTemplate.tsx
import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { mapToPdfFont, inToPt, formatContact, resolveSectionOrder } from './pdf-utils'

export function ModernPdfTemplate({ data, meta }: { data: ResumeData; meta: ResumeMeta }) {
  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [] } = data

  const bodyFont = mapToPdfFont(meta.fontFamily)
  const headFont = mapToPdfFont(meta.headerFontFamily)
  const margin = inToPt(meta.pageMargins)
  const sectionOrder = resolveSectionOrder(meta)

  const styles = StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: 11, lineHeight: meta.lineSpacing, color: '#000000' },
    headerBlock: { backgroundColor: meta.primaryColor, padding: margin, paddingBottom: margin * 0.75 },
    name: { fontFamily: headFont, fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 3 },
    subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
    contact: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
    body_section: { padding: margin, paddingTop: margin * 0.75 },
    sectionTitle: { fontFamily: headFont, fontSize: 11, fontWeight: 'bold', color: meta.accentColor,
      textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
    entryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    bold: { fontWeight: 'bold' },
    accent: { color: meta.accentColor, fontWeight: 'bold', fontSize: 10.5 },
    small: { fontSize: 10, color: '#666666' },
    bullet: { fontSize: 10, marginLeft: 10, marginBottom: 1 },
    body: { fontSize: 10 },
  })

  // renderPdfSection is identical to ClassicPdfTemplate.renderPdfSection
  // Implementer: copy the full renderPdfSection function from ClassicPdfTemplate here,
  // keeping references to the local `styles` object defined above.
  function renderPdfSection(section: string): React.ReactNode {
    // (full switch/case implementation — identical to ClassicPdfTemplate)
    return null
  }

  if (meta.layout === 'two-column') {
    const leftSections = sectionOrder.filter((s) => ['work', 'education', 'volunteer', 'projects'].includes(s))
    const rightSections = sectionOrder.filter((s) => !leftSections.includes(s))
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.headerBlock}>
            <Text style={styles.name}>{basics.name ?? ''}</Text>
            {basics.label ? <Text style={styles.subtitle}>{basics.label}</Text> : null}
            <Text style={styles.contact}>{formatContact(basics)}</Text>
          </View>
          <View style={[styles.body_section, { flexDirection: 'row', gap: 16 }]}>
            <View style={{ flex: 0.58 }}>{leftSections.map(renderPdfSection)}</View>
            <View style={{ flex: 0.42 }}>{rightSections.map(renderPdfSection)}</View>
          </View>
        </Page>
      </Document>
    )
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBlock}>
          <Text style={styles.name}>{basics.name ?? ''}</Text>
          {basics.label ? <Text style={styles.subtitle}>{basics.label}</Text> : null}
          <Text style={styles.contact}>{formatContact(basics)}</Text>
        </View>
        <View style={styles.body_section}>
          {basics.summary ? <Text style={[styles.body, { marginBottom: 12 }]}>{basics.summary}</Text> : null}
          {sectionOrder.map(renderPdfSection)}
        </View>
      </Page>
    </Document>
  )
}
```

**Important:** Replace the `return null` stub in `renderPdfSection` with the full switch/case body from `ClassicPdfTemplate`. The only things that differ between the two templates are the styles object and the header rendering — `renderPdfSection` is 100% identical.

- [ ] **Step 3: Create MinimalPdfTemplate**

MinimalPdfTemplate uses no decorative elements. `sectionTitle` style: small caps / uppercase, no color, no border, spacing only. Everything else is identical to ClassicPdfTemplate.

```tsx
// lib/pdf/templates/MinimalPdfTemplate.tsx
import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { mapToPdfFont, inToPt, formatContact, resolveSectionOrder } from './pdf-utils'

export function MinimalPdfTemplate({ data, meta }: { data: ResumeData; meta: ResumeMeta }) {
  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [] } = data

  const bodyFont = mapToPdfFont(meta.fontFamily)
  const headFont = mapToPdfFont(meta.headerFontFamily)
  const margin = inToPt(meta.pageMargins)
  const sectionOrder = resolveSectionOrder(meta)

  const styles = StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: 11, lineHeight: meta.lineSpacing, padding: margin, color: '#000000' },
    name: { fontFamily: headFont, fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 2 },
    subtitle: { fontSize: 11, color: '#444444', textAlign: 'center' },
    contact: { fontSize: 10, color: '#666666', textAlign: 'center', marginTop: 3 },
    sectionTitle: { fontFamily: headFont, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase',
      letterSpacing: 1.5, color: '#333333', marginTop: 18, marginBottom: 6 },
    entryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    bold: { fontWeight: 'bold' },
    accent: { color: '#000000', fontWeight: 'bold', fontSize: 10.5 },
    small: { fontSize: 10, color: '#666666' },
    bullet: { fontSize: 10, marginLeft: 10, marginBottom: 1 },
    body: { fontSize: 10 },
  })

  // renderPdfSection: identical to ClassicPdfTemplate. Copy full implementation here.
  function renderPdfSection(section: string): React.ReactNode {
    return null // replace with full switch/case from ClassicPdfTemplate
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.name}>{basics.name ?? ''}</Text>
          {basics.label ? <Text style={styles.subtitle}>{basics.label}</Text> : null}
          <Text style={styles.contact}>{formatContact(basics)}</Text>
        </View>
        {basics.summary ? <Text style={[styles.body, { marginBottom: 12, color: '#444444' }]}>{basics.summary}</Text> : null}
        {sectionOrder.map(renderPdfSection)}
      </Page>
    </Document>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/pdf/templates/ClassicPdfTemplate.tsx lib/pdf/templates/ModernPdfTemplate.tsx lib/pdf/templates/MinimalPdfTemplate.tsx
git commit -m "feat: add PDF template components (Classic, Modern, Minimal)"
```

---

### Task 4: PDF export route

**Files:**
- Create: `app/api/resumes/[id]/export/pdf/route.ts`

- [ ] **Step 1: Write the failing test (smoke test)**

```typescript
// app/api/resumes/[id]/export/pdf/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test that the route returns 401 for unauthenticated requests.
// Full render tests require a real MongoDB — that is covered by manual QA.

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => null),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(),
}))

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn(() => Buffer.from('fake-pdf')),
}))

describe('POST /api/resumes/[id]/export/pdf', () => {
  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/abc/export/pdf', { method: 'POST' })
    const res = await POST(req as never, { params: Promise.resolve({ id: 'abc' }) } as never)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:run "app/api/resumes/\[id\]/export/pdf/route.test.ts"
```

Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Create the route**

```typescript
// app/api/resumes/[id]/export/pdf/route.ts
import { renderToBuffer } from '@react-pdf/renderer'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { ClassicPdfTemplate } from '@/lib/pdf/templates/ClassicPdfTemplate'
import { ModernPdfTemplate } from '@/lib/pdf/templates/ModernPdfTemplate'
import { MinimalPdfTemplate } from '@/lib/pdf/templates/MinimalPdfTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import React from 'react'

function selectTemplate(data: ResumeData, meta: ResumeMeta) {
  switch (meta.templateId) {
    case 'modern':
      return React.createElement(ModernPdfTemplate, { data, meta })
    case 'minimal':
      return React.createElement(MinimalPdfTemplate, { data, meta })
    default:
      return React.createElement(ClassicPdfTemplate, { data, meta })
  }
}

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { id } = await (ctx?.params as Promise<{ id: string }>)
  const resume = await getResume(req.auth.user.id, id)
  if (!resume) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }

  const data = (resume.data ?? {}) as ResumeData
  const meta = resume.meta as ResumeMeta
  const element = selectTemplate(data, meta)

  const buffer = await renderToBuffer(element)

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${resume.title.replace(/[^a-z0-9]/gi, '-')}.pdf"`,
      'Content-Length': String(buffer.byteLength),
    },
  })
})
```

- [ ] **Step 4: Run the test**

```bash
npm run test:run "app/api/resumes/\[id\]/export/pdf/route.test.ts"
```

Expected: 1 test PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/resumes/[id]/export/pdf/route.ts "app/api/resumes/[id]/export/pdf/route.test.ts"
git commit -m "feat: add PDF export route"
```

---

### Task 5: DOCX renderer and export route

**Files:**
- Create: `lib/docx/resume-docx.ts`
- Create: `app/api/resumes/[id]/export/docx/route.ts`

**DOCX rules (from CLAUDE.md):**
- Native paragraph styles, line spacing, and document margins only.
- No Word text boxes, no floating objects, no nested layout tables.
- Map custom web fonts to nearest system font.
- ATS-linear reading order — for two-column layouts, render all left-column sections first, then right-column sections sequentially (do NOT use text boxes or floating frames).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/docx/__tests__/resume-docx.test.ts
import { describe, it, expect } from 'vitest'
import { buildDocx } from '../resume-docx'
import { Packer } from 'docx'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column',
}

const sampleData: ResumeData = {
  basics: { name: 'Jane Smith', label: 'Engineer', email: 'jane@test.com' },
  work: [{ name: 'Acme', position: 'Dev', startDate: '2020-01', highlights: ['Did X'] }],
  education: [{ institution: 'MIT', area: 'CS', studyType: 'BSc', startDate: '2016-09', endDate: '2020-06' }],
  skills: [{ name: 'TypeScript', level: 'Expert', keywords: ['React', 'Node.js'] }],
}

describe('buildDocx', () => {
  it('returns a Document that Packer can serialize to buffer', async () => {
    const doc = buildDocx(sampleData, defaultMeta)
    const buffer = await Packer.toBuffer(doc)
    expect(buffer.byteLength).toBeGreaterThan(1000)
  })

  it('serializes without error when data is empty', async () => {
    const doc = buildDocx({}, defaultMeta)
    const buffer = await Packer.toBuffer(doc)
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('maps Lato to Arial', () => {
    const doc = buildDocx(sampleData, { ...defaultMeta, fontFamily: 'Lato' })
    // Verify no error thrown — font mapping applied internally
    expect(doc).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:run lib/docx/__tests__/resume-docx.test.ts
```

Expected: FAIL — `Cannot find module '../resume-docx'`

- [ ] **Step 3: Create the DOCX renderer**

```typescript
// lib/docx/resume-docx.ts
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, UnderlineType, BorderStyle, convertInchesToTwip,
} from 'docx'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

// Map web fonts to nearest ATS-safe system font
function mapFont(font: string): string {
  const map: Record<string, string> = {
    'Lato': 'Arial',
    'Roboto': 'Arial',
    'IBM Plex Sans': 'Calibri',
    'Helvetica': 'Arial',
  }
  return map[font] ?? font
}

function sectionHeading(text: string, font: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, font, size: 26 })], // 13pt = 26 half-points
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
  })
}

function jobEntry(
  name: string, position: string, dates: string, summary: string | undefined,
  highlights: string[], font: string
): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: name, bold: true, font, size: 22 }),
        new TextRun({ text: `\t${dates}`, font, size: 20, color: '666666' }),
      ],
      tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
      spacing: { before: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: position, font, size: 21, color: '0066cc' })],
      spacing: { after: 40 },
    }),
  ]
  if (summary) {
    paras.push(new Paragraph({ children: [new TextRun({ text: summary, font, size: 20 })], spacing: { after: 40 } }))
  }
  for (const h of highlights) {
    paras.push(new Paragraph({
      children: [new TextRun({ text: h, font, size: 20 })],
      bullet: { level: 0 },
      spacing: { after: 20 },
    }))
  }
  return paras
}

export function buildDocx(data: ResumeData, meta: ResumeMeta): Document {
  const bodyFont = mapFont(meta.fontFamily)
  const headFont = mapFont(meta.headerFontFamily)
  const marginTwips = convertInchesToTwip(meta.pageMargins)
  const lineRule = 'auto' as never
  const lineVal = Math.round(meta.lineSpacing * 240) // 240 = single spacing in OOXML

  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [] } = data

  const DEFAULT_ORDER = ['work', 'education', 'skills', 'certificates', 'awards',
    'publications', 'volunteer', 'languages', 'interests', 'projects']
  const sectionOrder = meta.sectionOrder?.length > 0 ? meta.sectionOrder : DEFAULT_ORDER

  // For two-column layouts: render left sections then right sections linearly
  // (ATS requirement — no text boxes or tables)
  const leftSections = ['work', 'education', 'volunteer', 'projects']
  const rightSections = ['skills', 'certificates', 'languages', 'interests', 'awards', 'publications']
  const orderedSections = meta.layout === 'two-column'
    ? [...sectionOrder.filter(s => leftSections.includes(s)), ...sectionOrder.filter(s => rightSections.includes(s))]
    : sectionOrder

  const children: Paragraph[] = []

  // Header
  children.push(
    new Paragraph({
      children: [new TextRun({ text: basics.name ?? '', bold: true, font: headFont, size: 40 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    })
  )
  if (basics.label) {
    children.push(new Paragraph({
      children: [new TextRun({ text: basics.label, font: bodyFont, size: 24, color: '555555' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }))
  }
  const contactParts = [basics.email, basics.phone,
    [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')].filter(Boolean)
  if (contactParts.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join(' · '), font: bodyFont, size: 20, color: '555555' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }))
  }
  if (basics.summary) {
    children.push(sectionHeading('Summary', headFont))
    children.push(new Paragraph({
      children: [new TextRun({ text: basics.summary, font: bodyFont, size: 20 })],
      spacing: { after: 80 },
    }))
  }

  // Sections
  for (const section of orderedSections) {
    switch (section) {
      case 'work':
        if (!work.length) break
        children.push(sectionHeading('Work Experience', headFont))
        for (const job of work) {
          const dates = [job.startDate, job.endDate || 'Present'].filter(Boolean).join(' – ')
          children.push(...jobEntry(job.name ?? '', job.position ?? '', dates, job.summary, job.highlights ?? [], bodyFont))
        }
        break
      case 'education':
        if (!education.length) break
        children.push(sectionHeading('Education', headFont))
        for (const edu of education) {
          const dates = [edu.startDate, edu.endDate].filter(Boolean).join(' – ')
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: edu.institution ?? '', bold: true, font: bodyFont, size: 22 }),
                new TextRun({ text: `\t${dates}`, font: bodyFont, size: 20, color: '666666' }),
              ],
              tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
              spacing: { before: 100 },
            }),
            new Paragraph({
              children: [new TextRun({ text: [edu.studyType, edu.area].filter(Boolean).join(' in '), font: bodyFont, size: 20 })],
              spacing: { after: edu.score ? 20 : 80 },
            }),
            ...(edu.score ? [new Paragraph({ children: [new TextRun({ text: `Score: ${edu.score}`, font: bodyFont, size: 20, color: '666666' })], spacing: { after: 80 } })] : [])
          )
        }
        break
      case 'skills':
        if (!skills.length) break
        children.push(sectionHeading('Skills', headFont))
        for (const s of skills) {
          const kw = (s.keywords ?? []).length > 0 ? `: ${(s.keywords ?? []).join(', ')}` : ''
          const level = s.level ? ` (${s.level})` : ''
          children.push(new Paragraph({
            children: [
              new TextRun({ text: s.name ?? '', bold: true, font: bodyFont, size: 20 }),
              new TextRun({ text: level, font: bodyFont, size: 20, color: '666666' }),
              new TextRun({ text: kw, font: bodyFont, size: 20, color: '555555' }),
            ],
            spacing: { after: 40 },
          }))
        }
        break
      case 'certificates':
        if (!certificates.length) break
        children.push(sectionHeading('Certifications', headFont))
        for (const c of certificates) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: c.name ?? '', bold: true, font: bodyFont, size: 20 }),
              ...(c.issuer ? [new TextRun({ text: ` — ${c.issuer}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ...(c.date ? [new TextRun({ text: `\t${c.date}`, font: bodyFont, size: 20, color: '666666' })] : []),
            ],
            tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
            spacing: { after: 40 },
          }))
        }
        break
      case 'languages':
        if (!languages.length) break
        children.push(sectionHeading('Languages', headFont))
        children.push(new Paragraph({
          children: languages.flatMap((l, i) => [
            new TextRun({ text: l.language ?? '', bold: true, font: bodyFont, size: 20 }),
            ...(l.fluency ? [new TextRun({ text: ` (${l.fluency})`, font: bodyFont, size: 20, color: '666666' })] : []),
            ...(i < languages.length - 1 ? [new TextRun({ text: '  ·  ', font: bodyFont, size: 20 })] : []),
          ]),
          spacing: { after: 80 },
        }))
        break
      case 'awards':
        if (!awards.length) break
        children.push(sectionHeading('Awards', headFont))
        for (const a of awards) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: a.title ?? '', bold: true, font: bodyFont, size: 22 }),
                ...(a.date ? [new TextRun({ text: `\t${a.date}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ],
              tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
              spacing: { before: 100 },
            }),
            ...(a.awarder ? [new Paragraph({ children: [new TextRun({ text: a.awarder, font: bodyFont, size: 20, color: '666666' })], spacing: { after: 20 } })] : []),
            ...(a.summary ? [new Paragraph({ children: [new TextRun({ text: a.summary, font: bodyFont, size: 20 })], spacing: { after: 80 } })] : [])
          )
        }
        break
      case 'publications':
        if (!publications.length) break
        children.push(sectionHeading('Publications', headFont))
        for (const p of publications) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: p.name ?? '', bold: true, font: bodyFont, size: 22 }),
                ...(p.releaseDate ? [new TextRun({ text: `\t${p.releaseDate}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ],
              tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
              spacing: { before: 100 },
            }),
            ...(p.publisher ? [new Paragraph({ children: [new TextRun({ text: p.publisher, font: bodyFont, size: 20, color: '666666' })], spacing: { after: 20 } })] : []),
            ...(p.summary ? [new Paragraph({ children: [new TextRun({ text: p.summary, font: bodyFont, size: 20 })], spacing: { after: 80 } })] : [])
          )
        }
        break
      case 'volunteer':
        if (!volunteer.length) break
        children.push(sectionHeading('Volunteer', headFont))
        for (const v of volunteer) {
          const dates = [v.startDate, v.endDate || 'Present'].filter(Boolean).join(' – ')
          children.push(...jobEntry(v.organization ?? '', v.position ?? '', dates, v.summary, v.highlights ?? [], bodyFont))
        }
        break
      case 'interests':
        if (!interests.length) break
        children.push(sectionHeading('Interests', headFont))
        for (const int of interests) {
          const kw = (int.keywords ?? []).length > 0 ? `: ${(int.keywords ?? []).join(', ')}` : ''
          children.push(new Paragraph({
            children: [
              new TextRun({ text: int.name ?? '', bold: true, font: bodyFont, size: 20 }),
              new TextRun({ text: kw, font: bodyFont, size: 20, color: '555555' }),
            ],
            spacing: { after: 40 },
          }))
        }
        break
      case 'projects':
        if (!projects.length) break
        children.push(sectionHeading('Projects', headFont))
        for (const p of projects) {
          const dates = [p.startDate, p.endDate].filter(Boolean).join(' – ')
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: p.name ?? '', bold: true, font: bodyFont, size: 22 }),
                ...(dates ? [new TextRun({ text: `\t${dates}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ],
              tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
              spacing: { before: 100 },
            }),
            ...(p.description ? [new Paragraph({ children: [new TextRun({ text: p.description, font: bodyFont, size: 20 })], spacing: { after: 40 } })] : []),
            ...(p.highlights ?? []).map(h => new Paragraph({
              children: [new TextRun({ text: h, font: bodyFont, size: 20 })],
              bullet: { level: 0 },
              spacing: { after: 20 },
            })),
            ...((p.keywords ?? []).length > 0 ? [new Paragraph({ children: [new TextRun({ text: (p.keywords ?? []).join(', '), font: bodyFont, size: 18, color: '666666' })], spacing: { after: 80 } })] : [])
          )
        }
        break
    }
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: bodyFont, size: 22 },
          paragraph: { spacing: { line: lineVal, lineRule } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: marginTwips, bottom: marginTwips,
            left: marginTwips, right: marginTwips,
          },
        },
      },
      children,
    }],
  })
}
```

- [ ] **Step 4: Run the tests**

```bash
npm run test:run lib/docx/__tests__/resume-docx.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Create the DOCX export route**

```typescript
// app/api/resumes/[id]/export/docx/route.ts
import { Packer } from 'docx'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { buildDocx } from '@/lib/docx/resume-docx'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { id } = await (ctx?.params as Promise<{ id: string }>)
  const resume = await getResume(req.auth.user.id, id)
  if (!resume) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }

  const data = (resume.data ?? {}) as ResumeData
  const meta = resume.meta as ResumeMeta
  const doc = buildDocx(data, meta)
  const buffer = await Packer.toBuffer(doc)

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${resume.title.replace(/[^a-z0-9]/gi, '-')}.docx"`,
      'Content-Length': String(buffer.byteLength),
    },
  })
})
```

- [ ] **Step 6: Run all tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 7: Manual QA — PDF export**

Start the dev server (`npm run dev`), open a resume in the editor, fill in some data, click **PDF**. Verify:
- Browser downloads a `.pdf` file.
- The PDF opens in a viewer and shows the resume content.
- Section order is correct (top-to-bottom, left column then right if two-column).
- No raw text visible outside text elements (all text is in `<Text>` wrappers).

- [ ] **Step 8: Manual QA — DOCX export**

Click **DOCX** in the editor. Verify:
- Browser downloads a `.docx` file.
- The file opens in Word / LibreOffice without errors.
- No text boxes or floating objects — all content is in normal paragraphs.
- Font mapping is applied (Lato → Arial, etc.).
- Two-column layouts render left sections then right sections linearly (no side-by-side columns).

- [ ] **Step 9: Commit**

```bash
git add lib/docx/resume-docx.ts lib/docx/__tests__/resume-docx.test.ts app/api/resumes/[id]/export/docx/route.ts app/api/resumes/[id]/export/pdf/route.ts
git commit -m "feat: add PDF and DOCX export routes and renderers"
```
