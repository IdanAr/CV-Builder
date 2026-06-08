# Editor Pane UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add resizable editor/preview pane, sticky Undo/Redo strip, and drag-and-drop section ordering with preview sync fix.

**Architecture:** The resize handle lives in `EditorShell` (pointer-capture on a 4px divider div). Undo/Redo buttons move from `EditTab` into `EditorShell` as a `shrink-0` strip below the tab bar. Drag & drop replaces ↑↓ buttons via `@dnd-kit/sortable`; a `SortableAccordionItem` wrapper in `EditTab` passes dnd-kit handle props down to `AccordionSection`. The preview key bug is fixed by wrapping `renderSection` calls in `<React.Fragment key={s}>` in all three templates.

**Tech Stack:** React 18, Next.js 14, Tailwind CSS, Zustand, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, Vitest + Testing Library.

---

## File Map

| File | Change |
|---|---|
| `cv-builder/package.json` | Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| `cv-builder/components/templates/ClassicTemplate.tsx` | Fragment key fix on all `.map(renderSection)` calls |
| `cv-builder/components/templates/ModernTemplate.tsx` | Fragment key fix on all `.map(renderSection)` calls |
| `cv-builder/components/templates/MinimalTemplate.tsx` | Fragment key fix on all `.map(renderSection)` calls |
| `cv-builder/components/editor/AccordionSection.tsx` | Remove `onMoveUp`/`onMoveDown`; add optional `dragHandleProps` |
| `cv-builder/components/editor/AccordionSection.test.tsx` | Remove move-button tests; add drag handle tests |
| `cv-builder/components/editor/EditTab.tsx` | Remove Undo/Redo buttons; add dnd-kit sortable context + `SortableAccordionItem` |
| `cv-builder/components/editor/EditTab.test.tsx` | Remove move-button tests; add drag-end test; update store mock |
| `cv-builder/components/editor/EditorShell.tsx` | Add resize state/handlers/divider; add sticky Undo/Redo strip |

---

## Task 1: Install @dnd-kit

**Files:** `cv-builder/package.json`

- [ ] **Step 1: Install packages**

```bash
cd cv-builder
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Verify entries appear in package.json**

```bash
node -e "const p=require('./package.json'); ['@dnd-kit/core','@dnd-kit/sortable','@dnd-kit/utilities'].forEach(k=>console.log(k, p.dependencies[k]))"
```

Expected: three version strings printed (e.g. `^6.x.x`).

- [ ] **Step 3: Run existing test suite to confirm nothing broke**

```bash
cd cv-builder && npx vitest run
```

Expected: all tests pass (same count as before).

- [ ] **Step 4: Commit**

```bash
git add cv-builder/package.json cv-builder/package-lock.json
git commit -m "chore: install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities"
```

---

## Task 2: Fix template preview key bug

**Files (modify):**
- `cv-builder/components/templates/ClassicTemplate.tsx`
- `cv-builder/components/templates/ModernTemplate.tsx`
- `cv-builder/components/templates/MinimalTemplate.tsx`

The problem: `sectionOrder.map(renderSection)` lets React key off the element returned inside `renderSection` (`<div key="work">`). Wrapping at the map level makes the key explicit and reliable.

- [ ] **Step 1: Fix ClassicTemplate**

In `ClassicTemplate.tsx`, find every occurrence of `.map(renderSection)` and replace with the Fragment-keyed form. There are three occurrences — one in single-column layout, two in two-column layout.

Replace:
```tsx
{sectionOrder.map(renderSection)}
```
With:
```tsx
{sectionOrder.map((s) => (
  <React.Fragment key={s}>{renderSection(s)}</React.Fragment>
))}
```

Apply the same substitution to both `.map(renderSection)` calls inside the `if (meta.layout === 'two-column')` block (`leftSections.map(renderSection)` and `rightSections.map(renderSection)`).

Add `import React from 'react'` at the top if not already present (Next.js 14 with the App Router doesn't auto-import React for JSX, but `React.Fragment` needs it explicitly — alternatively use the `<>` shorthand with a key via `<React.Fragment key={s}>`).

Final import line at top of file:
```tsx
import React from 'react'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { renderCustomSection } from './renderCustomSection'
import { richTextToHtml } from '@/lib/rich-text'
```

- [ ] **Step 2: Fix ModernTemplate**

Open `cv-builder/components/templates/ModernTemplate.tsx`. Find every `.map(renderSection)` call and apply the same Fragment-key wrapper as in Step 1. Add `import React from 'react'` if missing.

- [ ] **Step 3: Fix MinimalTemplate**

Open `cv-builder/components/templates/MinimalTemplate.tsx`. Apply the same Fragment-key wrapper to all `.map(renderSection)` calls. Add `import React from 'react'` if missing.

- [ ] **Step 4: Run tests**

```bash
cd cv-builder && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add cv-builder/components/templates/ClassicTemplate.tsx \
        cv-builder/components/templates/ModernTemplate.tsx \
        cv-builder/components/templates/MinimalTemplate.tsx
