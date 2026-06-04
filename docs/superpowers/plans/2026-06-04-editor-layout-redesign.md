# Editor Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full-screen tab switcher with a persistent split-panel layout — left panel (Edit/Design/ATS tabs) always visible beside a live preview panel, with section reordering moved into the Edit accordion headers.

**Architecture:** `EditorShell` becomes a two-panel flex layout: fixed 320px left panel with tab navigation, and a flex-1 right panel showing the live preview at all times. A `previewExpanded` boolean collapses the left panel to a 36px icon sidebar. `AccordionSection` gains optional `onMoveUp`/`onMoveDown` props, wired by `EditTab` for all sections except `basics`. The `SectionOrderEditor` in `DesignPanel` is removed (replaced by the accordion arrows). Zoom controls are removed from `PreviewTab` — always-fit is correct for the narrower panel.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Zustand, Tailwind CSS, Vitest + React Testing Library

---

## File Map

| File | Change |
|------|--------|
| `components/editor/AccordionSection.tsx` | Add optional `onMoveUp?` / `onMoveDown?` props; render ↑↓ buttons in header |
| `components/editor/AccordionSection.test.tsx` | Add 4 tests for reorder buttons |
| `components/editor/EditTab.tsx` | Add `moveSection` + wire `onMoveUp`/`onMoveDown` to all non-basics accordion sections |
| `components/editor/EditTab.test.tsx` | New file — 4 tests for section reordering |
| `components/editor/DesignPanel.tsx` | Remove `SECTION_LABELS`, `moveSection`, and Section Order UI block |
| `components/editor/DesignPanel.test.tsx` | Remove the 5 `DesignPanel — Section Order` tests |
| `components/editor/PreviewTab.tsx` | Remove zoom state and zoom sub-header; always render at fit scale |
| `components/editor/EditorShell.tsx` | Full restructure to split-panel layout with `previewExpanded` state |

---

## Task 1: AccordionSection — add optional reorder props

**Files:**
- Modify: `components/editor/AccordionSection.tsx`
- Modify: `components/editor/AccordionSection.test.tsx`

- [ ] **Step 1: Add 4 failing tests to `AccordionSection.test.tsx`**

Append these 4 tests inside the existing `describe('AccordionSection', ...)` block, after the last existing test (after line 44, before the closing `})`):

```tsx
  it('does not render ↑↓ buttons when callbacks are omitted', () => {
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={vi.fn()}>
        {null}
      </AccordionSection>
    )
    expect(screen.queryByRole('button', { name: /move work experience up/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /move work experience down/i })).toBeNull()
  })

  it('renders ↑ button when onMoveUp provided, ↓ when onMoveDown provided', () => {
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={vi.fn()}
        onMoveUp={vi.fn()} onMoveDown={vi.fn()}>
        {null}
      </AccordionSection>
    )
    expect(screen.getByRole('button', { name: /move work experience up/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /move work experience down/i })).toBeTruthy()
  })

  it('clicking ↑ calls onMoveUp and does NOT call onToggle', () => {
    const onMoveUp = vi.fn()
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={onToggle} onMoveUp={onMoveUp}>
        {null}
      </AccordionSection>
    )
    fireEvent.click(screen.getByRole('button', { name: /move work experience up/i }))
    expect(onMoveUp).toHaveBeenCalledOnce()
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('clicking ↓ calls onMoveDown and does NOT call onToggle', () => {
    const onMoveDown = vi.fn()
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={onToggle} onMoveDown={onMoveDown}>
        {null}
      </AccordionSection>
    )
    fireEvent.click(screen.getByRole('button', { name: /move work experience down/i }))
    expect(onMoveDown).toHaveBeenCalledOnce()
    expect(onToggle).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run tests to verify the 4 new ones fail**

```bash
cd cv-builder && npx vitest run components/editor/AccordionSection.test.tsx --reporter=verbose
```

Expected: 4 existing tests pass, 4 new tests fail with "Unable to find an accessible element..."

- [ ] **Step 3: Rewrite `AccordionSection.tsx` to add the new props**

Replace the entire file with:

```tsx
'use client'

