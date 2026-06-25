# ATS Export Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix ATS parsing failures in designed PDF and DOCX exports by inlining contact rows and entryRows, and unify the Sidebar template's hardcoded rail sections into the configurable column-assignment system shared by all two-column templates.

**Architecture:** Three tracks executed in order: (1) extend `getColumnSide` with sidebar defaults; (2) fix PDF contact rows and entryRows across all 5 templates; (3) extract `buildRailParas` from the DOCX sidebar block and fold it into the unified two-column Table path, wiring it to `columnAssignment`. Each track is independently committed and tested.

**Tech Stack:** `@react-pdf/renderer` v4.5.1 for PDF templates, `docx` npm package for DOCX generation, Vitest for tests (`npm run test:run`).

---

## File Map

| File | Change |
|---|---|
| `lib/get-column-side.ts` | Add `SIDEBAR_COLUMN_DEFAULTS`, optional `templateDefaults` param |
| `lib/__tests__/get-column-side.test.ts` | New tests for sidebar defaults |
| `lib/pdf/templates/ClassicPdfTemplate.tsx` | `buildContactRow` inline; entryRow → inline text in every section |
| `lib/pdf/templates/ModernPdfTemplate.tsx` | Same as Classic (white-on-dark colors) |
| `lib/pdf/templates/ExecutivePdfTemplate.tsx` | Same as Classic (`\|` separator) |
| `lib/pdf/templates/MinimalPdfTemplate.tsx` | Same as Classic (`#777` color) |
| `lib/pdf/templates/SidebarPdfTemplate.tsx` | entryRow fix in `renderMainSection`; expand `renderRailSection` to all types; replace `RAIL_SECTIONS` with `getColumnSide` |
| `components/templates/SidebarTemplate.tsx` | Replace `RAIL_SECTIONS` with `getColumnSide` |
| `lib/docx/resume-docx.ts` | Extract `buildRailParas`; replace sidebar early-return with unified version using `SIDEBAR_COLUMN_DEFAULTS` |
| `lib/docx/__tests__/resume-docx.test.ts` | New tests for sidebar `columnAssignment` |

---

## Task 1: Extend `getColumnSide` with sidebar defaults

**Files:**
- Modify: `lib/get-column-side.ts`
- Modify: `lib/__tests__/get-column-side.test.ts`

- [ ] **Step 1.1: Write the failing tests**

Add to `lib/__tests__/get-column-side.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getColumnSide, SIDEBAR_COLUMN_DEFAULTS } from '../get-column-side'

describe('getColumnSide', () => {
  it('returns left for work by default', () => {
    expect(getColumnSide('work', {})).toBe('left')
  })
  it('returns left for education by default', () => {
    expect(getColumnSide('education', {})).toBe('left')
  })
  it('returns left for volunteer by default', () => {
    expect(getColumnSide('volunteer', {})).toBe('left')
  })
  it('returns right for skills by default', () => {
    expect(getColumnSide('skills', {})).toBe('right')
  })
  it('returns right for languages by default', () => {
    expect(getColumnSide('languages', {})).toBe('right')
  })
  it('returns left for custom sections by default', () => {
    expect(getColumnSide('custom:abc123', {})).toBe('left')
  })
  it('honours explicit left override', () => {
    expect(getColumnSide('skills', { skills: 'left' })).toBe('left')
  })
  it('honours explicit right override on a default-left section', () => {
    expect(getColumnSide('work', { work: 'right' })).toBe('right')
  })
  it('honours explicit right override on a custom section', () => {
    expect(getColumnSide('custom:abc123', { 'custom:abc123': 'right' })).toBe('right')
  })

  // Sidebar defaults
  describe('with SIDEBAR_COLUMN_DEFAULTS', () => {
    it('SIDEBAR_COLUMN_DEFAULTS puts skills on left', () => {
      expect(SIDEBAR_COLUMN_DEFAULTS.skills).toBe('left')
    })
    it('SIDEBAR_COLUMN_DEFAULTS puts languages on left', () => {
      expect(SIDEBAR_COLUMN_DEFAULTS.languages).toBe('left')
    })
    it('skills defaults to left with sidebar templateDefaults', () => {
      expect(getColumnSide('skills', {}, SIDEBAR_COLUMN_DEFAULTS)).toBe('left')
    })
    it('languages defaults to left with sidebar templateDefaults', () => {
      expect(getColumnSide('languages', {}, SIDEBAR_COLUMN_DEFAULTS)).toBe('left')
    })
    it('work defaults to right with sidebar templateDefaults', () => {
      expect(getColumnSide('work', {}, SIDEBAR_COLUMN_DEFAULTS)).toBe('right')
    })
    it('education defaults to right with sidebar templateDefaults', () => {
      expect(getColumnSide('education', {}, SIDEBAR_COLUMN_DEFAULTS)).toBe('right')
    })
    it('explicit columnAssignment overrides sidebar defaults', () => {
      expect(getColumnSide('skills', { skills: 'right' }, SIDEBAR_COLUMN_DEFAULTS)).toBe('right')
      expect(getColumnSide('work', { work: 'left' }, SIDEBAR_COLUMN_DEFAULTS)).toBe('left')
    })
    it('unassigned section not in SIDEBAR_COLUMN_DEFAULTS falls back to right', () => {
      expect(getColumnSide('certificates', {}, SIDEBAR_COLUMN_DEFAULTS)).toBe('right')
    })
  })
})
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```
npm run test:run -- lib/__tests__/get-column-side.test.ts
```

Expected: failures on all `SIDEBAR_COLUMN_DEFAULTS` tests (`SIDEBAR_COLUMN_DEFAULTS is not exported`, `getColumnSide is not a function` with 3 args).

- [ ] **Step 1.3: Implement**

Replace `lib/get-column-side.ts` entirely:

```ts
const LEFT_DEFAULTS = new Set(['work', 'education', 'volunteer'])

