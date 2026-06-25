# ATS Export Refactor — Design Spec
Date: 2026-06-12
Branch: feature/ats-export-modes

## Problem Statement

JobScan analysis revealed two categories of ATS failure in the "designed" export mode:

1. **Contact information not parsed** — affects all export formats (PDF and DOCX), all templates.
2. **Grid-structure layout interference** — affects designed PDF templates (flex rows producing separate text objects) and designed DOCX templates that use `<w:tbl>` for two-column/sidebar layouts.

The "ats" export mode (AtsPdfTemplate + ATS DOCX theme) already passes. Only the "designed" mode is being fixed here.

Benchmark: Zety, Resume.io, Enhancv — all use flat `<w:tbl>` for DOCX sidebars (same as current implementation). Their ATS claims rest on modern parsers handling flat, non-nested tables. The contact row and entryRow fixes bring the designed templates in line with what those platforms actually export.

---

## Scope — Approach B

### In scope
- PDF contact row: inline text fix (all 5 designed templates)
- PDF entryRow: inline company+date fix (all 5 designed templates)
- Sidebar template: replace hardcoded `RAIL_SECTIONS` with `columnAssignment` (PDF + web)
- DOCX: unify sidebar into two-column Table path, extract `buildRailParas`, use `columnAssignment`
- `getColumnSide`: add `SIDEBAR_COLUMN_DEFAULTS` export and optional `templateDefaults` param

### Out of scope
- ATS export mode (already passes — no changes)
- DOCX Table structure for two-column/sidebar (kept as-is — flat borderless Table is industry standard)
- Shared `renderPdfSection` extraction across all 5 templates (deferred to a follow-up refactor)
- UI editor changes to expose sidebar column assignment controls

---

## Architecture

### PDF Contact Row (Classic, Modern, Executive, Minimal)

Each template's `buildContactRow()` currently wraps items in a `<View style={{ flexDirection: 'row' }}>`. This produces N separate positioned text objects in the PDF content stream at different X-coordinates. ATS parsers that extract text by content-stream order see the items as unrelated fragments.

**Fix:** Replace the outer `<View>` with a `<Text>` parent. All contact items become inline children of one text block.

```tsx
// Before
<View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
  <Link src="mailto:..."><Text style={contactStyle}>email</Text></Link>
  <Text style={contactStyle}> · </Text>
  <Text style={contactStyle}>phone</Text>
</View>

// After
<Text style={{ fontSize: 10, color: '#555555', textAlign: 'center' }}>
  <Link src="mailto:..."><Text>email</Text></Link>
  <Text> · </Text>
  <Text>phone</Text>
</Text>
```

Each template keeps its own separator character and text color. The Sidebar template's contact (one item per line in the rail) is already correct — no change.

### PDF entryRow (all 5 designed templates)

The `entryRow` StyleSheet entry (`flexDirection: 'row', justifyContent: 'space-between'`) creates two separate positioned text objects — entity name at left edge, date at right edge. Y-coordinate parsers cannot associate them.

**Fix:** Single `<Text>` with both values inline, date as a nested `<Text>` with muted styling.

```tsx
// Before
<View style={styles.entryRow}>
  <Text style={styles.bold}>{name}</Text>
  <Text style={styles.small}>{dates}</Text>
</View>

// After
<Text style={{ marginBottom: 2 }}>
  <Text style={styles.bold}>{name}</Text>
  {dates ? <Text style={styles.small}>{'  ·  '}{dates}</Text> : null}
</Text>
```

The `entryRow` StyleSheet entry is removed from each template. Visual change: date moves from hard right-aligned to inline after entity name. This is the same pattern used by AtsPdfTemplate and Zety/Enhancv designed PDFs.

Applies to: work, education, certificates, awards, publications, projects, volunteer — across all 5 templates.

### Sidebar → columnAssignment

#### `lib/get-column-side.ts`

Add `SIDEBAR_COLUMN_DEFAULTS` export and an optional `templateDefaults` parameter:

```ts
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

Existing callers pass no third argument — behavior is unchanged. Sidebar templates pass `SIDEBAR_COLUMN_DEFAULTS` as the third argument.

**Default column assignment for Sidebar:**
- Left (rail): `skills`, `languages`
- Right (main): all other sections
- User-set `meta.columnAssignment` overrides both defaults

#### `lib/pdf/templates/SidebarPdfTemplate.tsx`

Remove `RAIL_SECTIONS`. Replace with `getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS)`:

```ts
const ca = meta.columnAssignment ?? {}
const railSections = sectionOrder.filter(s => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'left')
const mainSections = sectionOrder.filter(s => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'right')
```

`renderRailSection` is expanded to handle all standard section types using rail styles (white text on primary color background). Previously only `skills` and `languages` were handled. The following types are added: `work`, `education`, `certificates`, `awards`, `publications`, `volunteer`, `interests`, `projects`, and `custom:*`. This ensures any section placed in the rail via `columnAssignment` renders correctly.

#### `components/templates/SidebarTemplate.tsx`

Identical `RAIL_SECTIONS` → `getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS)` swap. Web preview reflects the user's column assignment.

### DOCX Sidebar Unification (`lib/docx/resume-docx.ts`)

Remove the ~120-line early-return block `if (mode === 'designed' && meta.templateId === 'sidebar')`. Replace with a unified two-column Table path.

**Unified condition:**

```ts
const isSidebar = mode === 'designed' && meta.templateId === 'sidebar'
const isTwoCol  = mode === 'designed' && meta.layout === 'two-column' && meta.templateId !== 'minimal'

if (isSidebar || isTwoCol) { /* unified Table path */ }
```

**Column split logic:**

```ts
const colDefaults = isSidebar ? SIDEBAR_COLUMN_DEFAULTS : undefined
const leftSections  = sectionOrder.filter(s => getColumnSide(s, ca, colDefaults) === 'left')
const rightSections = sectionOrder.filter(s => getColumnSide(s, ca, colDefaults) === 'right')
```

**Column widths:**

| Template | Left | Right |
|---|---|---|
| Sidebar | 33% | 67% |
| Two-column | 58% | 42% |

**Left cell shading:**

```ts
const leftCellShading = isSidebar
  ? { type: ShadingType.CLEAR, fill: meta.primaryColor, color: 'auto' }
  : undefined
```

**`buildRailParas` — extracted helper:**

The white-text rail content currently inlined in the sidebar block becomes a standalone function. It builds the full left-cell content: name, label, contact items, then each rail section.

```ts
function buildRailParas(
  basics: ResumeData['basics'],
  sections: string[],
  data: ResumeData,
  headFont: string,
  bodyFont: string,
  nameSize: number,
  labelSize: number,
): Paragraph[]
```

Rail text colors are internal constants (`railText = 'ffffff'`, `railSoft = 'f2f2f2'`, `railMuted = 'e8e8e8'`). `primaryColor` is not a parameter — it is only used for the `TableCell` shading, passed at the call site.

Called for the left cell when `isSidebar`. Non-sidebar left cells use `buildSectionParas` as before.

**Header placement:**

- Sidebar: `headerParas` is empty. Name + contact are built inside `buildRailParas` and live in the left cell.
- Two-column: `headerParas` is built as normal and placed above the Table.

**Net result:** DOCX output for sidebar is functionally identical to current for default column assignment. Behavioral change: `columnAssignment` now controls rail vs main section placement.

---

## Files Changed

| File | Changes |
|---|---|
| `lib/get-column-side.ts` | Add `SIDEBAR_COLUMN_DEFAULTS`, optional `templateDefaults` param |
| `lib/pdf/templates/ClassicPdfTemplate.tsx` | Contact row inline, entryRow inline |
| `lib/pdf/templates/ModernPdfTemplate.tsx` | Contact row inline, entryRow inline |
| `lib/pdf/templates/ExecutivePdfTemplate.tsx` | Contact row inline, entryRow inline |
| `lib/pdf/templates/MinimalPdfTemplate.tsx` | Contact row inline, entryRow inline |
| `lib/pdf/templates/SidebarPdfTemplate.tsx` | Expand rail renderer, columnAssignment via `SIDEBAR_COLUMN_DEFAULTS` |
| `components/templates/SidebarTemplate.tsx` | columnAssignment via `SIDEBAR_COLUMN_DEFAULTS` |
| `lib/docx/resume-docx.ts` | Remove sidebar early-return, extract `buildRailParas`, unified two-column path |

---

## Testing Checklist

- [ ] Export Classic/Modern/Executive/Minimal as designed PDF — verify contact row is single text block in content stream
- [ ] Export all templates as designed PDF — verify company name and date appear on same line
- [ ] Export Sidebar as designed PDF with default column assignment — skills/languages in rail, work/education in main
- [ ] Export Sidebar as designed PDF with custom column assignment — verify user overrides are respected
- [ ] Export Sidebar as designed DOCX — visually identical to pre-refactor, rail shading present
- [ ] Export two-column as designed DOCX — no regression
- [ ] Export any template in ATS mode — no regression (ATS path unchanged)
- [ ] Run existing ATS test suite (`lib/docx/__tests__/resume-docx.test.ts`)
- [ ] Validate designed PDF exports through JobScan for contact info and section parsing