git commit -m "fix(preview): explicit Fragment keys on sectionOrder.map for reliable reorder rendering"
```

---

## Task 3: Refactor AccordionSection — remove move buttons, add drag handle

**Files:**
- Modify: `cv-builder/components/editor/AccordionSection.tsx`
- Modify: `cv-builder/components/editor/AccordionSection.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the contents of `cv-builder/components/editor/AccordionSection.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccordionSection } from './AccordionSection'

// CSS.Transform.toString is from @dnd-kit/utilities; mock it for jsdom
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

describe('AccordionSection', () => {
  it('renders title and calls onToggle on click', () => {
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={onToggle}>
        {null}
      </AccordionSection>
    )
    expect(screen.getByText('Work Experience')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Work Experience' }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('shows children when isOpen is true', () => {
    render(
      <AccordionSection title="Skills" isOpen={true} onToggle={vi.fn()}>
        <span>skill content</span>
      </AccordionSection>
    )
    expect(screen.getByText('skill content')).toBeTruthy()
  })

  it('hides children when isOpen is false', () => {
    render(
      <AccordionSection title="Skills" isOpen={false} onToggle={vi.fn()}>
        <span>skill content</span>
      </AccordionSection>
    )
    expect(screen.queryByText('skill content')).toBeNull()
  })

  it('renders badge when provided', () => {
    render(
      <AccordionSection title="Work" badge="3 entries" isOpen={false} onToggle={vi.fn()}>
        {null}
      </AccordionSection>
    )
    expect(screen.getByText('3 entries')).toBeTruthy()
  })

  it('does not render drag handle when dragHandleProps is absent', () => {
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={vi.fn()}>
        {null}
      </AccordionSection>
    )
    expect(screen.queryByRole('button', { name: /drag to reorder/i })).toBeNull()
  })

  it('renders drag handle button when dragHandleProps is provided', () => {
    const dragHandleProps = {
      listeners: undefined,
      attributes: {} as any,
      setNodeRef: () => {},
      transform: null,
      transition: undefined,
      isDragging: false,
    }
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={vi.fn()} dragHandleProps={dragHandleProps}>
        {null}
      </AccordionSection>
    )
    expect(screen.getByRole('button', { name: /drag to reorder/i })).toBeTruthy()
  })

  it('renders title as plain text when onRename is not provided', () => {
    render(
      <AccordionSection title="Static Title" isOpen={false} onToggle={vi.fn()}>
        {null}
      </AccordionSection>
    )
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Static Title')).toBeTruthy()
  })

  it('renders title as input when onRename is provided', () => {
    render(
      <AccordionSection title="Custom Section" isOpen={false} onToggle={vi.fn()} onRename={vi.fn()}>
        {null}
      </AccordionSection>
    )
    const input = screen.getByRole('textbox')
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).value).toBe('Custom Section')
  })

  it('typing in the rename input calls onRename with new value, not onToggle', () => {
    const onRename = vi.fn()
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Old Name" isOpen={false} onToggle={onToggle} onRename={onRename}>
        {null}
      </AccordionSection>
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New Name' } })
    expect(onRename).toHaveBeenCalledWith('New Name')
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('does not render delete button when onDelete is not provided', () => {
    render(
      <AccordionSection title="Section" isOpen={false} onToggle={vi.fn()}>
        {null}
      </AccordionSection>
    )
    expect(screen.queryByRole('button', { name: /delete section/i })).toBeNull()
  })

  it('renders delete button and calls onDelete when provided', () => {
    const onDelete = vi.fn()
    render(
      <AccordionSection title="Section" isOpen={false} onToggle={vi.fn()} onDelete={onDelete}>
        {null}
      </AccordionSection>
    )
    const deleteBtn = screen.getByRole('button', { name: /delete section/i })
    fireEvent.click(deleteBtn)
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests to confirm the new ones fail**

```bash
cd cv-builder && npx vitest run components/editor/AccordionSection.test.tsx
```

Expected: The two new drag-handle tests fail ("drag handle button" tests). The old ↑↓ tests are now gone so no failures there.

- [ ] **Step 3: Implement the updated AccordionSection**

Replace the entire content of `cv-builder/components/editor/AccordionSection.tsx` with:

```tsx
'use client'