export const SIDEBAR_COLUMN_DEFAULTS: Record<string, 'left' | 'right'> = {
  skills: 'left',
  languages: 'left',
}

export function getColumnSide(
  section: string,
  columnAssignment: Record<string, 'left' | 'right'>,
  templateDefaults?: Record<string, 'left' | 'right'>,
): 'left' | 'right' {
  if (columnAssignment[section]) return columnAssignment[section]
  if (templateDefaults) return templateDefaults[section] ?? 'right'
  if (LEFT_DEFAULTS.has(section) || section.startsWith('custom:')) return 'left'
  return 'right'
}
```

- [ ] **Step 1.4: Run tests to confirm all pass**

```
npm run test:run -- lib/__tests__/get-column-side.test.ts
```

Expected: all 17 tests pass.

- [ ] **Step 1.5: Commit**

```
git add lib/get-column-side.ts lib/__tests__/get-column-side.test.ts
git commit -m "feat: add SIDEBAR_COLUMN_DEFAULTS and optional templateDefaults to getColumnSide"
```

---

## Task 2: PDF Classic — contact row inline + entryRow inline

**Files:**
- Modify: `lib/pdf/templates/ClassicPdfTemplate.tsx`

- [ ] **Step 2.1: Run baseline tests**

```
npm run test:run -- lib/__tests__/ats-export-harness.test.ts
```

Expected: all harness tests pass (establish baseline before changes).

- [ ] **Step 2.2: Replace `buildContactRow` with inline-text version**

Replace the entire `buildContactRow` function (lines 38–60):

```tsx
function buildContactRow() {
  const items: Array<{ label: string; href: string }> = []
  if (basics.email) items.push({ label: basics.email, href: `mailto:${basics.email}` })
  if (basics.phone) items.push({ label: basics.phone, href: '' })
  if (basics.url) items.push({ label: basics.url, href: ensureHttps(basics.url) })
  const loc = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
  if (loc) items.push({ label: loc, href: '' })
  if (!items.length) return null
  return (
    <Text style={{ fontSize: 10, color: '#555555', textAlign: 'center', marginTop: 3 }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {item.href
            ? <Link src={item.href} style={{ textDecoration: 'none' }}><Text style={{ color: '#555555' }}>{item.label}</Text></Link>
            : <Text style={{ color: '#555555' }}>{item.label}</Text>
          }
          {i < items.length - 1 && <Text style={{ color: '#555555' }}> · </Text>}
        </React.Fragment>
      ))}
    </Text>
  )
}
```

- [ ] **Step 2.3: Remove `entryRow` from StyleSheet and replace all usages**

Delete `entryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }` from the `StyleSheet.create({...})` block.

Then replace each occurrence of `<View style={styles.entryRow}>...</View>` in `renderPdfSection`. There are 7 sections that use it. Apply this pattern to each:

**work** (inside the `.map((job, i) =>` callback — add `const dates = ...` before the return):
```tsx
{work.map((job, i) => {
  const dates = formatDateRange(job.startDate, job.endDate, true)
  return (
    <View key={i} style={{ marginBottom: 7.5 }}>
      <Text style={{ marginBottom: 2 }}>
        <Text style={styles.bold}>{job.name ?? ''}</Text>
        {dates ? <Text style={styles.small}>{'  ·  '}{dates}</Text> : null}
      </Text>
      <Text style={styles.accent}>{job.position ?? ''}</Text>
      {renderPdfRichText(job.summary, styles.entrySummary)}
      {(job.highlights ?? []).map((h, hi) => (
        <Text key={hi} style={hi === 0 ? [styles.bullet, styles.bulletFirst] : styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
      ))}
    </View>
  )
})}
```

**education**:
```tsx
{education.map((edu, i) => {
  const dates = formatDateRange(edu.startDate, edu.endDate)
  return (
    <View key={i} style={{ marginBottom: 6 }}>
      <Text style={{ marginBottom: 2 }}>
        <Text style={styles.bold}>{edu.institution ?? ''}</Text>
        {dates ? <Text style={styles.small}>{'  ·  '}{dates}</Text> : null}
      </Text>
      <Text style={styles.degree}>{[edu.studyType, edu.area].filter(Boolean).join(' in ')}</Text>
      {edu.score ? <Text style={styles.small}>Score: {edu.score}</Text> : null}
    </View>
  )
})}
```

**certificates**:
```tsx
{certificates.map((c, i) => (
  <Text key={i} style={{ marginBottom: 4 }}>
    <Text style={styles.bold}>
      {c.name ?? ''}
      {c.issuer ? <Text style={styles.small}> — {c.issuer}</Text> : null}
    </Text>
    {c.date ? <Text style={styles.small}>{'  ·  '}{c.date}</Text> : null}
  </Text>
))}
```

**awards**:
```tsx
{awards.map((a, i) => (
  <View key={i} style={{ marginBottom: 6 }}>
    <Text style={{ marginBottom: 2 }}>
      <Text style={styles.bold}>{a.title ?? ''}</Text>
      {a.date ? <Text style={styles.small}>{'  ·  '}{a.date}</Text> : null}
    </Text>
    {a.awarder ? <Text style={styles.small}>{a.awarder}</Text> : null}
    {a.summary ? <Text style={styles.body}>{a.summary}</Text> : null}
  </View>
))}
```

**publications**:
```tsx
{publications.map((p, i) => (
  <View key={i} style={{ marginBottom: 6 }}>
    <Text style={{ marginBottom: 2 }}>
      <Text style={styles.bold}>{p.name ?? ''}</Text>
      {p.releaseDate ? <Text style={styles.small}>{'  ·  '}{p.releaseDate}</Text> : null}
    </Text>
    {p.publisher ? <Text style={styles.small}>{p.publisher}</Text> : null}
    {p.summary ? <Text style={styles.body}>{p.summary}</Text> : null}
  </View>
))}
```

**volunteer**:
```tsx
{volunteer.map((v, i) => {
  const dates = formatDateRange(v.startDate, v.endDate, true)
  return (
    <View key={i} style={{ marginBottom: 6 }}>
      <Text style={{ marginBottom: 2 }}>
        <Text style={styles.bold}>{v.organization ?? ''}</Text>
        {dates ? <Text style={styles.small}>{'  ·  '}{dates}</Text> : null}
      </Text>
      <Text style={styles.accent}>{v.position ?? ''}</Text>
      {renderPdfRichText(v.summary, styles.entrySummary)}
      {(v.highlights ?? []).map((h, hi) => (
        <Text key={hi} style={hi === 0 ? [styles.bullet, styles.bulletFirst] : styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
      ))}
    </View>
  )
})}
```

**projects**:
```tsx
{projects.map((p, i) => {
  const dates = formatDateRange(p.startDate, p.endDate)
  return (
    <View key={i} style={{ marginBottom: 8 }}>
      <Text style={{ marginBottom: 2 }}>
        <Text style={styles.bold}>{p.name ?? ''}</Text>
        {dates ? <Text style={styles.small}>{'  ·  '}{dates}</Text> : null}
      </Text>
      {p.description ? <Text style={styles.body}>{p.description}</Text> : null}
      {(p.highlights ?? []).map((h, hi) => <Text key={hi} style={styles.bullet}>• {h}</Text>)}
      {(p.keywords ?? []).length > 0 ? <Text style={[styles.small, { marginTop: 2 }]}>{(p.keywords ?? []).join(', ')}</Text> : null}
    </View>
  )
})}
```

- [ ] **Step 2.4: Run harness tests**

```
npm run test:run -- lib/__tests__/ats-export-harness.test.ts
```

Expected: all pass (no regression — key facts still appear in designed PDF text).

- [ ] **Step 2.5: Commit**

```
git add lib/pdf/templates/ClassicPdfTemplate.tsx
git commit -m "fix(pdf): Classic — contact row inline text, entryRow inline date"
```

---

## Task 3: PDF Modern — contact row inline + entryRow inline

**Files:**
- Modify: `lib/pdf/templates/ModernPdfTemplate.tsx`

Modern uses a dark-colored header (`meta.primaryColor` background) so contact text is white.

- [ ] **Step 3.1: Replace `buildContactRow`**

Replace the entire `buildContactRow` function:

```tsx
function buildContactRow() {
  const items: Array<{ label: string; href: string }> = []
  if (basics.email) items.push({ label: basics.email, href: `mailto:${basics.email}` })
  if (basics.phone) items.push({ label: basics.phone, href: '' })
  if (basics.url) items.push({ label: basics.url, href: ensureHttps(basics.url) })
  const loc = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
  if (loc) items.push({ label: loc, href: '' })
  if (!items.length) return null
  return (
    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {item.href
            ? <Link src={item.href} style={{ textDecoration: 'none' }}><Text style={{ color: 'rgba(255,255,255,0.75)' }}>{item.label}</Text></Link>
            : <Text style={{ color: 'rgba(255,255,255,0.75)' }}>{item.label}</Text>
          }
          {i < items.length - 1 && <Text style={{ color: 'rgba(255,255,255,0.75)' }}> · </Text>}
        </React.Fragment>
      ))}
    </Text>
  )
}
```

- [ ] **Step 3.2: Remove `entryRow` from StyleSheet and replace all usages**

Delete `entryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }` from `StyleSheet.create`.

Apply the same entryRow → inline text pattern as Task 2 to all 7 sections (`work`, `education`, `certificates`, `awards`, `publications`, `volunteer`, `projects`) inside `renderPdfSection`. The code is identical to Task 2 Step 2.3 — Modern uses the same `styles.bold` / `styles.small` style names.

- [ ] **Step 3.3: Run harness tests**

```
npm run test:run -- lib/__tests__/ats-export-harness.test.ts
```

Expected: all pass.

- [ ] **Step 3.4: Commit**

```
git add lib/pdf/templates/ModernPdfTemplate.tsx
git commit -m "fix(pdf): Modern — contact row inline text, entryRow inline date"
```

---

## Task 4: PDF Executive — contact row inline + entryRow inline

**Files:**
- Modify: `lib/pdf/templates/ExecutivePdfTemplate.tsx`

Executive uses `'   |   '` as separator (three spaces, pipe, three spaces) and left-aligns contact.

- [ ] **Step 4.1: Replace `buildContactRow`**

Replace the entire `buildContactRow` function:

```tsx
function buildContactRow() {
  const items: Array<{ label: string; href: string }> = []
  if (basics.email) items.push({ label: basics.email, href: `mailto:${basics.email}` })
  if (basics.phone) items.push({ label: basics.phone, href: '' })
  if (basics.url) items.push({ label: basics.url, href: ensureHttps(basics.url) })
  const loc = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
  if (loc) items.push({ label: loc, href: '' })
  if (!items.length) return null
  return (
    <Text style={{ fontSize: 10, color: '#555555' }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {item.href
            ? <Link src={item.href} style={{ textDecoration: 'none' }}><Text style={{ color: '#555555' }}>{item.label}</Text></Link>
            : <Text style={{ color: '#555555' }}>{item.label}</Text>
          }
          {i < items.length - 1 && <Text style={{ color: '#555555' }}>{'   |   '}</Text>}
        </React.Fragment>
      ))}
    </Text>
  )
}
```

- [ ] **Step 4.2: Remove `entryRow` from StyleSheet and replace all usages**

Delete `entryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }` from `StyleSheet.create`.

Apply the entryRow → inline text pattern to all 7 sections. The code is identical to Task 2 Step 2.3. Note: Executive's `styles.accent` includes `fontStyle: 'italic'` — that style is applied to the position line, which is untouched.

- [ ] **Step 4.3: Run harness tests**

```
npm run test:run -- lib/__tests__/ats-export-harness.test.ts
```

Expected: all pass.

- [ ] **Step 4.4: Commit**

```
git add lib/pdf/templates/ExecutivePdfTemplate.tsx
git commit -m "fix(pdf): Executive — contact row inline text, entryRow inline date"
```

---

## Task 5: PDF Minimal — contact row inline + entryRow inline

**Files:**
- Modify: `lib/pdf/templates/MinimalPdfTemplate.tsx`

Minimal uses `#777777` for contact text and center-aligns.

