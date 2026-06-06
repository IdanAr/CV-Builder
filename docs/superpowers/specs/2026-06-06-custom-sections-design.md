# Custom Sections — Design Spec
**Date:** 2026-06-06  
**Status:** Approved

## Overview

Remove the five broken/unused fixed sections (Certifications, Awards, Publications, Interests, Projects) from the editor and replace them with a fully generic "Add Section" feature. Users name their own sections, configure which field types each section uses (inline, after creation), and add multiple entries per section. Custom sections render in all three live-preview templates.

---

## 1. Data Model

### New Zod schemas (`lib/schemas/resume.zod.ts`)

```ts
const CUSTOM_SECTION_FIELDS = [
  'subtitle', 'url', 'dateRange', 'summary', 'highlights', 'keywords', 'level'
] as const

const CustomSectionItemSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  url: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  level: z.string().optional(),
})

const CustomSectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabledFields: z.array(z.enum(CUSTOM_SECTION_FIELDS)),
  items: z.array(CustomSectionItemSchema),
})
```

### `ResumeData` change

Add one field:
```ts
customSections: z.array(CustomSectionSchema).optional()
```

The five removed fields (`certificates`, `awards`, `publications`, `interests`, `projects`) remain in the Zod schema and DB documents to preserve existing saved data. They are removed from the editor UI only.

### `meta.sectionOrder`

No schema change. Custom sections are stored as `custom:${id}` string keys — the existing `z.array(z.string())` field handles them transparently.

Default `sectionOrder` in both the Zod schema and the store is updated to:
```ts
['work', 'education', 'skills', 'volunteer', 'languages']
```

---

## 2. Store Changes (`lib/stores/resume-editor.store.ts`)

Three new actions are added to `ResumeEditorStore`:

```ts
addCustomSection: (section: CustomSection) => void
updateCustomSection: (id: string, patch: Partial<CustomSection>) => void
removeCustomSection: (id: string) => void
```

Each action updates `data.customSections` and keeps `meta.sectionOrder` in sync atomically:
- `addCustomSection` appends `custom:${id}` to the end of `sectionOrder`
- `removeCustomSection` splices `custom:${id}` out of `sectionOrder`
- `updateCustomSection` only touches `data.customSections` (order unaffected)

All three mark `isDirty: true` to trigger auto-save.

`enabledFields` toggling never mutates item data — silently preserved fields are simply not rendered.

---

## 3. Editor UI

### `EditTab.tsx` changes

- Remove `certificates`, `awards`, `publications`, `interests`, `projects` from `SECTION_FORMS` and `SECTION_LABELS`
- Section loop checks: if key starts with `custom:`, extract the section ID, look up the `CustomSection` from `data.customSections`, and render `<CustomSectionForm section={...} />`
- `AccordionSection` gains two new optional props: `onRename?: (name: string) => void` and `onDelete?: () => void`. When `onRename` is provided, the title `<span>` is replaced with an `<input>` (click stopPropagation so typing doesn't toggle the accordion). When `onDelete` is provided, a ✕ button appears in the header alongside up/down arrows.
- Custom sections pass both `onRename` and `onDelete`; built-in sections pass neither (no behaviour change)
- "Add Section" button at the bottom of the edit panel. On click: creates a new `CustomSection` with a generated UUID, `name: 'New Section'`, `enabledFields: ['summary']`, `items: []`; dispatches `addCustomSection`; opens the new accordion immediately

### `CustomSectionForm.tsx` — new component

**Zone 1 — Field toggles** (always visible at top):
A compact pill row for the 7 configurable fields:
```
[Subtitle]  [Date range]  [URL]  [Text]  [Bullets]  [Keywords]  [Level]
```
- Active: indigo filled pill
- Inactive: gray outlined pill
- Toggling calls `updateCustomSection(id, { enabledFields: [...] })`
- `title` is always on and not shown in this row

**Zone 2 — Items** (rendered below the toggles via `ListFieldManager`):
Each item form renders fields in fixed order based on `enabledFields`:
1. Title (always, primary input)
2. Subtitle (if enabled)
3. Date range — two inline inputs `startDate` / `endDate` (if enabled)
4. URL (if enabled)
5. Free text / summary (if enabled, textarea)
6. Bullets / highlights (if enabled, inline list with per-bullet add/remove — same pattern as WorkForm)
7. Keywords (if enabled, inline chip list — same pattern as SkillsForm)
8. Level (if enabled, short text input)

Badge in accordion header: `"N entries"` or `"empty"`.

---

## 4. Template Rendering

### Shared renderer (`components/templates/renderCustomSection.tsx`)

A single exported function used by all three templates:

```ts
function renderCustomSection(
  section: CustomSection,
  styles: { sectionTitle: CSSProperties; accentColor: string; primaryColor: string }
): React.ReactNode
```

Per-item render order:
1. **Title** — bold primary label
2. **Subtitle + date range** — subtitle left, `startDate – endDate` right (only shown if in `enabledFields` and non-empty)
3. **URL** — smaller linked text (only if in `enabledFields` and non-empty)
4. **Summary** — paragraph text (only if in `enabledFields` and non-empty)
5. **Highlights** — `<ul>` bullet list (only if in `enabledFields` and non-empty)
6. **Keywords** — comma-separated inline text or chips (only if in `enabledFields` and non-empty)
7. **Level** — `"Level: X"` small label (only if in `enabledFields` and non-empty)

Phantom sections (no name, no items) are skipped entirely in both editor and templates.

### Template switch changes

All three templates (`ClassicTemplate`, `ModernTemplate`, `MinimalTemplate`):
- Remove `switch` cases for `certificates`, `awards`, `publications`, `interests`, `projects`
- Update `ALL_SECTIONS` constant to match new default order
- Add a block that iterates `data.customSections ?? []` and calls `renderCustomSection` for any whose `id` appears in `sectionOrder` as `custom:${id}`

---

## 5. Files Deleted

- `components/editor/forms/CertificatesForm.tsx`
- `components/editor/forms/AwardsForm.tsx`
- `components/editor/forms/PublicationsForm.tsx`
- `components/editor/forms/InterestsForm.tsx`
- `components/editor/forms/ProjectsForm.tsx`

---

## 6. Files Changed

| File | Change |
|------|--------|
| `lib/schemas/resume.zod.ts` | Add `CustomSectionItemSchema`, `CustomSectionSchema`, `customSections` field; update `sectionOrder` default |
| `lib/stores/resume-editor.store.ts` | Add 3 store actions; update default `sectionOrder` |
| `components/editor/AccordionSection.tsx` | Add optional `onRename` and `onDelete` props |
| `components/editor/EditTab.tsx` | Remove 5 sections; add custom section rendering + "Add Section" button |
| `components/templates/ClassicTemplate.tsx` | Remove 5 switch cases; add custom section rendering |
| `components/templates/ModernTemplate.tsx` | Same |
| `components/templates/MinimalTemplate.tsx` | Same |

## 7. Files Added

| File | Purpose |
|------|---------|
| `components/editor/forms/CustomSectionForm.tsx` | Field toggle UI + item form |
| `components/templates/renderCustomSection.tsx` | Shared generic section renderer for all templates |

---

## Out of Scope

- PDF export (`@react-pdf/renderer`) for custom sections — Phase 2
- ATS scoring for custom section content — future
- DB migration to remove orphaned `certificates`/`awards`/etc. fields — future