import type { ReactNode } from 'react'
import type { DraggableAttributes, SyntheticListenerMap } from '@dnd-kit/core'
import type { Transform } from '@dnd-kit/utilities'
import { CSS } from '@dnd-kit/utilities'

export interface DragHandleProps {
  listeners: SyntheticListenerMap | undefined
  attributes: DraggableAttributes
  setNodeRef: (el: HTMLElement | null) => void
  transform: Transform | null
  transition: string | undefined
  isDragging: boolean
}

interface AccordionSectionProps {
  title: string
  badge?: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
  onRename?: (name: string) => void
  onDelete?: () => void
  dragHandleProps?: DragHandleProps
}

export function AccordionSection({
  title,
  badge,
  isOpen,
  onToggle,
  children,
  onRename,
  onDelete,
  dragHandleProps,
}: AccordionSectionProps) {
  return (
    <div
      ref={dragHandleProps?.setNodeRef}
      style={{
        transform: CSS.Transform.toString(dragHandleProps?.transform ?? null),
        transition: dragHandleProps?.transition,
      }}
      className={`border border-indigo-100 rounded-xl overflow-hidden bg-white/60 backdrop-blur-sm shadow-sm group${
        dragHandleProps?.isDragging ? ' opacity-60 border-dashed border-indigo-400' : ''
      }`}
    >
      <div className="flex items-center gap-1 pr-2 bg-white/70 hover:bg-white/90 transition-colors">
        {dragHandleProps && (
          <button
            type="button"
            className="pl-2 pr-1 py-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-indigo-300 hover:text-indigo-500 select-none"
            {...dragHandleProps.listeners}
            {...dragHandleProps.attributes}
            aria-label="Drag to reorder"
          >
            ⠿
          </button>
        )}
        {onRename ? (
          <input
            type="text"
            value={title}
            onChange={(e) => onRename(e.target.value)}
            aria-label={`Rename ${title}`}
            className="flex-1 font-medium text-sm text-indigo-900 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-300 rounded px-4 py-3 min-w-0"
          />
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className="flex-1 flex items-center gap-2 px-4 py-3 text-left min-w-0"
          >
            <span className="font-medium text-sm text-indigo-900">{title}</span>
            {badge && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 shrink-0">
                {badge}
              </span>
            )}
          </button>
        )}
        {onRename && badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 shrink-0">
            {badge}
          </span>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-500 rounded"
            aria-label="Delete section"
          >
            ✕
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={`Toggle ${title}`}
          className="text-indigo-300 text-xs px-3 py-3"
        >
          {isOpen ? '▲' : '▼'}
        </button>
      </div>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-indigo-100 bg-white/50">{children}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd cv-builder && npx vitest run components/editor/AccordionSection.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Run full suite to catch regressions**

```bash
cd cv-builder && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add cv-builder/components/editor/AccordionSection.tsx \
        cv-builder/components/editor/AccordionSection.test.tsx
git commit -m "feat(editor): replace move buttons with drag handle in AccordionSection"
```

---

## Task 4: Refactor EditTab — remove Undo/Redo buttons, add dnd-kit sortable

**Files:**
- Modify: `cv-builder/components/editor/EditTab.tsx`
- Modify: `cv-builder/components/editor/EditTab.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the contents of `cv-builder/components/editor/EditTab.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditTab } from './EditTab'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import type { CustomSection, CustomSectionFieldType } from '@/lib/schemas/resume.zod'

vi.mock('@/lib/stores/resume-editor.store', () => ({
  useResumeEditorStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}))

vi.mock('./forms/BasicsForm', () => ({ BasicsForm: () => <div>BasicsForm</div> }))
vi.mock('./forms/WorkForm', () => ({ WorkForm: () => <div>WorkForm</div> }))
vi.mock('./forms/EducationForm', () => ({ EducationForm: () => <div>EducationForm</div> }))
vi.mock('./forms/SkillsForm', () => ({ SkillsForm: () => <div>SkillsForm</div> }))
vi.mock('./forms/LanguagesForm', () => ({ LanguagesForm: () => <div>LanguagesForm</div> }))
vi.mock('./forms/VolunteerForm', () => ({ VolunteerForm: () => <div>VolunteerForm</div> }))
vi.mock('./forms/CustomSectionForm', () => ({
  CustomSectionForm: ({ sectionId }: { sectionId: string }) => <div>CustomSectionForm:{sectionId}</div>,
}))
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

// Capture the onDragEnd callback registered by DndContext so tests can invoke it directly
let capturedOnDragEnd: ((event: { active: { id: string }; over: { id: string } | null }) => void) | null = null
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core')
  return {
    ...(actual as object),
    DndContext: ({ onDragEnd, children }: { onDragEnd: (e: any) => void; children: any }) => {
      capturedOnDragEnd = onDragEnd
      return <>{children}</>
    },
  }
})
vi.mock('@dnd-kit/sortable', async () => {
  const actual = await vi.importActual('@dnd-kit/sortable')
  return {
    ...(actual as object),   // keeps arrayMove from the real package
    SortableContext: ({ children }: { children: any }) => <>{children}</>,
    useSortable: () => ({
      listeners: undefined,
      attributes: {},
      setNodeRef: () => {},
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
  }
})

const setMeta = vi.fn()
const addCustomSection = vi.fn()
const updateCustomSection = vi.fn()
const removeCustomSection = vi.fn()
const undo = vi.fn()
const redo = vi.fn()

const baseMeta = {
  sectionOrder: ['work', 'education', 'skills'],
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0,
  lineSpacing: 1.15,
  layout: 'single-column' as const,
}

function setupStore(overrides: { sectionOrder?: string[]; customSections?: CustomSection[] } = {}) {
  const meta = { ...baseMeta, sectionOrder: overrides.sectionOrder ?? baseMeta.sectionOrder }
  const data = overrides.customSections ? { customSections: overrides.customSections } : {}
  const state = { meta, data, setMeta, addCustomSection, updateCustomSection, removeCustomSection, undo, redo }
  vi.mocked(useResumeEditorStore).mockImplementation((sel: (s: unknown) => unknown) => sel(state))
  ;(useResumeEditorStore as { getState: ReturnType<typeof vi.fn> }).getState.mockReturnValue(state)
}

beforeEach(() => {
  setMeta.mockClear()
  addCustomSection.mockClear()
  updateCustomSection.mockClear()
  removeCustomSection.mockClear()
  capturedOnDragEnd = null
  setupStore()
})

describe('EditTab — built-in sections', () => {
  it('renders Personal Info first, then sections in sectionOrder', () => {
    render(<EditTab />)
    expect(screen.getByRole('button', { name: /^personal info/i })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /work experience/i }).length).toBeGreaterThan(0)
  })

  it('basics section has no delete button', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /delete personal info/i })).toBeNull()
  })

  it('does not render Undo or Redo buttons inside EditTab', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /redo/i })).toBeNull()
  })

  it('drag end calls setMeta with reordered sectionOrder', () => {
    render(<EditTab />)
    // Simulate dragging 'work' (index 0) to 'education' position (index 1)
    capturedOnDragEnd!({ active: { id: 'work' }, over: { id: 'education' } })
    expect(setMeta).toHaveBeenCalledWith({ sectionOrder: ['education', 'work', 'skills'] })
  })

  it('drag end with no over target does not call setMeta', () => {
    render(<EditTab />)
    capturedOnDragEnd!({ active: { id: 'work' }, over: null })
    expect(setMeta).not.toHaveBeenCalled()
  })

  it('drag end with same active and over does not call setMeta', () => {
    render(<EditTab />)
    capturedOnDragEnd!({ active: { id: 'work' }, over: { id: 'work' } })
    expect(setMeta).not.toHaveBeenCalled()
  })
})