- [ ] **Step 5.1: Replace `buildContactRow`**

Replace the entire `buildContactRow` function:

```tsx
function buildContactRow() {
  const items: Array<{ label: string; href: string }> = []
  if (basics.email) items.push({ label: basics.email, href: `mailto:${basics.email}` })
  if (basics.phone) items.push({ label: basics.phone, href: '' })
  if (basics.url) items.push({ label: basics.url, href: ensureHttps(basics.url) })
  const loc = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
  if (loc) items.push({ label: loc, href: '' })
  if (!items.length) return null
  return (
    <Text style={{ fontSize: 10, color: '#777777', textAlign: 'center', marginTop: 3 }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {item.href
            ? <Link src={item.href} style={{ textDecoration: 'none' }}><Text style={{ color: '#777777' }}>{item.label}</Text></Link>
            : <Text style={{ color: '#777777' }}>{item.label}</Text>
          }
          {i < items.length - 1 && <Text style={{ color: '#777777' }}>{'  ·  '}</Text>}
        </React.Fragment>
      ))}
    </Text>
  )
}
```

- [ ] **Step 5.2: Remove `entryRow` from StyleSheet and replace all usages**

Delete `entryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }` from `StyleSheet.create`.

Apply the entryRow → inline text pattern to all 7 sections. The code is identical to Task 2 Step 2.3.

