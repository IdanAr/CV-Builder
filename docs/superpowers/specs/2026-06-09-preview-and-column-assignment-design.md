# Preview A4 Fix & Two-Column Section Assignment

**Date:** 2026-06-09  
**Status:** Approved  
**Scope:** `cv-builder` — PreviewTab, DesignPanel, ClassicTemplate, ModernTemplate, resume.zod.ts, resume-docx.ts

---

## Problem Statement

Two independent issues:

1. **Preview does not reflect A4 dimensions.** `PreviewTab` scales the template with CSS `transform: scale()`, but `transform` does not affect layout flow. The scroll container's dimensions are based on the unscaled template, so the scroll area is oversized relative to what is visually displayed. There are also no page break indicators, so users cannot tell when their CV overflows to a second page.

2. **Two-column layout has no user control over which column each section goes to.** Section placement is hardcoded in `ClassicTemplate` and `ModernTemplate`: `work`, `education`, and `volunteer` always go left; everything else always goes right. Users have no way to change this.

---

## Feature 1: A4 Preview Fix

### Behaviour

- The template renders at exactly **794 px wide** (A4 at 96 dpi) and its natural height.
- The preview pane scales it down to fit the available container width (`fitScale = containerWidth / 794`, capped at 1).
- The outer scroll container has dimensions equal to the **visual (post-scale) size** of the template, so scrolling tracks the content exactly with no empty space below.
- **Page break indicators** are overlaid as horizontal dashed lines at every **1123 × fitScale px** boundary (A4 page height at 96 dpi). Each indicator shows a label ("Page 2", "Page 3", …). These are decorative overlays only — they do not affect the template HTML or any export.

### Implementation

**`PreviewTab.tsx`**

- Add a `ResizeObserver` on the template wrapper ref to track `templateHeight` (actual rendered height in px).
- Replace the current single scaled `<div>` with a two-layer structure:
  - **Outer wrapper** — `position: relative`, `width: 794 * fitScale`, `height: templateHeight * fitScale`. This is what the scroll container sees.
  - **Inner scaled div** — `transform: scale(fitScale)`, `transformOrigin: top left`, `width: 794px`. Contains the `<Template />`.
- After measuring `templateHeight`, compute page break positions: for each integer `i` from 1 to `Math.floor(templateHeight / 1123)`, render an absolutely-positioned overlay div at `top: i * 1123 * fitScale`.
- Page break overlay style: full-width dashed border, semi-transparent background label ("Page 2" etc.), pointer-events none.
- The outer scroll container (`flex-1 overflow-auto`) wraps the outer wrapper and centres it horizontally.

---

## Feature 2: Two-Column Section Assignment

### Behaviour

- When `meta.layout === 'two-column'`, each section (built-in and custom) can be placed in the **left** or **right** column.
- Placement persists in `meta.columnAssignment`.
- When not set for a section, the template default applies: `work`, `education`, `volunteer`, and all `custom:*` sections default to **left**; `skills`, `languages`, and all other built-in sections default to **right**.
- Column assignment is ignored in single-column mode (stored but not applied).
- Section ordering within each column follows `meta.sectionOrder` (relative order of sections assigned to that column).

### Data Model

Add to `ResumeMetaSchema`:

```ts
columnAssignment: z.record(z.string(), z.enum(['left', 'right'])).default({})
```

Add the same optional field to `ResumeMetaPatchSchema`:

```ts
columnAssignment: z.record(z.string(), z.enum(['left', 'right'])).optional()
```

Keys are section identifiers: `'work'`, `'education'`, `'skills'`, `'volunteer'`, `'languages'`, `'custom:sectionId'`. Only explicit overrides are stored; absent keys use template defaults.

### UI — Design Panel

A new **"Section columns"** block appears in `DesignPanel` immediately below the Layout toggle, **only when `meta.layout === 'two-column'`**.

The block renders a flat ordered list of all sections currently in `meta.sectionOrder` (plus any custom sections). Each row contains:

- `⠿` drag handle (dnd-kit `useSortable`) — reorders within the flat list, updating `meta.sectionOrder`
- Section name label
- **LEFT / RIGHT pill toggle** — the active side is filled indigo, the inactive side is ghost. Clicking toggles `meta.columnAssignment[sectionId]`.

Custom sections appear using their user-defined `name` field. Their key in `columnAssignment` is `'custom:{id}'`.

The existing section drag-to-reorder in the **Edit tab** remains unchanged and continues to update the same `meta.sectionOrder`.

### Template Changes — ClassicTemplate & ModernTemplate

Replace the hardcoded filter logic in both templates' two-column branches with a shared helper:

```ts
function getColumnSide(s: string): 'left' | 'right' {
  const override = meta.columnAssignment?.[s]
  if (override) return override
  if (['work', 'education', 'volunteer'].includes(s) || s.startsWith('custom:')) return 'left'
  return 'right'
}
const leftSections  = sectionOrder.filter(s => getColumnSide(s) === 'left')
const rightSections = sectionOrder.filter(s => getColumnSide(s) === 'right')
```

`MinimalTemplate` is unchanged — it does not support two-column layout.

### DOCX Export — resume-docx.ts

The DOCX two-column table builder already has a left/right split with the same hardcoded filter. Apply the identical `getColumnSide` logic, reading from `meta.columnAssignment`, so exported DOCX files match the preview exactly.

---

## Files Changed

| File | Change |
|------|--------|
| `components/editor/PreviewTab.tsx` | ResizeObserver, two-layer scale wrapper, page break overlays |
| `components/editor/DesignPanel.tsx` | "Section columns" A2 block with dnd-kit + LEFT/RIGHT badges |
| `lib/schemas/resume.zod.ts` | Add `columnAssignment` to `ResumeMetaSchema` and patch schema |
| `components/templates/ClassicTemplate.tsx` | Replace hardcoded two-column filter with `getColumnSide` |
| `components/templates/ModernTemplate.tsx` | Same |
| `lib/export/resume-docx.ts` | Same `getColumnSide` logic for DOCX export |

---

## Out of Scope

- Configurable column width ratio (stays 58/42)
- Page break control (decorative indicators only; actual page breaks are handled by the PDF renderer)
- MinimalTemplate two-column support
- Persisting column assignment to the database (handled automatically via existing auto-save of `meta`)
