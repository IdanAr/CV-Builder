# A4 Preview Fix & Two-Column Section Assignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the preview to show A4 dimensions with correct scrolling and page-break indicators, and let users assign each section to the left or right column in two-column mode.

**Architecture:** A shared `getColumnSide` pure utility centralises the left/right defaulting logic and is consumed by both templates and the DOCX exporter. Column assignments are stored as `meta.columnAssignment: Record<string, 'left'|'right'>` with an empty default (so existing resumes fall back to template defaults). The DesignPanel grows an A2 flat-list with dnd-kit drag-to-reorder and LEFT/RIGHT pill toggles, visible only when two-column layout is active. The PreviewTab switches from a bare CSS scale to a two-layer wrapper whose outer dimensions match the post-scale visual size, with page-break indicator overlays.

**Tech Stack:** Next.js 14, TypeScript, Zod, Zustand, Tailwind CSS, @dnd-kit/core + @dnd-kit/sortable (already installed), Vitest + @testing-library/react

---

## File Map

| File | Action |
|------|--------|
| `cv-builder/lib/get-column-side.ts` | **Create** — pure utility function |
| `cv-builder/lib/__tests__/get-column-side.test.ts` | **Create** — unit tests |
| `cv-builder/lib/schemas/resume.zod.ts` | **Modify** — add `columnAssignment` field |
| `cv-builder/lib/schemas/__tests__/resume-meta.test.ts` | **Create** — schema tests |
| `cv-builder/components/templates/ClassicTemplate.tsx` | **Modify** — use `getColumnSide` |
| `cv-builder/components/templates/ModernTemplate.tsx` | **Modify** — use `getColumnSide` |
| `cv-builder/lib/docx/resume-docx.ts` | **Modify** — use `getColumnSide` |
| `cv-builder/lib/docx/__tests__/resume-docx.test.ts` | **Modify** — update defaultMeta + add column-override test |
| `cv-builder/components/editor/DesignPanel.tsx` | **Modify** — A2 column assignment block |
| `cv-builder/components/editor/DesignPanel.test.tsx` | **Modify** — update defaultMeta + new column UI tests |
| `cv-builder/components/editor/PreviewTab.tsx` | **Modify** — ResizeObserver, two-layer wrapper, page breaks |

---

## Task 1: Create `getColumnSide` utility and schema field

**Files:**
- Create: `cv-builder/lib/get-column-side.ts`
- Create: `cv-builder/lib/__tests__/get-column-side.test.ts`
- Create: `cv-builder/lib/schemas/__tests__/resume-meta.test.ts`
- Modify: `cv-builder/lib/schemas/resume.zod.ts`

- [ ] **Step 1: Write failing tests for `getColumnSide`**

Create `cv-builder/lib/__tests__/get-column-side.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getColumnSide } from '../get-column-side'

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
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd cv-builder && npx vitest run lib/__tests__/get-column-side.test.ts --reporter verbose
```

Expected: FAIL — "Cannot find module '../get-column-side'"

- [ ] **Step 3: Create `getColumnSide` utility**

Create `cv-builder/lib/get-column-side.ts`:

```ts
const LEFT_DEFAULTS = new Set(['work', 'education', 'volunteer'])

export function getColumnSide(
  section: string,
  columnAssignment: Record<string, 'left' | 'right'>,
): 'left' | 'right' {
  const override = columnAssignment[section]
  if (override) return override
  if (LEFT_DEFAULTS.has(section) || section.startsWith('custom:')) return 'left'
  return 'right'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd cv-builder && npx vitest run lib/__tests__/get-column-side.test.ts --reporter verbose
```

Expected: 9 tests PASS

- [ ] **Step 5: Write failing schema tests**

Create `cv-builder/lib/schemas/__tests__/resume-meta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ResumeMetaSchema, PatchResumeSchema } from '../resume.zod'

describe('ResumeMetaSchema', () => {
  it('defaults columnAssignment to empty object', () => {
    const result = ResumeMetaSchema.parse({})
    expect(result.columnAssignment).toEqual({})
  })

  it('accepts valid columnAssignment entries', () => {
    const result = ResumeMetaSchema.parse({
      columnAssignment: { work: 'right', skills: 'left' },
    })
    expect(result.columnAssignment).toEqual({ work: 'right', skills: 'left' })
  })
})

describe('PatchResumeSchema meta.columnAssignment', () => {
  it('accepts a partial columnAssignment in a meta patch', () => {
    const result = PatchResumeSchema.parse({
      meta: { columnAssignment: { skills: 'left' } },
    })
    expect(result.meta?.columnAssignment).toEqual({ skills: 'left' })
  })

  it('accepts a patch with no columnAssignment', () => {
    const result = PatchResumeSchema.parse({ meta: {} })
    expect(result.meta?.columnAssignment).toBeUndefined()
  })
})
```