- [ ] **Step 5.3: Run harness tests**

```
npm run test:run -- lib/__tests__/ats-export-harness.test.ts
```

Expected: all pass.

- [ ] **Step 5.4: Commit**

```
git add lib/pdf/templates/MinimalPdfTemplate.tsx
git commit -m "fix(pdf): Minimal — contact row inline text, entryRow inline date"
```

---

## Task 6: PDF Sidebar — entryRow fix + rail renderer expansion + columnAssignment

**Files:**
- Modify: `lib/pdf/templates/SidebarPdfTemplate.tsx`

- [ ] **Step 6.1: Update imports**

Add `SIDEBAR_COLUMN_DEFAULTS` to the `getColumnSide` import:

```tsx
import { getColumnSide, SIDEBAR_COLUMN_DEFAULTS } from '@/lib/get-column-side'
```

- [ ] **Step 6.2: Replace `RAIL_SECTIONS` with `columnAssignment`**

Delete the line:
```tsx
const RAIL_SECTIONS = new Set(['skills', 'languages'])
```

Replace the two filter lines inside the component function:
```tsx
// Delete these two lines:
const railSections = sectionOrder.filter((s) => !s.startsWith('custom:') && RAIL_SECTIONS.has(s))
const mainSections = sectionOrder.filter((s) => s.startsWith('custom:') || !RAIL_SECTIONS.has(s))

// Add these two lines:
const ca = meta.columnAssignment ?? {}
const railSections = sectionOrder.filter((s) => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'left')
const mainSections = sectionOrder.filter((s) => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'right')
```

- [ ] **Step 6.3: Expand `renderRailSection` to handle all section types**

Replace the entire `renderRailSection` function with the expanded version below. The existing `skills` and `languages` renderers are preserved; the remaining section types are added with rail-styled rendering (white text on primary color).