describe('EditTab — removed sections', () => {
  it('does not render Certifications section', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /certifications/i })).toBeNull()
  })

  it('does not render Awards section', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /awards/i })).toBeNull()
  })
})

describe('EditTab — custom sections', () => {
  const customSection: CustomSection = {
    id: 'cs1',
    name: 'My Certifications',
    enabledFields: ['subtitle', 'dateRange'] as CustomSectionFieldType[],
    items: [],
  }

  it('renders custom section accordion with its name as an editable input', () => {
    setupStore({
      sectionOrder: ['work', 'custom:cs1'],
      customSections: [customSection],
    })
    render(<EditTab />)
    expect(screen.getByDisplayValue('My Certifications')).toBeTruthy()
  })

  it('custom section has delete button', () => {
    setupStore({
      sectionOrder: ['work', 'custom:cs1'],
      customSections: [customSection],
    })
    render(<EditTab />)
    expect(screen.getByRole('button', { name: /delete section/i })).toBeTruthy()
  })

  it('clicking delete calls removeCustomSection with the section id', () => {
    setupStore({
      sectionOrder: ['work', 'custom:cs1'],
      customSections: [customSection],
    })
    render(<EditTab />)
    fireEvent.click(screen.getByRole('button', { name: /delete section/i }))
    expect(removeCustomSection).toHaveBeenCalledWith('cs1')
  })

  it('renders Add Section button', () => {
    render(<EditTab />)
    expect(screen.getByRole('button', { name: /add section/i })).toBeTruthy()
  })

  it('clicking Add Section calls addCustomSection with correct shape', () => {
    render(<EditTab />)
    fireEvent.click(screen.getByRole('button', { name: /add section/i }))
    expect(addCustomSection).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Section',
        enabledFields: ['summary'],
        items: [],
      })
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm the new ones fail**

```bash
cd cv-builder && npx vitest run components/editor/EditTab.test.tsx
```

Expected: `does not render Undo or Redo buttons inside EditTab` and the drag-end tests fail. The old ↑↓ tests are gone.

- [ ] **Step 3: Implement the updated EditTab**

Replace the entire content of `cv-builder/components/editor/EditTab.tsx` with:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { AccordionSection, type DragHandleProps } from './AccordionSection'
import { BasicsForm } from './forms/BasicsForm'
import { WorkForm } from './forms/WorkForm'
import { EducationForm } from './forms/EducationForm'
import { SkillsForm } from './forms/SkillsForm'
import { LanguagesForm } from './forms/LanguagesForm'
import { VolunteerForm } from './forms/VolunteerForm'
import { CustomSectionForm } from './forms/CustomSectionForm'
import type { ResumeData, CustomSection } from '@/lib/schemas/resume.zod'

const SECTION_LABELS: Record<string, string> = {
  basics: 'Personal Info',
  work: 'Work Experience',
  education: 'Education',
  skills: 'Skills',
  languages: 'Languages',
  volunteer: 'Volunteer',
}

const SECTION_FORMS: Record<string, React.ComponentType> = {
  basics: BasicsForm,
  work: WorkForm,
  education: EducationForm,
  skills: SkillsForm,
  languages: LanguagesForm,
  volunteer: VolunteerForm,
}

function getBadge(section: string, data: ResumeData): string {
  if (section === 'basics') {
    const b = data.basics ?? {}
    const filled = [b.name, b.email, b.phone].filter(Boolean).length
    return filled > 0 ? `${filled} field${filled > 1 ? 's' : ''} filled` : 'empty'
  }
  const arr = (data as Record<string, unknown[]>)[section]
  return arr?.length ? `${arr.length} ${arr.length === 1 ? 'entry' : 'entries'}` : 'empty'
}

function getCustomBadge(section: CustomSection): string {
  return section.items.length > 0
    ? `${section.items.length} ${section.items.length === 1 ? 'entry' : 'entries'}`
    : 'empty'
}

function SortableAccordionItem({
  id,
  children,
}: {
  id: string
  children: (props: DragHandleProps) => React.ReactNode
}) {
  const { listeners, attributes, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return <>{children({ listeners, attributes, setNodeRef, transform, transition, isDragging })}</>
}

export function EditTab() {
  const [openSection, setOpenSection] = useState<string | null>('basics')
  const meta = useResumeEditorStore((s) => s.meta)
  const data = useResumeEditorStore((s) => s.data)
  const setMeta = useResumeEditorStore((s) => s.setMeta)
  const addCustomSection = useResumeEditorStore((s) => s.addCustomSection)
  const updateCustomSection = useResumeEditorStore((s) => s.updateCustomSection)
  const removeCustomSection = useResumeEditorStore((s) => s.removeCustomSection)
  const undo = useResumeEditorStore((s) => s.undo)
  const redo = useResumeEditorStore((s) => s.redo)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const orderedSections = (meta.sectionOrder?.length > 0
    ? meta.sectionOrder
    : ['work', 'education', 'skills', 'volunteer', 'languages']
  ).filter((s) => s in SECTION_FORMS || s.startsWith('custom:'))

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const oldIndex = orderedSections.indexOf(String(active.id))
    const newIndex = orderedSections.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    setMeta({ sectionOrder: arrayMove(orderedSections, oldIndex, newIndex) })
  }

  function handleAddSection() {
    const newSection: CustomSection = {
      id: crypto.randomUUID(),
      name: 'New Section',
      enabledFields: ['summary'],
      items: [],
    }
    addCustomSection(newSection)
    setOpenSection(`custom:${newSection.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-2 bg-transparent">
      {/* basics is always first and not sortable */}
      <AccordionSection
        title={SECTION_LABELS['basics']}
        badge={getBadge('basics', data)}
        isOpen={openSection === 'basics'}
        onToggle={() => setOpenSection((prev) => (prev === 'basics' ? null : 'basics'))}
      >
        <BasicsForm />
      </AccordionSection>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedSections} strategy={verticalListSortingStrategy}>
          {orderedSections.map((section) => {
            if (section.startsWith('custom:')) {
              const customId = section.slice(7)
              const customSection = data.customSections?.find((cs) => cs.id === customId)
              if (!customSection) return null
              return (
                <SortableAccordionItem key={section} id={section}>
                  {(dragHandleProps) => (
                    <AccordionSection
                      title={customSection.name}
                      badge={getCustomBadge(customSection)}
                      isOpen={openSection === section}
                      onToggle={() => setOpenSection((prev) => (prev === section ? null : section))}
                      onRename={(name) => updateCustomSection(customId, { name })}
                      onDelete={() => removeCustomSection(customId)}
                      dragHandleProps={dragHandleProps}
                    >
                      <CustomSectionForm sectionId={customId} />
                    </AccordionSection>
                  )}
                </SortableAccordionItem>
              )
            }
            const FormComponent = SECTION_FORMS[section]
            if (!FormComponent) return null
            return (
              <SortableAccordionItem key={section} id={section}>
                {(dragHandleProps) => (
                  <AccordionSection
                    title={SECTION_LABELS[section] ?? section}
                    badge={getBadge(section, data)}
                    isOpen={openSection === section}
                    onToggle={() => setOpenSection((prev) => (prev === section ? null : section))}
                    dragHandleProps={dragHandleProps}
                  >
                    <FormComponent />
                  </AccordionSection>
                )}
              </SortableAccordionItem>
            )
          })}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={handleAddSection}
        className="w-full mt-2 py-2.5 border-2 border-dashed border-indigo-200 rounded-xl text-sm text-indigo-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors font-medium"
      >
        + Add Section
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run EditTab tests**

```bash
cd cv-builder && npx vitest run components/editor/EditTab.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Run full suite**

```bash
cd cv-builder && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add cv-builder/components/editor/EditTab.tsx \
        cv-builder/components/editor/EditTab.test.tsx
git commit -m "feat(editor): replace section move buttons with dnd-kit drag & drop in EditTab"
```

---

## Task 5: Refactor EditorShell — sticky Undo/Redo + resizable pane

**Files:**
- Modify: `cv-builder/components/editor/EditorShell.tsx`

No new unit tests: the resize and sticky strip are layout/pointer-event concerns that are more reliably verified by running the dev server. The existing test suite confirms no regressions.

- [ ] **Step 1: Implement the updated EditorShell**

Replace the entire content of `cv-builder/components/editor/EditorShell.tsx` with:

```tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useResumeEditorStore, initAutoSave } from '@/lib/stores/resume-editor.store'
import { EditTab } from './EditTab'
import { PreviewTab } from './PreviewTab'
import { DesignPanel } from './DesignPanel'
import { AtsScorePanel } from '@/components/ats/AtsScorePanel'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import { AppNavbar } from '@/components/ui/AppNavbar'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

type Tab = 'edit' | 'design' | 'ats'

const TAB_LABELS: Record<Tab, string> = { edit: 'Edit', design: 'Design', ats: 'ATS' }

const PANEL_WIDTH_KEY = 'cv-builder:panel-width'
const DEFAULT_PANEL_WIDTH = 320
const MIN_PANEL_WIDTH = 240

export interface EditorShellProps {
  resumeId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
}

export function EditorShell({ resumeId, title, data, meta }: EditorShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('edit')
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [dividerActive, setDividerActive] = useState(false)
  const draggingRef = useRef(false)

  const storeTitle = useResumeEditorStore((s) => s.title)
  const isDirty = useResumeEditorStore((s) => s.isDirty)
  const isSaving = useResumeEditorStore((s) => s.isSaving)
  const saveError = useResumeEditorStore((s) => s.saveError)
  const setTitle = useResumeEditorStore((s) => s.setTitle)
  const hydrate = useResumeEditorStore((s) => s.hydrate)
  const undo = useResumeEditorStore((s) => s.undo)
  const redo = useResumeEditorStore((s) => s.redo)
  const canUndo = useResumeEditorStore((s) => s.canUndo)
  const canRedo = useResumeEditorStore((s) => s.canRedo)

  useEffect(() => {
    hydrate(resumeId, title, data, meta)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return initAutoSave()
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(PANEL_WIDTH_KEY)
    if (saved) {
      const w = parseInt(saved, 10)
      if (!isNaN(w)) {
        setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(Math.floor(window.innerWidth * 0.6), w)))
      }
    }
  }, [])

  function handleDividerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    setDividerActive(true)
  }

  function handleDividerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(Math.floor(window.innerWidth * 0.6), e.clientX)))
  }

  function handleDividerPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false
    setDividerActive(false)
    const w = Math.max(MIN_PANEL_WIDTH, Math.min(Math.floor(window.innerWidth * 0.6), e.clientX))
    localStorage.setItem(PANEL_WIDTH_KEY, String(w))
  }

  function handleJsonExport() {
    const s = useResumeEditorStore.getState()
    const blob = new Blob([JSON.stringify({ data: s.data, meta: s.meta }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${s.title.replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExport(format: 'pdf' | 'docx') {
    const { resumeId: rid, title: t } = useResumeEditorStore.getState()
    try {
      const res = await fetch(`/api/resumes/${rid}/export/${format}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Export failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${t.replace(/\s+/g, '-')}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed. Please try again.')
    }
  }

  const saveStatus = isSaving ? 'Saving…' : isDirty ? '● Unsaved' : 'Saved'

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top navbar */}
      <AppNavbar
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              ← My CVs
            </Link>
            <span className="text-indigo-200">|</span>
            <span className={`text-xs ${saveError ? 'text-red-500' : 'text-indigo-400'}`}>
              {saveError ?? saveStatus}
            </span>
            <div className="w-px h-4 bg-indigo-200 mx-1" />
            <button
              onClick={handleJsonExport}
              className="text-xs border border-indigo-200 text-indigo-600 rounded px-3 py-1.5 hover:bg-indigo-50 transition-colors"
            >
              JSON
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 transition-colors"
            >
              PDF
            </button>
            <button
              onClick={() => handleExport('docx')}
              className="text-xs border border-indigo-200 text-indigo-600 rounded px-3 py-1.5 hover:bg-indigo-50 transition-colors"
            >
              DOCX
            </button>
          </div>
        }
      />

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        {previewExpanded ? (
          <div className="w-9 min-w-[36px] bg-indigo-900 flex flex-col items-center py-3 gap-4 border-r border-indigo-800 shrink-0">
            {(['edit', 'design', 'ats'] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setPreviewExpanded(false); setActiveTab(tab) }}
                className="text-xs text-indigo-300 hover:text-white transition-colors"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col border-r border-white/20 bg-white/40 backdrop-blur-xl shrink-0"
            style={{ width: panelWidth }}
          >
            {/* Title */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-indigo-100 shrink-0 bg-white/50">
              <input
                type="text"
                value={storeTitle}
                onChange={(e) => setTitle(e.target.value)}
                className="font-semibold text-sm bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 min-w-0 flex-1 text-indigo-900"
              />
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-indigo-100 shrink-0 bg-white/50">
              {(['edit', 'design', 'ats'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {/* Sticky Undo/Redo — only on Edit tab */}
            {activeTab === 'edit' && (
              <div className="flex items-center gap-1 px-3 py-1.5 border-b border-indigo-100 shrink-0 bg-indigo-50/60">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ↩ Undo
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Redo ↪
                </button>
              </div>
            )}

            {/* Tab content */}
            <div className="flex-1 overflow-auto">
              <div className={activeTab === 'edit' ? 'block' : 'hidden'}>
                <EditorErrorBoundary><EditTab /></EditorErrorBoundary>
              </div>
              <div className={activeTab === 'design' ? 'block' : 'hidden'}>
                <EditorErrorBoundary><DesignPanel /></EditorErrorBoundary>
              </div>
              <div className={activeTab === 'ats' ? 'block' : 'hidden'}>
                <EditorErrorBoundary><AtsScorePanel /></EditorErrorBoundary>
              </div>
            </div>
          </div>
        )}

        {/* Resize divider — only when panel is not collapsed */}
        {!previewExpanded && (
          <div
            className={`w-1 shrink-0 cursor-col-resize select-none transition-colors ${
              dividerActive ? 'bg-indigo-400/40' : 'hover:bg-indigo-400/40 bg-transparent'
            }`}
            onPointerDown={handleDividerPointerDown}
            onPointerMove={handleDividerPointerMove}
            onPointerUp={handleDividerPointerUp}
          />
        )}

        {/* Right panel — preview */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-indigo-100 bg-white/50 shrink-0">
            <span className="text-xs font-medium text-indigo-500 flex-1">Live Preview</span>
            <button
              onClick={() => setPreviewExpanded((v) => !v)}
              title={previewExpanded ? 'Collapse preview' : 'Expand preview'}
              className={`text-sm border rounded px-2 py-1 transition-colors ${
                previewExpanded
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                  : 'border-indigo-200 text-indigo-500 hover:bg-indigo-50'
              }`}
            >
              ⛶
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <EditorErrorBoundary><PreviewTab /></EditorErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd cv-builder && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Start the dev server and manually verify all three features**

```bash
cd cv-builder && npm run dev
```

Open `http://localhost:3000`, navigate to a resume in the editor, and verify:

1. **Resize:** Hover over the thin line between editor and preview — it turns blue. Drag left/right — the panel resizes. Refresh the page — the width is restored from localStorage.
2. **Undo/Redo:** Scroll down the section list — the Undo/Redo buttons remain pinned below the tab bar and never scroll away.
3. **Drag & drop:** Hover over a section row — a `⠿` grip appears on the left. Drag a section to a new position. Confirm the preview reorders after ~300ms.

- [ ] **Step 4: Commit**

```bash
git add cv-builder/components/editor/EditorShell.tsx
git commit -m "feat(editor): resizable pane + sticky Undo/Redo strip in EditorShell"
```