interface AccordionSectionProps {
  title: string
  badge?: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function AccordionSection({
  title,
  badge,
  isOpen,
  onToggle,
  children,
  onMoveUp,
  onMoveDown,
}: AccordionSectionProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-white hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-sm text-gray-800">{title}</span>
        <div className="flex items-center gap-1">
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 mr-1">
              {badge}
            </span>
          )}
          {onMoveUp && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveUp() }}
              className="p-1 text-gray-400 hover:text-gray-700 rounded"
              aria-label={`Move ${title} up`}
            >
              ↑
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveDown() }}
              className="p-1 text-gray-400 hover:text-gray-700 rounded"
              aria-label={`Move ${title} down`}
            >
              ↓
            </button>
          )}
          <span className="text-gray-400 text-xs ml-1">{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">{children}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run all tests to verify 8/8 pass**

```bash
npx vitest run components/editor/AccordionSection.test.tsx --reporter=verbose
```

Expected: 8 tests pass (4 existing + 4 new). Full suite: `npx vitest run` → all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/editor/AccordionSection.tsx components/editor/AccordionSection.test.tsx
git commit -m "feat: add optional onMoveUp/onMoveDown props to AccordionSection"
```

---

## Task 2: EditTab — wire section reordering

**Files:**
- Modify: `components/editor/EditTab.tsx`
- Create: `components/editor/EditTab.test.tsx`

- [ ] **Step 1: Create `EditTab.test.tsx` with 4 failing tests**

Create `components/editor/EditTab.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditTab } from './EditTab'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'

vi.mock('@/lib/stores/resume-editor.store', () => ({
  useResumeEditorStore: vi.fn(),
}))

vi.mock('./forms/BasicsForm', () => ({ BasicsForm: () => <div>BasicsForm</div> }))
vi.mock('./forms/WorkForm', () => ({ WorkForm: () => <div>WorkForm</div> }))
vi.mock('./forms/EducationForm', () => ({ EducationForm: () => <div>EducationForm</div> }))
vi.mock('./forms/SkillsForm', () => ({ SkillsForm: () => <div>SkillsForm</div> }))
vi.mock('./forms/CertificatesForm', () => ({ CertificatesForm: () => <div>CertificatesForm</div> }))
vi.mock('./forms/ProjectsForm', () => ({ ProjectsForm: () => <div>ProjectsForm</div> }))
vi.mock('./forms/LanguagesForm', () => ({ LanguagesForm: () => <div>LanguagesForm</div> }))
vi.mock('./forms/VolunteerForm', () => ({ VolunteerForm: () => <div>VolunteerForm</div> }))
vi.mock('./forms/AwardsForm', () => ({ AwardsForm: () => <div>AwardsForm</div> }))
vi.mock('./forms/PublicationsForm', () => ({ PublicationsForm: () => <div>PublicationsForm</div> }))
vi.mock('./forms/InterestsForm', () => ({ InterestsForm: () => <div>InterestsForm</div> }))

const setMeta = vi.fn()
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

beforeEach(() => {
  setMeta.mockClear()
  vi.mocked(useResumeEditorStore).mockImplementation((sel: (s: any) => any) =>
    sel({ meta: baseMeta, data: {}, setMeta })
  )
})

describe('EditTab — section reordering', () => {
  it('renders Personal Info (basics) first, then sections in sectionOrder', () => {
    render(<EditTab />)
    expect(screen.getByRole('button', { name: /personal info/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /work experience/i })).toBeTruthy()
  })

  it('basics section has no ↑↓ reorder buttons', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /move personal info/i })).toBeNull()
  })

  it('first section in sectionOrder has ↓ but no ↑', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /move work experience up/i })).toBeNull()
    expect(screen.getByRole('button', { name: /move work experience down/i })).toBeTruthy()
  })

  it('clicking ↓ on a section calls setMeta with the swapped sectionOrder', () => {
    render(<EditTab />)
    fireEvent.click(screen.getByRole('button', { name: /move work experience down/i }))
    expect(setMeta).toHaveBeenCalledWith({ sectionOrder: ['education', 'work', 'skills'] })
  })
})
```

- [ ] **Step 2: Run tests to verify all 4 fail**

```bash
npx vitest run components/editor/EditTab.test.tsx --reporter=verbose
```

Expected: 4 tests fail (EditTab has no reorder logic yet).

- [ ] **Step 3: Update `EditTab.tsx` to wire reordering**

Replace the entire file with:

```tsx
'use client'