```tsx
function renderRailSection(kind: string): React.ReactNode {
  if (kind.startsWith('custom:')) {
    const id = kind.slice(7)
    const cs = data.customSections?.find((s) => s.id === id)
    if (!cs || !cs.items.length) return null
    return (
      <View key={kind}>
        <Text style={styles.railSectionTitle}>{cs.name}</Text>
        {cs.items.map((item, i) => (
          <View key={i} style={{ marginBottom: 4.5 }}>
            {item.title ? <Text style={styles.railBold}>{item.title}</Text> : null}
            {cs.enabledFields.includes('summary') && item.summary
              ? <Text style={styles.railBody}>{item.summary}</Text>
              : null}
          </View>
        ))}
      </View>
    )
  }

  switch (kind) {
    case 'skills':
      if (!skills.length) return null
      return (
        <View key="skills">
          <Text style={styles.railSectionTitle}>Skills</Text>
          {skills.map((s, i) => (
            <View key={i} style={{ marginBottom: 4.5 }}>
              <Text style={styles.railBold}>
                {s.name ?? ''}
                {s.level ? <Text style={styles.railMuted}> · {s.level}</Text> : null}
              </Text>
              {(s.keywords ?? []).length > 0 && (
                <Text style={styles.railKeywords}>{(s.keywords ?? []).join(', ')}</Text>
              )}
            </View>
          ))}
        </View>
      )

    case 'languages':
      if (!languages.length) return null
      return (
        <View key="languages">
          <Text style={styles.railSectionTitle}>Languages</Text>
          {languages.map((l, i) => (
            <Text key={i} style={styles.railLang}>
              <Text style={styles.railBold}>{l.language ?? ''}</Text>
              {l.fluency ? <Text style={styles.railKeywords}> - {l.fluency}</Text> : null}
            </Text>
          ))}
        </View>
      )

    case 'work':
      if (!work.length) return null
      return (
        <View key="work">
          <Text style={styles.railSectionTitle}>Work Experience</Text>
          {work.map((job, i) => {
            const dates = formatDateRange(job.startDate, job.endDate, true)
            return (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={styles.railBold}>
                  {job.name ?? ''}
                  {dates ? <Text style={styles.railMuted}>{'  ·  '}{dates}</Text> : null}
                </Text>
                {job.position ? <Text style={styles.railBody}>{job.position}</Text> : null}
                {(job.highlights ?? []).map((h, hi) => (
                  <Text key={hi} style={styles.railBody}>• {h}</Text>
                ))}
              </View>
            )
          })}
        </View>
      )

    case 'education':
      if (!education.length) return null
      return (
        <View key="education">
          <Text style={styles.railSectionTitle}>Education</Text>
          {education.map((edu, i) => {
            const dates = formatDateRange(edu.startDate, edu.endDate)
            return (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={styles.railBold}>
                  {edu.institution ?? ''}
                  {dates ? <Text style={styles.railMuted}>{'  ·  '}{dates}</Text> : null}
                </Text>
                <Text style={styles.railBody}>{[edu.studyType, edu.area].filter(Boolean).join(' in ')}</Text>
              </View>
            )
          })}
        </View>
      )

    case 'certificates':
      if (!certificates.length) return null
      return (
        <View key="certificates">
          <Text style={styles.railSectionTitle}>Certifications</Text>
          {certificates.map((c, i) => (
            <Text key={i} style={{ ...styles.railBold, marginBottom: 4.5 }}>
              {c.name ?? ''}
              {c.issuer ? <Text style={styles.railMuted}> — {c.issuer}</Text> : null}
              {c.date ? <Text style={styles.railMuted}>{'  ·  '}{c.date}</Text> : null}
            </Text>
          ))}
        </View>
      )

    case 'awards':
      if (!awards.length) return null
      return (
        <View key="awards">
          <Text style={styles.railSectionTitle}>Awards</Text>
          {awards.map((a, i) => (
            <View key={i} style={{ marginBottom: 4.5 }}>
              <Text style={styles.railBold}>
                {a.title ?? ''}
                {a.date ? <Text style={styles.railMuted}>{'  ·  '}{a.date}</Text> : null}
              </Text>
              {a.awarder ? <Text style={styles.railBody}>{a.awarder}</Text> : null}
            </View>
          ))}
        </View>
      )

    case 'publications':
      if (!publications.length) return null
      return (
        <View key="publications">
          <Text style={styles.railSectionTitle}>Publications</Text>
          {publications.map((p, i) => (
            <View key={i} style={{ marginBottom: 4.5 }}>
              <Text style={styles.railBold}>
                {p.name ?? ''}
                {p.releaseDate ? <Text style={styles.railMuted}>{'  ·  '}{p.releaseDate}</Text> : null}
              </Text>
              {p.publisher ? <Text style={styles.railBody}>{p.publisher}</Text> : null}
            </View>
          ))}
        </View>
      )

    case 'volunteer':
      if (!volunteer.length) return null
      return (
        <View key="volunteer">
          <Text style={styles.railSectionTitle}>Volunteer</Text>
          {volunteer.map((v, i) => {
            const dates = formatDateRange(v.startDate, v.endDate, true)
            return (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={styles.railBold}>
                  {v.organization ?? ''}
                  {dates ? <Text style={styles.railMuted}>{'  ·  '}{dates}</Text> : null}
                </Text>
                {v.position ? <Text style={styles.railBody}>{v.position}</Text> : null}
              </View>
            )
          })}
        </View>
      )

    case 'interests':
      if (!interests.length) return null
      return (
        <View key="interests">
          <Text style={styles.railSectionTitle}>Interests</Text>
          {interests.map((int, i) => (
            <Text key={i} style={styles.railBody}>
              <Text style={styles.railBold}>{int.name ?? ''}</Text>
              {(int.keywords ?? []).length > 0
                ? <Text style={styles.railKeywords}>: {(int.keywords ?? []).join(', ')}</Text>
                : null}
            </Text>
          ))}
        </View>
      )

    case 'projects':
      if (!projects.length) return null
      return (
        <View key="projects">
          <Text style={styles.railSectionTitle}>Projects</Text>
          {projects.map((p, i) => {
            const dates = formatDateRange(p.startDate, p.endDate)
            return (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={styles.railBold}>
                  {p.name ?? ''}
                  {dates ? <Text style={styles.railMuted}>{'  ·  '}{dates}</Text> : null}
                </Text>
                {p.description ? <Text style={styles.railBody}>{p.description}</Text> : null}
                {(p.highlights ?? []).map((h, hi) => (
                  <Text key={hi} style={styles.railBody}>• {h}</Text>
                ))}
              </View>
            )
          })}
        </View>
      )

    default:
      return null
  }
}
```

- [ ] **Step 6.4: Fix `entryRow` in `renderMainSection`**

Remove `entryRow` from `StyleSheet.create` in `SidebarPdfTemplate`. Apply the same entryRow → inline text pattern as Task 2 Step 2.3 to all sections inside `renderMainSection` (`work`, `education`, `certificates`, `awards`, `publications`, `volunteer`, `projects`). The code is identical to Task 2 Step 2.3.

- [ ] **Step 6.5: Run harness tests**

```
npm run test:run -- lib/__tests__/ats-export-harness.test.ts
```

Expected: all pass.

- [ ] **Step 6.6: Commit**

```
git add lib/pdf/templates/SidebarPdfTemplate.tsx
git commit -m "feat(pdf): Sidebar — columnAssignment, full rail section support, entryRow inline"
```

---

## Task 7: Web Sidebar template — columnAssignment

**Files:**
- Modify: `components/templates/SidebarTemplate.tsx`

- [ ] **Step 7.1: Update import**

Add the import at the top of `SidebarTemplate.tsx`:

```tsx
import { getColumnSide, SIDEBAR_COLUMN_DEFAULTS } from '@/lib/get-column-side'
```

- [ ] **Step 7.2: Replace `RAIL_SECTIONS` constant and filter logic**

Delete:
```tsx
const RAIL_SECTIONS = new Set(['skills', 'languages'])
```

Replace the two filter lines inside the component:
```tsx
// Delete:
const railSections = sectionOrder.filter((s) => !s.startsWith('custom:') && RAIL_SECTIONS.has(s))
const mainSections = sectionOrder.filter((s) => s.startsWith('custom:') || !RAIL_SECTIONS.has(s))

// Add:
const ca = meta.columnAssignment ?? {}
const railSections = sectionOrder.filter((s) => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'left')
const mainSections = sectionOrder.filter((s) => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'right')
```

- [ ] **Step 7.3: Run full test suite**

```
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 7.4: Commit**

```
git add components/templates/SidebarTemplate.tsx
git commit -m "feat(web): Sidebar template uses columnAssignment instead of hardcoded RAIL_SECTIONS"
```

---

## Task 8: DOCX — extract `buildRailParas`, unified sidebar path

**Files:**
- Modify: `lib/docx/resume-docx.ts`
- Modify: `lib/docx/__tests__/resume-docx.test.ts`

- [ ] **Step 8.1: Write failing tests for sidebar `columnAssignment`**

Add to `lib/docx/__tests__/resume-docx.test.ts` inside the `describe('buildDocx', () => {` block:

```ts
it('sidebar columnAssignment moves skills to main column and work to rail', async () => {
  const meta: ResumeMeta = {
    ...defaultMeta,
    templateId: 'sidebar',
    primaryColor: '#1e3a5f',
    columnAssignment: { skills: 'right', work: 'left' },
    sectionOrder: ['work', 'skills'],
  }
  const doc = buildDocx(sampleData, meta)
  const buffer = await Packer.toBuffer(doc)
  const zip = await JSZip.loadAsync(buffer)
  const xml = await zip.file('word/document.xml')!.async('string')
  expect(xml).toContain('<w:tbl')
  // With work overridden to left and skills to right:
  // work heading should appear before skills heading in XML (left cell before right cell)
  const workIdx = xml.indexOf('WORK EXPERIENCE')
  const skillsIdx = xml.indexOf('SKILLS')
  expect(workIdx).toBeGreaterThan(-1)
  expect(skillsIdx).toBeGreaterThan(-1)
  expect(workIdx).toBeLessThan(skillsIdx)
})

it('sidebar default columnAssignment still puts skills in rail (left) and work in main (right)', async () => {
  const meta: ResumeMeta = {
    ...defaultMeta,
    templateId: 'sidebar',
    primaryColor: '#1e3a5f',
    columnAssignment: {},
    sectionOrder: ['work', 'skills'],
  }
  const doc = buildDocx(sampleData, meta)
  const buffer = await Packer.toBuffer(doc)
  const zip = await JSZip.loadAsync(buffer)
  const xml = await zip.file('word/document.xml')!.async('string')
  // Default: skills → left (rail), work → right (main)
  // skills heading appears before work heading in XML
  const skillsIdx = xml.indexOf('SKILLS')
  const workIdx = xml.indexOf('WORK EXPERIENCE')
  expect(skillsIdx).toBeGreaterThan(-1)
  expect(workIdx).toBeGreaterThan(-1)
  expect(skillsIdx).toBeLessThan(workIdx)
})
```

- [ ] **Step 8.2: Run new tests to confirm they fail**

```
npm run test:run -- lib/docx/__tests__/resume-docx.test.ts
```

Expected: the two new tests fail because `columnAssignment` is not yet respected (skills always goes to rail regardless).

- [ ] **Step 8.3: Add import for `SIDEBAR_COLUMN_DEFAULTS` in `resume-docx.ts`**

Add to the existing import at the top of `lib/docx/resume-docx.ts`:

```ts
import { getColumnSide, SIDEBAR_COLUMN_DEFAULTS } from '@/lib/get-column-side'
```

- [ ] **Step 8.4: Add `buildRailParas` function**

Insert this function before `buildSectionParas` in `lib/docx/resume-docx.ts`:

```ts
function buildRailParas(
  basics: ResumeData['basics'],
  sections: string[],
  data: ResumeData,
  headFont: string,
  bodyFont: string,
  nameSize: number,
  labelSize: number,
): Paragraph[] {
  const railText = 'ffffff'
  const railSoft = 'f2f2f2'
  const railMuted = 'e8e8e8'

  const paras: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: basics?.name ?? '', bold: true, font: headFont, size: nameSize, color: railText })],
      spacing: { after: 60 },
    }),
  ]
  if (basics?.label) {
    paras.push(new Paragraph({
      children: [new TextRun({ text: basics.label, font: bodyFont, size: labelSize, color: railMuted })],
      spacing: { after: 40 },
    }))
  }
  const contactItems = [
    basics?.email,
    basics?.phone,
    basics?.url,
    [basics?.location?.city, basics?.location?.region].filter(Boolean).join(', '),
  ].filter(Boolean) as string[]
  contactItems.forEach((item, i) => {
    paras.push(new Paragraph({
      children: [new TextRun({ text: item, font: bodyFont, size: 18, color: railSoft })],
      spacing: { before: i === 0 ? 180 : 0, after: 40 },
    }))
  })

  const railHeading = (text: string) => new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, font: headFont, size: 20, color: railText })],
    spacing: { before: 270, after: 105 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'd9d9d9', space: 2 } },
  })

  const { work = [], education = [], skills = [], certificates = [], awards = [],
    publications = [], volunteer = [], languages = [], interests = [], projects = [],
    customSections = [] } = data

  for (const section of sections) {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = customSections.find(s => s.id === id)
      if (!cs || !cs.items.length) continue
      paras.push(railHeading(cs.name))
      for (const item of cs.items) {
        if (item.title) paras.push(new Paragraph({ children: [new TextRun({ text: item.title, bold: true, font: bodyFont, size: 19, color: railText })], spacing: { after: 40 } }))
        if (cs.enabledFields.includes('summary') && item.summary) paras.push(new Paragraph({ children: [new TextRun({ text: item.summary, font: bodyFont, size: 19, color: railSoft })], spacing: { after: 40 } }))
      }
      continue
    }
    switch (section) {
      case 'skills':
        if (!skills.length) break
        paras.push(railHeading('Skills'))
        for (const s of skills) {
          paras.push(new Paragraph({
            children: [new TextRun({ text: s.name ?? '', bold: true, font: bodyFont, size: 19, color: railText }), ...(s.level ? [new TextRun({ text: ` · ${s.level}`, font: bodyFont, size: 19, color: railMuted })] : [])],
            spacing: { after: (s.keywords ?? []).length ? 0 : 90 },
          }))
          if ((s.keywords ?? []).length) paras.push(new Paragraph({ children: [new TextRun({ text: (s.keywords ?? []).join(', '), font: bodyFont, size: 19, color: railMuted })], spacing: { after: 90 } }))
        }
        break
      case 'languages':
        if (!languages.length) break
        paras.push(railHeading('Languages'))
        for (const l of languages) paras.push(new Paragraph({ children: [new TextRun({ text: l.language ?? '', bold: true, font: bodyFont, size: 19, color: railText }), ...(l.fluency ? [new TextRun({ text: ` - ${l.fluency}`, font: bodyFont, size: 19, color: railMuted })] : [])], spacing: { after: 30 } }))
        break
      case 'work':
        if (!work.length) break
        paras.push(railHeading('Work Experience'))
        for (const job of work) {
          const dates = formatDateRange(job.startDate, job.endDate, true)
          paras.push(new Paragraph({ children: [new TextRun({ text: job.name ?? '', bold: true, font: bodyFont, size: 19, color: railText }), ...(dates ? [new TextRun({ text: `  ·  ${dates}`, font: bodyFont, size: 19, color: railMuted })] : [])], spacing: { before: 100, after: 20 } }))
          if (job.position) paras.push(new Paragraph({ children: [new TextRun({ text: job.position, font: bodyFont, size: 19, color: railSoft })], spacing: { after: 40 } }))
          for (const h of job.highlights ?? []) paras.push(new Paragraph({ children: richTextRuns(h, bodyFont, 19), bullet: { level: 0 }, spacing: { after: 20 } }))
        }
        break
      case 'education':
        if (!education.length) break
        paras.push(railHeading('Education'))
        for (const edu of education) {
          const dates = formatDateRange(edu.startDate, edu.endDate)
          paras.push(new Paragraph({ children: [new TextRun({ text: edu.institution ?? '', bold: true, font: bodyFont, size: 19, color: railText }), ...(dates ? [new TextRun({ text: `  ·  ${dates}`, font: bodyFont, size: 19, color: railMuted })] : [])], spacing: { before: 100, after: 20 } }))
          const degree = [edu.studyType, edu.area].filter(Boolean).join(' in ')
          if (degree) paras.push(new Paragraph({ children: [new TextRun({ text: degree, font: bodyFont, size: 19, color: railSoft })], spacing: { after: 40 } }))
        }
        break
      case 'certificates':
        if (!certificates.length) break
        paras.push(railHeading('Certifications'))
        for (const c of certificates) paras.push(new Paragraph({ children: [new TextRun({ text: c.name ?? '', bold: true, font: bodyFont, size: 19, color: railText }), ...(c.issuer ? [new TextRun({ text: ` — ${c.issuer}`, font: bodyFont, size: 19, color: railSoft })] : []), ...(c.date ? [new TextRun({ text: `  ·  ${formatDate(c.date)}`, font: bodyFont, size: 19, color: railMuted })] : [])], spacing: { after: 40 } }))
        break
      case 'awards':
        if (!awards.length) break
        paras.push(railHeading('Awards'))
        for (const a of awards) {
          paras.push(new Paragraph({ children: [new TextRun({ text: a.title ?? '', bold: true, font: bodyFont, size: 19, color: railText }), ...(a.date ? [new TextRun({ text: `  ·  ${formatDate(a.date)}`, font: bodyFont, size: 19, color: railMuted })] : [])], spacing: { before: 80, after: 20 } }))
          if (a.awarder) paras.push(new Paragraph({ children: [new TextRun({ text: a.awarder, font: bodyFont, size: 19, color: railSoft })], spacing: { after: 40 } }))
        }
        break
      case 'publications':
        if (!publications.length) break
        paras.push(railHeading('Publications'))
        for (const p of publications) {
          paras.push(new Paragraph({ children: [new TextRun({ text: p.name ?? '', bold: true, font: bodyFont, size: 19, color: railText }), ...(p.releaseDate ? [new TextRun({ text: `  ·  ${formatDate(p.releaseDate)}`, font: bodyFont, size: 19, color: railMuted })] : [])], spacing: { before: 80, after: 20 } }))
          if (p.publisher) paras.push(new Paragraph({ children: [new TextRun({ text: p.publisher, font: bodyFont, size: 19, color: railSoft })], spacing: { after: 40 } }))
        }
        break
      case 'volunteer':
        if (!volunteer.length) break
        paras.push(railHeading('Volunteer'))
        for (const v of volunteer) {
          const dates = formatDateRange(v.startDate, v.endDate, true)
          paras.push(new Paragraph({ children: [new TextRun({ text: v.organization ?? '', bold: true, font: bodyFont, size: 19, color: railText }), ...(dates ? [new TextRun({ text: `  ·  ${dates}`, font: bodyFont, size: 19, color: railMuted })] : [])], spacing: { before: 100, after: 20 } }))
          if (v.position) paras.push(new Paragraph({ children: [new TextRun({ text: v.position, font: bodyFont, size: 19, color: railSoft })], spacing: { after: 40 } }))
        }
        break
      case 'interests':
        if (!interests.length) break
        paras.push(railHeading('Interests'))
        for (const int of interests) {
          const kw = (int.keywords ?? []).length > 0 ? `: ${(int.keywords ?? []).join(', ')}` : ''
          paras.push(new Paragraph({ children: [new TextRun({ text: int.name ?? '', bold: true, font: bodyFont, size: 19, color: railText }), new TextRun({ text: kw, font: bodyFont, size: 19, color: railMuted })], spacing: { after: 40 } }))
        }
        break
      case 'projects':
        if (!projects.length) break
        paras.push(railHeading('Projects'))
        for (const p of projects) {
          const dates = formatDateRange(p.startDate, p.endDate)
          paras.push(new Paragraph({ children: [new TextRun({ text: p.name ?? '', bold: true, font: bodyFont, size: 19, color: railText }), ...(dates ? [new TextRun({ text: `  ·  ${dates}`, font: bodyFont, size: 19, color: railMuted })] : [])], spacing: { before: 80, after: 20 } }))
          if (p.description) paras.push(new Paragraph({ children: [new TextRun({ text: p.description, font: bodyFont, size: 19, color: railSoft })], spacing: { after: 40 } }))
          for (const h of p.highlights ?? []) paras.push(new Paragraph({ children: richTextRuns(h, bodyFont, 19), bullet: { level: 0 }, spacing: { after: 20 } }))
        }
        break
    }
  }

  return paras
}
```

- [ ] **Step 8.5: Replace the sidebar early-return block in `buildDocx`**

Locate and delete the entire block (currently lines ~512–629):
```ts
// ─── Sidebar template: shaded left rail + main column ───
if (mode === 'designed' && meta.templateId === 'sidebar') {
  // ... ~120 lines ...
}
```

Replace it with:

```ts
// ─── Sidebar template: shaded left rail + main column ───
// Uses columnAssignment (with SIDEBAR_COLUMN_DEFAULTS) so users can assign any
// section to either column. Rail cell is shaded with meta.primaryColor.
if (mode === 'designed' && meta.templateId === 'sidebar') {
  const ca = meta.columnAssignment ?? {}
  const leftSections  = sectionOrder.filter(s => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'left')
  const rightSections = sectionOrder.filter(s => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'right')

  const railWidthTwips = Math.round(usableWidthTwips * 0.33)
  const mainWidthTwips = usableWidthTwips - railWidthTwips
  const railPad = 220
  const mainGap = 360

  const leftCellChildren = buildRailParas(basics, leftSections, data, headFont, bodyFont, theme.nameSize, theme.labelSize ?? 21)

  const rightParas: Paragraph[] = []
  if (basics.summary) {
    rightParas.push(new Paragraph({
      children: richTextRuns(basics.summary, bodyFont, 20, { color: '444444' }),
      spacing: { after: 90 },
    }))
  }
  rightParas.push(...buildSectionParas(rightSections, {
    data, bodyFont, headFont, theme, ensureHttps,
    tabWidthTwips: mainWidthTwips - mainGap,
  }))

  return makeDocument([
    new Table({
      width: { size: usableWidthTwips, type: WidthType.DXA },
      borders: { ...NO_BORDERS, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: railWidthTwips, type: WidthType.DXA },
              borders: NO_BORDERS,
              shading: { type: ShadingType.CLEAR, fill: meta.primaryColor, color: 'auto' },
              margins: { top: railPad, bottom: railPad, left: railPad, right: railPad },
              children: leftCellChildren.length ? leftCellChildren : [new Paragraph({})],
            }),
            new TableCell({
              width: { size: mainWidthTwips, type: WidthType.DXA },
              borders: NO_BORDERS,
              margins: { left: mainGap, right: 0, top: 0, bottom: 0 },
              children: rightParas.length ? rightParas : [new Paragraph({})],
            }),
          ],
        }),
      ],
    }),
  ])
}
```

- [ ] **Step 8.6: Run all DOCX tests**

```
npm run test:run -- lib/docx/__tests__/resume-docx.test.ts
```

Expected: all pass, including the two new column-assignment tests.

- [ ] **Step 8.7: Run full test suite**

```
npm run test:run
```

Expected: all tests pass with no regressions.

- [ ] **Step 8.8: Commit**

```
git add lib/docx/resume-docx.ts lib/docx/__tests__/resume-docx.test.ts
git commit -m "feat(docx): extract buildRailParas, sidebar uses columnAssignment via SIDEBAR_COLUMN_DEFAULTS"
```

---

## Self-Review Checklist

- [x] **Spec § PDF Contact Row** — covered in Tasks 2–5 (`buildContactRow` inline `<Text>`)
- [x] **Spec § PDF entryRow** — covered in Tasks 2–6 (all 5 templates, all 7 section types)
- [x] **Spec § `getColumnSide` SIDEBAR_COLUMN_DEFAULTS** — covered in Task 1
- [x] **Spec § SidebarPdfTemplate columnAssignment** — covered in Task 6
- [x] **Spec § SidebarTemplate (web) columnAssignment** — covered in Task 7
- [x] **Spec § DOCX buildRailParas + unified sidebar path** — covered in Task 8
- [x] **Spec § all section types in rail** — covered in Task 6 Step 6.3 (work, education, certificates, awards, publications, volunteer, interests, projects, custom:*)
- [x] **No placeholders** — all code blocks are complete
- [x] **Type consistency** — `buildRailParas` signature matches call site in Task 8 Step 8.5; `getColumnSide` 3-arg signature matches all call sites in Tasks 6, 7, 8