- [ ] **Step 6: Run to verify schema tests fail**

```bash
cd cv-builder && npx vitest run lib/schemas/__tests__/resume-meta.test.ts --reporter verbose
```

Expected: FAIL — "columnAssignment" not on ResumeMetaSchema

- [ ] **Step 7: Add `columnAssignment` to `resume.zod.ts`**

In `cv-builder/lib/schemas/resume.zod.ts`, add the field to `ResumeMetaSchema` (after the `layout` line):

```ts
// Before:
  layout: z.enum(['single-column', 'two-column']).default('single-column'),
})

// After:
  layout: z.enum(['single-column', 'two-column']).default('single-column'),
  columnAssignment: z.record(z.string(), z.enum(['left', 'right'])).default({}),
})
```

Add the same optional field to `ResumeMetaPatchSchema` (after the `layout` line):

```ts
// Before:
  layout: z.enum(['single-column', 'two-column']).optional(),
})

// After:
  layout: z.enum(['single-column', 'two-column']).optional(),
  columnAssignment: z.record(z.string(), z.enum(['left', 'right'])).optional(),
})
```

- [ ] **Step 8: Run schema tests to verify they pass**

```bash
cd cv-builder && npx vitest run lib/schemas/__tests__/resume-meta.test.ts --reporter verbose
```

Expected: 4 tests PASS

- [ ] **Step 9: Update `defaultMeta` in all existing test files**

The `ResumeMeta` TypeScript type now requires `columnAssignment`. Add `columnAssignment: {}` to every `defaultMeta` object in the two existing test files:

In `cv-builder/components/editor/DesignPanel.test.tsx`, change:
```ts
const defaultMeta: ResumeMeta = {
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0,
  lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column',
}
```
to:
```ts
const defaultMeta: ResumeMeta = {
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0,
  lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column',
  columnAssignment: {},
}
```

In `cv-builder/lib/docx/__tests__/resume-docx.test.ts`, apply the same change to its `defaultMeta`.

- [ ] **Step 10: Run the full test suite to verify no regressions**

```bash
cd cv-builder && npx vitest run --reporter verbose
```

Expected: all previously passing tests still PASS

- [ ] **Step 11: Commit**

```bash
cd cv-builder && git add lib/get-column-side.ts lib/__tests__/get-column-side.test.ts lib/schemas/resume.zod.ts lib/schemas/__tests__/resume-meta.test.ts components/editor/DesignPanel.test.tsx lib/docx/__tests__/resume-docx.test.ts
git commit -m "feat: add columnAssignment to ResumeMeta schema and getColumnSide utility"
```

---

## Task 2: Update ClassicTemplate and ModernTemplate

**Files:**
- Modify: `cv-builder/components/templates/ClassicTemplate.tsx`
- Modify: `cv-builder/components/templates/ModernTemplate.tsx`

- [ ] **Step 1: Update ClassicTemplate two-column branch**

In `cv-builder/components/templates/ClassicTemplate.tsx`, add the import at the top:

```ts
import { getColumnSide } from '@/lib/get-column-side'
```

In the two-column branch (around line 195), replace:

```ts
const leftSections = sectionOrder.filter((s) => ['work', 'education', 'volunteer'].includes(s) || s.startsWith('custom:'))
const rightSections = sectionOrder.filter((s) => !leftSections.includes(s))
```

with:

```ts
const leftSections = sectionOrder.filter((s) => getColumnSide(s, meta.columnAssignment ?? {}) === 'left')
const rightSections = sectionOrder.filter((s) => getColumnSide(s, meta.columnAssignment ?? {}) === 'right')
```

- [ ] **Step 2: Update ModernTemplate two-column branch**

In `cv-builder/components/templates/ModernTemplate.tsx`, add the same import:

```ts
import { getColumnSide } from '@/lib/get-column-side'
```

In the two-column branch (around line 179), replace:

```ts
const leftSections = sectionOrder.filter((s) => ['work', 'education', 'volunteer'].includes(s) || s.startsWith('custom:'))
const rightSections = sectionOrder.filter((s) => !leftSections.includes(s))
```

with:

```ts
const leftSections = sectionOrder.filter((s) => getColumnSide(s, meta.columnAssignment ?? {}) === 'left')
const rightSections = sectionOrder.filter((s) => getColumnSide(s, meta.columnAssignment ?? {}) === 'right')
```

- [ ] **Step 3: Run the full test suite**

```bash
cd cv-builder && npx vitest run --reporter verbose
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
cd cv-builder && git add components/templates/ClassicTemplate.tsx components/templates/ModernTemplate.tsx
git commit -m "feat: use getColumnSide in ClassicTemplate and ModernTemplate two-column branches"
```

---

## Task 3: Update DOCX export

**Files:**
- Modify: `cv-builder/lib/docx/resume-docx.ts`
- Modify: `cv-builder/lib/docx/__tests__/resume-docx.test.ts`

- [ ] **Step 1: Write a failing test for column override in DOCX**

In `cv-builder/lib/docx/__tests__/resume-docx.test.ts`, add after the existing two-column tests:

```ts
it('respects columnAssignment — skills moves to left cell when assigned left', async () => {
  const meta: ResumeMeta = {
    ...defaultMeta,
    layout: 'two-column',
    columnAssignment: { skills: 'left', work: 'right' },
    sectionOrder: ['work', 'education', 'skills'],
  }
  const doc = buildDocx(sampleData, meta)
  const buffer = await Packer.toBuffer(doc)
  const zip = await JSZip.loadAsync(buffer)
  const xml = await zip.file('word/document.xml')!.async('string')
  const skillsIdx = xml.indexOf('Skills')
  const workIdx = xml.indexOf('Work Experience')
  // Skills is now in the left cell so it appears before Work in XML order
  expect(skillsIdx).toBeGreaterThan(-1)
  expect(workIdx).toBeGreaterThan(-1)
  expect(skillsIdx).toBeLessThan(workIdx)
})
```

- [ ] **Step 2: Run to verify the test fails**

```bash
cd cv-builder && npx vitest run lib/docx/__tests__/resume-docx.test.ts --reporter verbose
```

Expected: last test FAIL — Skills appears after Work (hardcoded logic ignores columnAssignment)

- [ ] **Step 3: Update DOCX export to use `getColumnSide`**

In `cv-builder/lib/docx/resume-docx.ts`, add the import near the top (after existing imports):

```ts
import { getColumnSide } from '@/lib/get-column-side'
```

In the two-column body section (around line 428), replace:

```ts
const leftBuiltIn = ['work', 'education', 'volunteer']
const leftSections = sectionOrder.filter(s => leftBuiltIn.includes(s) || s.startsWith('custom:'))
const rightSections = sectionOrder.filter(s => !leftBuiltIn.includes(s) && !s.startsWith('custom:'))
```

with:

```ts
const ca = meta.columnAssignment ?? {}
const leftSections = sectionOrder.filter(s => getColumnSide(s, ca) === 'left')
const rightSections = sectionOrder.filter(s => getColumnSide(s, ca) === 'right')
```

- [ ] **Step 4: Run DOCX tests to verify all pass**

```bash
cd cv-builder && npx vitest run lib/docx/__tests__/resume-docx.test.ts --reporter verbose
```

Expected: all tests PASS

- [ ] **Step 5: Run full suite**

```bash
cd cv-builder && npx vitest run --reporter verbose
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
cd cv-builder && git add lib/docx/resume-docx.ts lib/docx/__tests__/resume-docx.test.ts
git commit -m "feat: DOCX export respects meta.columnAssignment for two-column layout"
```

---

## Task 4: DesignPanel — A2 column assignment UI

**Files:**
- Modify: `cv-builder/components/editor/DesignPanel.tsx`
- Modify: `cv-builder/components/editor/DesignPanel.test.tsx`

- [ ] **Step 1: Write failing tests for the column assignment UI**

In `cv-builder/components/editor/DesignPanel.test.tsx`, add these tests inside the existing `describe('DesignPanel')` block:

```ts
it('section columns block is hidden when layout is single-column', () => {
  render(<DesignPanel />)
  expect(screen.queryByText('Section columns')).toBeNull()
})

it('section columns block appears when layout is two-column', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    meta: { ...defaultMeta, layout: 'two-column' },
  })
  render(<DesignPanel />)
  expect(screen.getByText('Section columns')).toBeTruthy()
})

it('section column rows show current side badges', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    meta: {
      ...defaultMeta,
      layout: 'two-column',
      sectionOrder: ['work', 'skills'],
      columnAssignment: {},
    },
  })
  render(<DesignPanel />)
  // work defaults left, skills defaults right
  const leftButtons = screen.getAllByText('Left')
  const rightButtons = screen.getAllByText('Right')
  expect(leftButtons.length).toBeGreaterThan(0)
  expect(rightButtons.length).toBeGreaterThan(0)
})

it('clicking Right on a left section updates columnAssignment', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    meta: {
      ...defaultMeta,
      layout: 'two-column',
      sectionOrder: ['work', 'skills'],
      columnAssignment: {},
    },
  })
  render(<DesignPanel />)
  // First row is 'work' (left by default). Click its Right button.
  const rightButtons = screen.getAllByText('Right')
  fireEvent.click(rightButtons[0])
  expect(useResumeEditorStore.getState().meta.columnAssignment).toMatchObject({ work: 'right' })
})
```

- [ ] **Step 2: Run to verify the new tests fail**

```bash
cd cv-builder && npx vitest run components/editor/DesignPanel.test.tsx --reporter verbose
```

Expected: 4 new tests FAIL

- [ ] **Step 3: Implement the column assignment UI in DesignPanel**

Replace the full content of `cv-builder/components/editor/DesignPanel.tsx` with:

```tsx
'use client'

import React from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { getColumnSide } from '@/lib/get-column-side'

const ATS_FONTS = [
  'Calibri', 'Arial', 'Helvetica', 'Garamond', 'Cambria', 'Georgia',
  'Lato', 'Roboto', 'IBM Plex Sans',
]

const TEMPLATES = [
  { id: 'classic', label: 'Classic', desc: 'Clean, professional, thin dividers' },
  { id: 'modern', label: 'Modern', desc: 'Bold header block, accent titles' },
  { id: 'minimal', label: 'Minimal', desc: 'Typography-only, maximum ATS compatibility' },
]

const SECTION_LABELS: Record<string, string> = {
  work: 'Work Experience',
  education: 'Education',
  skills: 'Skills',
  volunteer: 'Volunteer',
  languages: 'Languages',
}

function SortableColumnRow({
  id,
  label,
  side,
  onToggle,
}: {
  id: string
  label: string
  side: 'left' | 'right'
  onToggle: (newSide: 'left' | 'right') => void
}) {
  const { listeners, attributes, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1.5 bg-white/60 border border-indigo-100 rounded-lg"
    >
      <button
        {...listeners}
        {...attributes}
        className="text-indigo-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing touch-none select-none"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <span className="flex-1 text-sm text-indigo-900 truncate">{label}</span>
      <div className="flex rounded overflow-hidden border border-indigo-200 text-xs shrink-0">
        <button
          onClick={() => onToggle('left')}
          className={`px-2 py-0.5 transition-colors ${
            side === 'left'
              ? 'bg-indigo-600 text-white font-medium'
              : 'bg-white text-indigo-400 hover:bg-indigo-50'
          }`}
        >
          Left
        </button>
        <button
          onClick={() => onToggle('right')}
          className={`px-2 py-0.5 transition-colors ${
            side === 'right'
              ? 'bg-indigo-600 text-white font-medium'
              : 'bg-white text-indigo-400 hover:bg-indigo-50'
          }`}
        >
          Right
        </button>
      </div>
    </div>
  )
}

export function DesignPanel() {
  const meta = useResumeEditorStore((s) => s.meta)
  const data = useResumeEditorStore((s) => s.data)
  const setMeta = useResumeEditorStore((s) => s.setMeta)

  const selectClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
  const labelClass = 'block text-xs font-medium text-indigo-600 mb-1'

  const orderedSections = (meta.sectionOrder?.length > 0
    ? meta.sectionOrder
    : ['work', 'education', 'skills', 'volunteer', 'languages']
  ).filter((s) => s !== 'basics')

  function getSectionLabel(id: string): string {
    if (id.startsWith('custom:')) {
      const cs = data.customSections?.find((s) => s.id === id.slice(7))
      return cs?.name ?? 'Custom Section'
    }
    return SECTION_LABELS[id] ?? id
  }

  function handleColumnDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const oldIndex = orderedSections.indexOf(String(active.id))
    const newIndex = orderedSections.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    setMeta({ sectionOrder: arrayMove(orderedSections, oldIndex, newIndex) })
  }

  function handleColumnToggle(sectionId: string, newSide: 'left' | 'right') {
    setMeta({
      columnAssignment: { ...meta.columnAssignment, [sectionId]: newSide },
    })
  }

  return (
    <div className="max-w-sm mx-auto py-6 px-4 space-y-6">
      {/* Template selector */}
      <div>
        <p className={labelClass}>Template</p>
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMeta({ templateId: t.id })}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                meta.templateId === t.id
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-indigo-100 hover:border-indigo-300'
              }`}
            >
              <div className="font-medium text-sm">{t.label}</div>
              <div className="text-xs text-indigo-400 mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Layout toggle */}
      <div>
        <p className={labelClass}>Layout</p>
        <div className="flex gap-2">
          {(['single-column', 'two-column'] as const).map((layout) => (
            <button
              key={layout}
              type="button"
              onClick={() => setMeta({ layout })}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                meta.layout === layout
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                  : 'border-indigo-100 text-indigo-500 hover:border-indigo-300'
              }`}
            >
              {layout === 'single-column' ? 'Single column' : 'Two columns'}
            </button>
          ))}
        </div>
      </div>

      {/* Section columns — only in two-column mode */}
      {meta.layout === 'two-column' && (
        <div>
          <p className={labelClass}>Section columns</p>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
            <SortableContext items={orderedSections} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {orderedSections.map((id) => (
                  <SortableColumnRow
                    key={id}
                    id={id}
                    label={getSectionLabel(id)}
                    side={getColumnSide(id, meta.columnAssignment ?? {})}
                    onToggle={(newSide) => handleColumnToggle(id, newSide)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Fonts */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Body font</label>
          <select value={meta.fontFamily} onChange={(e) => setMeta({ fontFamily: e.target.value })}
            className={selectClass}>
            {ATS_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Heading font</label>
          <select value={meta.headerFontFamily} onChange={(e) => setMeta({ headerFontFamily: e.target.value })}
            className={selectClass}>
            {ATS_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Primary color</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={meta.primaryColor}
              onChange={(e) => setMeta({ primaryColor: e.target.value })}
              className="h-8 w-10 rounded border border-indigo-200 cursor-pointer p-0.5" />
            <input type="text" value={meta.primaryColor}
              onChange={(e) => setMeta({ primaryColor: e.target.value })}
              placeholder="#000000" className="flex-1 border border-indigo-200 rounded px-2 py-1 text-xs font-mono bg-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Accent color</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={meta.accentColor}
              onChange={(e) => setMeta({ accentColor: e.target.value })}
              className="h-8 w-10 rounded border border-indigo-200 cursor-pointer p-0.5" />
            <input type="text" value={meta.accentColor}
              onChange={(e) => setMeta({ accentColor: e.target.value })}
              placeholder="#0066cc" className="flex-1 border border-indigo-200 rounded px-2 py-1 text-xs font-mono bg-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>
      </div>

      {/* Margins */}
      <div>
        <label className={labelClass}>
          Page margins — <span className="font-mono">{meta.pageMargins.toFixed(1)}&quot;</span>
        </label>
        <input type="range" min={0.5} max={1.5} step={0.1}
          value={meta.pageMargins}
          onChange={(e) => setMeta({ pageMargins: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600" />
        <div className="flex justify-between text-xs text-indigo-300 mt-0.5">
          <span>0.5&quot; (min)</span><span>1.5&quot;</span>
        </div>
      </div>

      {/* Line spacing */}
      <div>
        <label className={labelClass}>
          Line spacing — <span className="font-mono">{meta.lineSpacing.toFixed(2)}</span>
        </label>
        <input type="range" min={1.0} max={1.15} step={0.05}
          value={meta.lineSpacing}
          onChange={(e) => setMeta({ lineSpacing: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600" />
        <div className="flex justify-between text-xs text-indigo-300 mt-0.5">
          <span>1.00</span><span>1.15</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run DesignPanel tests**

```bash
cd cv-builder && npx vitest run components/editor/DesignPanel.test.tsx --reporter verbose
```

Expected: all 7 tests PASS

- [ ] **Step 5: Run full test suite**

```bash
cd cv-builder && npx vitest run --reporter verbose
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
cd cv-builder && git add components/editor/DesignPanel.tsx components/editor/DesignPanel.test.tsx
git commit -m "feat: add A2 section column assignment UI to DesignPanel"
```

---

## Task 5: PreviewTab — A4 fix with page-break indicators

**Files:**
- Modify: `cv-builder/components/editor/PreviewTab.tsx`

This task is UI-only with no pure logic to unit-test. Verification is manual.

- [ ] **Step 1: Replace PreviewTab with the A4-correct implementation**

Replace the full content of `cv-builder/components/editor/PreviewTab.tsx` with:

```tsx
'use client'

import { useRef, useEffect, useState } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { ClassicTemplate } from '@/components/templates/ClassicTemplate'
import { ModernTemplate } from '@/components/templates/ModernTemplate'
import { MinimalTemplate } from '@/components/templates/MinimalTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const TEMPLATES: Record<string, React.ComponentType<{ data: ResumeData; meta: ResumeMeta }>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
}

const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

export function PreviewTab() {
  const data = useResumeEditorStore((s) => s.data)
  const meta = useResumeEditorStore((s) => s.meta)
  const debouncedData = useDebounce(data, 300)
  const debouncedMeta = useDebounce(meta, 300)

  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(0.75)
  const [templateHeight, setTemplateHeight] = useState(A4_HEIGHT_PX)

  // Recalculate scale when container resizes
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const available = containerRef.current.clientWidth - 64
        setFitScale(Math.min(1, available / A4_WIDTH_PX))
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Track the template's actual rendered height
  useEffect(() => {
    if (!innerRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setTemplateHeight(entry.contentRect.height)
    })
    ro.observe(innerRef.current)
    return () => ro.disconnect()
  }, [])

  const Template = TEMPLATES[debouncedMeta.templateId] ?? ClassicTemplate

  const pageBreakCount = Math.floor(templateHeight / A4_HEIGHT_PX)
  const pageBreaks = Array.from({ length: pageBreakCount }, (_, i) => i + 1)

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-white/20 backdrop-blur-sm flex justify-center py-8"
    >
      {/* Outer wrapper: sized to the post-scale visual dimensions so scroll tracks correctly */}
      <div
        style={{
          position: 'relative',
          width: A4_WIDTH_PX * fitScale,
          height: templateHeight * fitScale,
          flexShrink: 0,
        }}
      >
        {/* Inner scaled template */}
        <div
          ref={innerRef}
          style={{
            transform: `scale(${fitScale})`,
            transformOrigin: 'top left',
            width: A4_WIDTH_PX,
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          <Template data={debouncedData} meta={debouncedMeta} />
        </div>

        {/* Page-break indicators */}
        {pageBreaks.map((page) => (
          <div
            key={page}
            style={{
              position: 'absolute',
              top: page * A4_HEIGHT_PX * fitScale,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{ flex: 1, borderTop: '1.5px dashed rgba(99,102,241,0.35)' }} />
            <span
              style={{
                fontSize: 9,
                color: 'rgba(99,102,241,0.55)',
                fontFamily: 'sans-serif',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}
            >
              Page {page + 1}
            </span>
            <div style={{ flex: 1, borderTop: '1.5px dashed rgba(99,102,241,0.35)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd cv-builder && npx vitest run --reporter verbose
```

Expected: all tests PASS (PreviewTab has no unit tests, but the suite must not regress)

- [ ] **Step 3: Start the dev server and verify visually**

```bash
cd cv-builder && npm run dev
```

Open the editor for any resume. Verify:
1. The preview pane shows the CV at A4 proportions, correctly scaled to fit the pane width.
2. Scrolling down reveals the full CV without large empty gaps at the bottom.
3. If the CV content exceeds one page, a dashed "Page 2" indicator appears at the 1123px boundary.
4. Resizing the browser window rescales the preview correctly.

- [ ] **Step 4: Verify column assignment end-to-end**

Still in the dev server:
1. Open the **Design** tab and switch to **Two columns**.
2. The "Section columns" block appears with all sections listed.
3. Click **Right** on "Work Experience" — the CV preview immediately moves Work to the right column.
4. Click **Left** on "Skills" — Skills moves to the left column in the preview.
5. Export to DOCX. Open the file and confirm the column placement matches the preview.

- [ ] **Step 5: Commit**

```bash
cd cv-builder && git add components/editor/PreviewTab.tsx
git commit -m "feat: A4 preview with correct scroll area and page-break indicators"
```