import { useState } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { AccordionSection } from './AccordionSection'
import { BasicsForm } from './forms/BasicsForm'
import { WorkForm } from './forms/WorkForm'
import { EducationForm } from './forms/EducationForm'
import { SkillsForm } from './forms/SkillsForm'
import { CertificatesForm } from './forms/CertificatesForm'
import { ProjectsForm } from './forms/ProjectsForm'
import { LanguagesForm } from './forms/LanguagesForm'
import { VolunteerForm } from './forms/VolunteerForm'
import { AwardsForm } from './forms/AwardsForm'
import { PublicationsForm } from './forms/PublicationsForm'
import { InterestsForm } from './forms/InterestsForm'
import type { ResumeData } from '@/lib/schemas/resume.zod'

const SECTION_LABELS: Record<string, string> = {
  basics: 'Personal Info', work: 'Work Experience', education: 'Education',
  skills: 'Skills', certificates: 'Certifications', projects: 'Projects',
  languages: 'Languages', volunteer: 'Volunteer', awards: 'Awards',
  publications: 'Publications', interests: 'Interests',
}

const SECTION_FORMS: Record<string, React.ComponentType> = {
  basics: BasicsForm, work: WorkForm, education: EducationForm,
  skills: SkillsForm, certificates: CertificatesForm, projects: ProjectsForm,
  languages: LanguagesForm, volunteer: VolunteerForm, awards: AwardsForm,
  publications: PublicationsForm, interests: InterestsForm,
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

export function EditTab() {
  const [openSection, setOpenSection] = useState<string | null>('basics')
  const meta = useResumeEditorStore((s) => s.meta)
  const data = useResumeEditorStore((s) => s.data)
  const setMeta = useResumeEditorStore((s) => s.setMeta)

  const orderedSections = meta.sectionOrder?.length > 0
    ? meta.sectionOrder
    : ['work', 'education', 'skills', 'certificates', 'awards', 'publications', 'volunteer', 'languages', 'interests', 'projects']

  const sectionOrder = ['basics', ...orderedSections]

  function moveSection(metaIdx: number, direction: 'up' | 'down') {
    const order = [...orderedSections]
    const swapIdx = direction === 'up' ? metaIdx - 1 : metaIdx + 1
    ;[order[metaIdx], order[swapIdx]] = [order[swapIdx], order[metaIdx]]
    setMeta({ sectionOrder: order })
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-2">
      {sectionOrder.map((section, idx) => {
        const FormComponent = SECTION_FORMS[section]
        if (!FormComponent) return null

        const isBasics = section === 'basics'
        const metaIdx = idx - 1 // index within orderedSections (basics is prepended at idx 0)

        return (
          <AccordionSection
            key={section}
            title={SECTION_LABELS[section] ?? section}
            badge={getBadge(section, data)}
            isOpen={openSection === section}
            onToggle={() => setOpenSection((prev) => (prev === section ? null : section))}
            onMoveUp={(!isBasics && metaIdx > 0) ? () => moveSection(metaIdx, 'up') : undefined}
            onMoveDown={(!isBasics && metaIdx < orderedSections.length - 1) ? () => moveSection(metaIdx, 'down') : undefined}
          >
            <FormComponent />
          </AccordionSection>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify all 4 pass**

```bash
npx vitest run components/editor/EditTab.test.tsx --reporter=verbose
```

Expected: 4/4 pass. Then verify full suite:

```bash
npx vitest run --reporter=verbose
```

Expected: all tests pass (count increases by 4).

- [ ] **Step 5: Commit**

```bash
git add components/editor/EditTab.tsx components/editor/EditTab.test.tsx
git commit -m "feat: wire section reorder arrows into EditTab accordion headers"
```

---

## Task 3: DesignPanel — remove SectionOrderEditor

**Files:**
- Modify: `components/editor/DesignPanel.tsx`
- Modify: `components/editor/DesignPanel.test.tsx`

- [ ] **Step 1: Remove `SECTION_LABELS` and `moveSection` from `DesignPanel.tsx`**

At the top of `DesignPanel.tsx`, remove the `SECTION_LABELS` constant and `moveSection` function (they were added in Phase 4). Specifically, remove:

```ts
const SECTION_LABELS: Record<string, string> = {
  work: 'Work Experience',
  education: 'Education',
  skills: 'Skills',
  certificates: 'Certifications',
  awards: 'Awards',
  publications: 'Publications',
  volunteer: 'Volunteering',
  languages: 'Languages',
  interests: 'Interests',
  projects: 'Projects',
}

function moveSection(index: number, direction: 'up' | 'down', meta: ResumeMeta, setMeta: (patch: Partial<ResumeMeta>) => void) {
```

(Read the file first to get the exact text, then remove.)

- [ ] **Step 2: Remove the Section Order UI block from `DesignPanel.tsx`**

Remove the entire `{/* Section Order */}` block (lines 160–195). The file should end after the line-spacing `</div>` block, before the outer closing `</div>` and `}`. Specifically remove:

```tsx
      {/* Section Order */}
      <div>
        <p className={labelClass}>Section Order</p>
        <div className="space-y-1">
          {meta.sectionOrder.map((section, index) => (
            <div
              key={section}
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 bg-white"
            >
              <span className="text-sm text-gray-700">
                {SECTION_LABELS[section] ?? section}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label={`Move up ${SECTION_LABELS[section] ?? section}`}
                  disabled={index === 0}
                  onClick={() => moveSection(index, 'up')}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={`Move down ${SECTION_LABELS[section] ?? section}`}
                  disabled={index === meta.sectionOrder.length - 1}
                  onClick={() => moveSection(index, 'down')}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
```

- [ ] **Step 3: Remove the 5 SectionOrderEditor tests from `DesignPanel.test.tsx`**

Delete the entire `describe('DesignPanel — Section Order', ...)` block (lines 32–82). The file should retain only the imports and `beforeEach` at the top. After removal the file will have no `describe` block — add a placeholder so it's not empty, or leave just the imports. Actually, keep the file as-is minus the describe block — Vitest handles test files with no tests.

The simplest approach: replace the entire file with just the imports and beforeEach (no describe block), keeping it ready for future DesignPanel tests:

```tsx
// @vitest-environment jsdom
import { beforeEach } from 'vitest'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0,
  lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills', 'certificates', 'awards'],
  layout: 'single-column',
}

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1',
    title: 'CV',
    data: {},
    meta: defaultMeta,
    isDirty: false,
    isSaving: false,
    saveError: null,
  })
})
```

- [ ] **Step 4: Run TypeScript and tests**

```bash
npx tsc --noEmit
npx vitest run --reporter=verbose
```

Expected: TypeScript clean, all tests pass (count is 5 fewer than before — the removed DesignPanel tests).

- [ ] **Step 5: Commit**

```bash
git add components/editor/DesignPanel.tsx components/editor/DesignPanel.test.tsx
git commit -m "refactor: remove SectionOrderEditor from DesignPanel (moved to EditTab accordion)"
```

---

## Task 4: PreviewTab — remove zoom controls

**Files:**
- Modify: `components/editor/PreviewTab.tsx`

- [ ] **Step 1: Rewrite `PreviewTab.tsx` without zoom state or sub-header**

Replace the entire file with:

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

export function PreviewTab() {
  const data = useResumeEditorStore((s) => s.data)
  const meta = useResumeEditorStore((s) => s.meta)
  const debouncedData = useDebounce(data, 300)
  const debouncedMeta = useDebounce(meta, 300)
  const containerRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(0.75)

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setFitScale(Math.min(1, (containerRef.current.clientWidth - 64) / 794))
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const Template = TEMPLATES[debouncedMeta.templateId] ?? ClassicTemplate

  return (
    <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100 flex justify-center py-8">
      <div style={{ transform: `scale(${fitScale})`, transformOrigin: 'top center' }}>
        <Template data={debouncedData} meta={debouncedMeta} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript and tests**

```bash
npx tsc --noEmit
npx vitest run --reporter=verbose
```

Expected: TypeScript clean, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/editor/PreviewTab.tsx
git commit -m "refactor: remove zoom controls from PreviewTab — always fit scale in split panel"
```

---

## Task 5: EditorShell — split-panel layout

**Files:**
- Modify: `components/editor/EditorShell.tsx`

- [ ] **Step 1: Rewrite `EditorShell.tsx` with split-panel layout**

Replace the entire file with:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useResumeEditorStore, initAutoSave } from '@/lib/stores/resume-editor.store'
import { EditTab } from './EditTab'
import { PreviewTab } from './PreviewTab'
import { DesignPanel } from './DesignPanel'
import { AtsScorePanel } from '@/components/ats/AtsScorePanel'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

type LeftTab = 'edit' | 'design' | 'ats'

const LEFT_TAB_LABELS: Record<LeftTab, string> = { edit: 'Edit', design: 'Design', ats: 'ATS' }

export interface EditorShellProps {
  resumeId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
}

export function EditorShell({ resumeId, title, data, meta }: EditorShellProps) {
  const [activeTab, setActiveTab] = useState<LeftTab>('edit')
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const storeTitle = useResumeEditorStore((s) => s.title)
  const isDirty = useResumeEditorStore((s) => s.isDirty)
  const isSaving = useResumeEditorStore((s) => s.isSaving)
  const saveError = useResumeEditorStore((s) => s.saveError)
  const setTitle = useResumeEditorStore((s) => s.setTitle)
  const hydrate = useResumeEditorStore((s) => s.hydrate)

  useEffect(() => {
    hydrate(resumeId, title, data, meta)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return initAutoSave()
  }, [])

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
    <div className="flex h-screen bg-white overflow-hidden">

      {/* LEFT PANEL — collapses to slim sidebar when previewExpanded */}
      {previewExpanded ? (
        <div className="w-9 shrink-0 bg-slate-800 flex flex-col items-center py-4 gap-6">
          {(['edit', 'design', 'ats'] as LeftTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setPreviewExpanded(false); setActiveTab(tab) }}
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              className={`text-xs font-medium capitalize transition-colors ${
                activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {LEFT_TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      ) : (
        <div className="w-80 shrink-0 flex flex-col border-r border-gray-200">
          {/* Title + save status */}
          <header className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 shrink-0">
            <input
              type="text"
              value={storeTitle}
              onChange={(e) => setTitle(e.target.value)}
              className="font-semibold text-sm bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 min-w-0 flex-1"
            />
            <span className={`text-xs shrink-0 ${saveError ? 'text-red-500' : 'text-gray-400'}`}>
              {saveError ?? saveStatus}
            </span>
          </header>

          {/* Tab bar */}
          <div className="flex border-b border-gray-200 shrink-0">
            {(['edit', 'design', 'ats'] as LeftTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {LEFT_TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            <div className={`h-full ${activeTab === 'edit' ? 'overflow-auto' : 'hidden'}`}>
              <EditorErrorBoundary><EditTab /></EditorErrorBoundary>
            </div>
            <div className={`h-full ${activeTab === 'design' ? 'overflow-auto' : 'hidden'}`}>
              <EditorErrorBoundary><DesignPanel /></EditorErrorBoundary>
            </div>
            <div className={`h-full ${activeTab === 'ats' ? 'overflow-auto' : 'hidden'}`}>
              <EditorErrorBoundary><AtsScorePanel /></EditorErrorBoundary>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT PANEL — always-visible preview */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Preview header: label + exports + expand toggle */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white shrink-0">
          <span className="text-xs font-medium text-gray-500 flex-1">Live Preview</span>
          <button
            onClick={handleJsonExport}
            className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            JSON
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            PDF
          </button>
          <button
            onClick={() => handleExport('docx')}
            className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            DOCX
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button
            onClick={() => setPreviewExpanded((v) => !v)}
            title={previewExpanded ? 'Collapse preview' : 'Expand preview'}
            className={`text-sm border rounded px-2 py-1.5 transition-colors ${
              previewExpanded
                ? 'border-blue-300 bg-blue-50 text-blue-600'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            ⛶
          </button>
        </div>

        {/* Preview canvas */}
        <EditorErrorBoundary>
          <PreviewTab />
        </EditorErrorBoundary>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript and all tests**

```bash
npx tsc --noEmit
npx vitest run --reporter=verbose
```

Expected: TypeScript clean, all tests pass.

- [ ] **Step 3: Run Next.js production build**

```bash
npx next build
```

Expected: build completes with no errors. Note any warnings but do not fail on them.

- [ ] **Step 4: Commit**

```bash
git add components/editor/EditorShell.tsx
git commit -m "feat: redesign editor to split-panel layout with persistent live preview"
```

---

## Verification

After all 5 tasks are committed, run the full suite one final time:

```bash
npx vitest run --reporter=verbose
npx tsc --noEmit
```

Expected final state:
- All tests pass
- TypeScript clean
- `EditorShell` renders left panel + always-visible preview side by side
- ↑↓ buttons appear on each accordion section in EditTab (except Personal Info)
- DesignPanel has no Section Order UI
- PreviewTab has no zoom controls
- ⛶ collapses the left panel to a 36px dark sidebar; clicking again restores it
