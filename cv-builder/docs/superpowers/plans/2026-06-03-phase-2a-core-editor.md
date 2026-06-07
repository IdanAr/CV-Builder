# Phase 2a Core Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the resume editor at `/dashboard/resumes/[id]` — Zustand store, accordion form editor, debounced auto-save, live HTML/CSS preview, and design controls panel.

**Architecture:** A Zustand store (`lib/stores/resume-editor.store.ts`) holds `{ resumeId, title, data, meta }` and auto-saves via debounced PATCH. The editor page (`app/(dashboard)/dashboard/resumes/[id]/page.tsx`) stays a Server Component that fetches the resume and passes it to `<EditorShell>` (Client Component). Three HTML/CSS template components (`ClassicTemplate`, `ModernTemplate`, `MinimalTemplate`) render the live preview — `@react-pdf/renderer` is NOT used here; it is used only in the export pipeline (separate plan).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Zustand (`zustand`), existing Zod schemas (`ResumeData`, `ResumeMeta` from `lib/schemas/resume.zod.ts`), Vitest + @testing-library/react (already installed).

---

## File Map

**New:**
- `lib/hooks/use-debounce.ts`
- `lib/stores/resume-editor.store.ts`
- `lib/stores/__tests__/resume-editor.store.test.ts`
- `components/editor/AccordionSection.tsx`
- `components/editor/AccordionSection.test.tsx`
- `components/editor/forms/ListFieldManager.tsx`
- `components/editor/forms/BasicsForm.tsx`
- `components/editor/forms/BasicsForm.test.tsx`
- `components/editor/forms/WorkForm.tsx`
- `components/editor/forms/WorkForm.test.tsx`
- `components/editor/forms/EducationForm.tsx`
- `components/editor/forms/SkillsForm.tsx`
- `components/editor/forms/CertificatesForm.tsx`
- `components/editor/forms/ProjectsForm.tsx`
- `components/editor/forms/LanguagesForm.tsx`
- `components/editor/forms/VolunteerForm.tsx`
- `components/editor/forms/AwardsForm.tsx`
- `components/editor/forms/PublicationsForm.tsx`
- `components/editor/forms/InterestsForm.tsx`
- `components/editor/EditTab.tsx`
- `components/editor/PreviewTab.tsx`
- `components/editor/DesignPanel.tsx`
- `components/editor/EditorShell.tsx`
- `components/templates/ClassicTemplate.tsx`
- `components/templates/ModernTemplate.tsx`
- `components/templates/MinimalTemplate.tsx`

**Modified:**
- `app/(dashboard)/dashboard/resumes/[id]/page.tsx`
- `package.json` (add `zustand`)
- `vitest.setup.ts` (add jest-dom import)

---

### Task 1: Install Zustand and configure test environment

**Files:**
- Modify: `package.json`
- Modify: `vitest.setup.ts`

- [ ] **Step 1: Install zustand**

```bash
npm install zustand
```

Expected output: `added 1 package`

- [ ] **Step 2: Update vitest.setup.ts to import jest-dom matchers**

Replace the entire file content:

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom'
import { vi } from 'vitest'
```

- [ ] **Step 3: Verify existing tests still pass**

```bash
npm run test:run
```

Expected: all existing tests pass (12 tests in `lib/api/__tests__/resumes.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.setup.ts
git commit -m "chore: install zustand, wire jest-dom into vitest setup"
```

---

### Task 2: useDebounce hook

**Files:**
- Create: `lib/hooks/use-debounce.ts`

- [ ] **Step 1: Create the hook**

```typescript
// lib/hooks/use-debounce.ts
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/hooks/use-debounce.ts
git commit -m "feat: add useDebounce hook"
```

---

### Task 3: Zustand resume editor store

**Files:**
- Create: `lib/stores/resume-editor.store.ts`
- Create: `lib/stores/__tests__/resume-editor.store.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/stores/__tests__/resume-editor.store.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useResumeEditorStore, initAutoSave } from '../resume-editor.store'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const emptyData: ResumeData = {}
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

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: '', title: '', data: emptyData, meta: defaultMeta,
    isDirty: false, isSaving: false, saveError: null,
  })
})

describe('hydrate', () => {
  it('populates store and clears isDirty', () => {
    useResumeEditorStore.getState().hydrate('r1', 'My CV', emptyData, defaultMeta)
    const s = useResumeEditorStore.getState()
    expect(s.resumeId).toBe('r1')
    expect(s.title).toBe('My CV')
    expect(s.isDirty).toBe(false)
    expect(s.saveError).toBeNull()
  })
})

describe('setTitle', () => {
  it('updates title and marks isDirty', () => {
    useResumeEditorStore.getState().hydrate('r1', 'My CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setTitle('Updated')
    expect(useResumeEditorStore.getState().title).toBe('Updated')
    expect(useResumeEditorStore.getState().isDirty).toBe(true)
  })
})

describe('setSectionData', () => {
  it('updates work and marks isDirty', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    const work = [{ name: 'Acme', position: 'Engineer', startDate: '2020-01' }]
    useResumeEditorStore.getState().setSectionData('work', work)
    expect(useResumeEditorStore.getState().data.work).toEqual(work)
    expect(useResumeEditorStore.getState().isDirty).toBe(true)
  })

  it('preserves other sections when updating one', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', { basics: { name: 'Jane' } }, defaultMeta)
    useResumeEditorStore.getState().setSectionData('work', [{ name: 'Acme' }])
    expect(useResumeEditorStore.getState().data.basics?.name).toBe('Jane')
  })
})

describe('setMeta', () => {
  it('merges patch without overwriting other fields', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setMeta({ fontFamily: 'Arial' })
    expect(useResumeEditorStore.getState().meta.fontFamily).toBe('Arial')
    expect(useResumeEditorStore.getState().meta.headerFontFamily).toBe('Calibri')
    expect(useResumeEditorStore.getState().isDirty).toBe(true)
  })

  it('clamps pageMargins to minimum 0.5', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setMeta({ pageMargins: 0.2 })
    expect(useResumeEditorStore.getState().meta.pageMargins).toBe(0.5)
  })

  it('clamps pageMargins to maximum 1.5', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setMeta({ pageMargins: 2.0 })
    expect(useResumeEditorStore.getState().meta.pageMargins).toBe(1.5)
  })

  it('clamps lineSpacing to minimum 1.0', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setMeta({ lineSpacing: 0.5 })
    expect(useResumeEditorStore.getState().meta.lineSpacing).toBe(1.0)
  })

  it('clamps lineSpacing to maximum 1.15', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    useResumeEditorStore.getState().setMeta({ lineSpacing: 2.0 })
    expect(useResumeEditorStore.getState().meta.lineSpacing).toBe(1.15)
  })
})

describe('initAutoSave', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('calls PATCH after 1000 ms when isDirty becomes true', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 })
    )
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    const unsub = initAutoSave()
    useResumeEditorStore.getState().setTitle('New Title')
    await vi.runAllTimersAsync()
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/resumes/r1',
      expect.objectContaining({ method: 'PATCH' })
    )
    expect(useResumeEditorStore.getState().isDirty).toBe(false)
    unsub()
    fetchSpy.mockRestore()
  })

  it('sets saveError and retries once on fetch failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
    useResumeEditorStore.getState().hydrate('r1', 'CV', emptyData, defaultMeta)
    const unsub = initAutoSave()
    useResumeEditorStore.getState().setTitle('New Title')
    await vi.runAllTimersAsync()
    expect(useResumeEditorStore.getState().saveError).toContain('retrying')
    unsub()
    fetchSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run lib/stores/__tests__/resume-editor.store.test.ts
```

Expected: FAIL — `Cannot find module '../resume-editor.store'`

- [ ] **Step 3: Create the store**

```typescript
// lib/stores/resume-editor.store.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export interface ResumeEditorStore {
  resumeId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  setTitle: (title: string) => void
  setData: (patch: Partial<ResumeData>) => void
  setMeta: (patch: Partial<ResumeMeta>) => void
  setSectionData: <K extends keyof ResumeData>(section: K, value: ResumeData[K]) => void
  hydrate: (resumeId: string, title: string, data: ResumeData, meta: ResumeMeta) => void
  _setIsSaving: (v: boolean) => void
  _setIsDirty: (v: boolean) => void
  _setSaveError: (v: string | null) => void
}

export const useResumeEditorStore = create<ResumeEditorStore>()(
  subscribeWithSelector((set) => ({
    resumeId: '',
    title: '',
    data: {},
    meta: {
      templateId: 'classic',
      fontFamily: 'Calibri',
      headerFontFamily: 'Calibri',
      primaryColor: '#000000',
      accentColor: '#0066cc',
      pageMargins: 1.0,
      lineSpacing: 1.15,
      sectionOrder: ['work', 'education', 'skills', 'certificates', 'awards',
        'publications', 'volunteer', 'languages', 'interests', 'projects'],
      layout: 'single-column',
    },
    isDirty: false,
    isSaving: false,
    saveError: null,
    setTitle: (title) => set({ title, isDirty: true }),
    setData: (patch) => set((s) => ({ data: { ...s.data, ...patch }, isDirty: true })),
    setMeta: (patch) =>
      set((s) => {
        const merged: ResumeMeta = { ...s.meta, ...patch }
        if (patch.pageMargins !== undefined)
          merged.pageMargins = Math.max(0.5, Math.min(1.5, patch.pageMargins))
        if (patch.lineSpacing !== undefined)
          merged.lineSpacing = Math.max(1.0, Math.min(1.15, patch.lineSpacing))
        return { meta: merged, isDirty: true }
      }),
    setSectionData: (section, value) =>
      set((s) => ({ data: { ...s.data, [section]: value }, isDirty: true })),
    hydrate: (resumeId, title, data, meta) =>
      set({ resumeId, title, data, meta, isDirty: false, saveError: null }),
    _setIsSaving: (isSaving) => set({ isSaving }),
    _setIsDirty: (isDirty) => set({ isDirty }),
    _setSaveError: (saveError) => set({ saveError }),
  }))
)

let _saveTimer: ReturnType<typeof setTimeout> | null = null
let _retryCount = 0

export function initAutoSave(): () => void {
  return useResumeEditorStore.subscribe(
    (s) => s.isDirty,
    (isDirty) => {
      if (!isDirty) return
      if (_saveTimer) clearTimeout(_saveTimer)
      _saveTimer = setTimeout(performSave, 1000)
    }
  )
}

async function performSave(): Promise<void> {
  const { resumeId, title, data, meta, _setIsSaving, _setIsDirty, _setSaveError } =
    useResumeEditorStore.getState()
  if (!resumeId) return
  _setIsSaving(true)
  try {
    const res = await fetch(`/api/resumes/${resumeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, data, meta }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    _setIsDirty(false)
    _setSaveError(null)
    _retryCount = 0
  } catch {
    if (_retryCount < 1) {
      _retryCount++
      _setSaveError("Changes couldn't be saved — retrying…")
      setTimeout(performSave, 3000)
    } else {
      _retryCount = 0
      _setSaveError("Changes couldn't be saved. Please check your connection.")
    }
  } finally {
    _setIsSaving(false)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run lib/stores/__tests__/resume-editor.store.test.ts
```

Expected: 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/stores/resume-editor.store.ts lib/stores/__tests__/resume-editor.store.test.ts
git commit -m "feat: add Zustand resume editor store with debounced auto-save"
```

---

### Task 4: AccordionSection component

**Files:**
- Create: `components/editor/AccordionSection.tsx`
- Create: `components/editor/AccordionSection.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// components/editor/AccordionSection.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccordionSection } from './AccordionSection'

describe('AccordionSection', () => {
  it('renders title and calls onToggle on click', () => {
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={onToggle}>
        {null}
      </AccordionSection>
    )
    expect(screen.getByText('Work Experience')).toBeTruthy()
    fireEvent.click(screen.getByRole('button'))
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
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run components/editor/AccordionSection.test.tsx
```

Expected: FAIL — `Cannot find module './AccordionSection'`

- [ ] **Step 3: Create the component**

```tsx
// components/editor/AccordionSection.tsx
'use client'

interface AccordionSectionProps {
  title: string
  badge?: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function AccordionSection({
  title,
  badge,
  isOpen,
  onToggle,
  children,
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
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {badge}
            </span>
          )}
          <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">{children}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run components/editor/AccordionSection.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/editor/AccordionSection.tsx components/editor/AccordionSection.test.tsx
git commit -m "feat: add AccordionSection component"
```

---

### Task 5: BasicsForm

**Files:**
- Create: `components/editor/forms/BasicsForm.tsx`
- Create: `components/editor/forms/BasicsForm.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// components/editor/forms/BasicsForm.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { BasicsForm } from './BasicsForm'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column',
}

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1', title: 'CV', data: {}, meta: defaultMeta,
    isDirty: false, isSaving: false, saveError: null,
  })
})

it('updates basics.name in store when name input changes', () => {
  render(<BasicsForm />)
  fireEvent.change(screen.getByPlaceholderText('Jane Smith'), { target: { value: 'John Doe' } })
  expect(useResumeEditorStore.getState().data.basics?.name).toBe('John Doe')
  expect(useResumeEditorStore.getState().isDirty).toBe(true)
})

it('updates basics.location.city in store', () => {
  render(<BasicsForm />)
  fireEvent.change(screen.getByPlaceholderText('San Francisco'), { target: { value: 'New York' } })
  expect(useResumeEditorStore.getState().data.basics?.location?.city).toBe('New York')
})

it('preserves existing fields when updating one', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { basics: { name: 'Jane', email: 'jane@test.com' } },
  })
  render(<BasicsForm />)
  fireEvent.change(screen.getByPlaceholderText('+1 555 123 4567'), { target: { value: '555-0000' } })
  const b = useResumeEditorStore.getState().data.basics
  expect(b?.name).toBe('Jane')
  expect(b?.email).toBe('jane@test.com')
  expect(b?.phone).toBe('555-0000')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run components/editor/forms/BasicsForm.test.tsx
```

Expected: FAIL — `Cannot find module './BasicsForm'`

- [ ] **Step 3: Create the component**

```tsx
// components/editor/forms/BasicsForm.tsx
'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'

export function BasicsForm() {
  const basics = useResumeEditorStore((s) => s.data.basics ?? {})
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)

  const set = (field: string, value: string) =>
    setSectionData('basics', { ...basics, [field]: value })

  const setLocation = (field: string, value: string) =>
    setSectionData('basics', { ...basics, location: { ...basics.location, [field]: value } })

  const inputClass =
    'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
          <input type="text" value={basics.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Jane Smith" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Job Title</label>
          <input type="text" value={basics.label ?? ''} onChange={(e) => set('label', e.target.value)}
            placeholder="Software Engineer" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input type="email" value={basics.email ?? ''} onChange={(e) => set('email', e.target.value)}
            placeholder="jane@example.com" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
          <input type="tel" value={basics.phone ?? ''} onChange={(e) => set('phone', e.target.value)}
            placeholder="+1 555 123 4567" className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Website URL</label>
        <input type="url" value={basics.url ?? ''} onChange={(e) => set('url', e.target.value)}
          placeholder="https://janesmith.dev" className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
          <input type="text" value={basics.location?.city ?? ''}
            onChange={(e) => setLocation('city', e.target.value)}
            placeholder="San Francisco" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
          <input type="text" value={basics.location?.region ?? ''}
            onChange={(e) => setLocation('region', e.target.value)}
            placeholder="CA" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
          <input type="text" value={basics.location?.countryCode ?? ''}
            onChange={(e) => setLocation('countryCode', e.target.value)}
            placeholder="US" className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Professional Summary</label>
        <textarea value={basics.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
          placeholder="Brief professional summary..." rows={4}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run components/editor/forms/BasicsForm.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/editor/forms/BasicsForm.tsx components/editor/forms/BasicsForm.test.tsx
git commit -m "feat: add BasicsForm editor component"
```

---

### Task 6: ListFieldManager and WorkForm

**Files:**
- Create: `components/editor/forms/ListFieldManager.tsx`
- Create: `components/editor/forms/WorkForm.tsx`
- Create: `components/editor/forms/WorkForm.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// components/editor/forms/WorkForm.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { WorkForm } from './WorkForm'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column',
}

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1', title: 'CV', data: {}, meta: defaultMeta,
    isDirty: false, isSaving: false, saveError: null,
  })
})

it('adds a work entry when Add button clicked', () => {
  render(<WorkForm />)
  fireEvent.click(screen.getByText('+ Add work experience'))
  expect(useResumeEditorStore.getState().data.work).toHaveLength(1)
  expect(useResumeEditorStore.getState().isDirty).toBe(true)
})

it('removes a work entry when Remove clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: 'Acme', position: 'Dev', startDate: '' }] },
  })
  render(<WorkForm />)
  fireEvent.click(screen.getByLabelText('Remove work entry'))
  expect(useResumeEditorStore.getState().data.work).toHaveLength(0)
})

it('updates company name in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: '', position: '', startDate: '' }] },
  })
  render(<WorkForm />)
  fireEvent.change(screen.getByPlaceholderText('Company name'), { target: { value: 'Acme' } })
  expect(useResumeEditorStore.getState().data.work?.[0].name).toBe('Acme')
})

it('adds a highlight bullet', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: 'Acme', position: 'Dev', startDate: '', highlights: [] }] },
  })
  render(<WorkForm />)
  fireEvent.click(screen.getByText('+ Add bullet'))
  expect(useResumeEditorStore.getState().data.work?.[0].highlights).toHaveLength(1)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run components/editor/forms/WorkForm.test.tsx
```

Expected: FAIL — `Cannot find module './WorkForm'`

- [ ] **Step 3: Create ListFieldManager**

```tsx
// components/editor/forms/ListFieldManager.tsx
'use client'

interface ListFieldManagerProps<T> {
  items: T[]
  onChange: (items: T[]) => void
  createEmpty: () => T
  renderItem: (item: T, index: number, onUpdate: (v: T) => void, onRemove: () => void) => React.ReactNode
  addLabel?: string
}

export function ListFieldManager<T>({
  items, onChange, createEmpty, renderItem, addLabel = 'Add entry',
}: ListFieldManagerProps<T>) {
  const add = () => onChange([...items, createEmpty()])
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i: number, v: T) => onChange(items.map((item, idx) => (idx === i ? v : item)))

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
          {renderItem(item, i, (v) => update(i, v), () => remove(i))}
        </div>
      ))}
      <button type="button" onClick={add}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium">
        + {addLabel}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create WorkForm**

```tsx
// components/editor/forms/WorkForm.tsx
'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type WorkItem = NonNullable<ResumeData['work']>[number]

const createEmpty = (): WorkItem => ({
  name: '', position: '', url: '', startDate: '', endDate: '', summary: '', highlights: [],
})

const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

function WorkItemForm({ item, onUpdate, onRemove }: { item: WorkItem; onUpdate: (v: WorkItem) => void; onRemove: () => void }) {
  const set = (field: keyof WorkItem, value: string) => onUpdate({ ...item, [field]: value })

  const setHighlights = (highlights: string[]) => onUpdate({ ...item, highlights })
  const addHighlight = () => setHighlights([...(item.highlights ?? []), ''])
  const updateHighlight = (i: number, v: string) =>
    setHighlights((item.highlights ?? []).map((h, idx) => (idx === i ? v : h)))
  const removeHighlight = (i: number) =>
    setHighlights((item.highlights ?? []).filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <input type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Company name" className={inputClass} />
          <input type="text" value={item.position ?? ''} onChange={(e) => set('position', e.target.value)}
            placeholder="Job title" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove work entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)}
          placeholder="Start date (2020-01)" className={inputClass} />
        <input type="text" value={item.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)}
          placeholder="End date or Present" className={inputClass} />
      </div>
      <textarea value={item.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
        placeholder="Role summary..." rows={2}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-600">Bullet points</label>
        {(item.highlights ?? []).map((h, i) => (
          <div key={i} className="flex gap-1">
            <input type="text" value={h} onChange={(e) => updateHighlight(i, e.target.value)}
              placeholder="Achieved X by doing Y, resulting in Z" className={`${inputClass} flex-1`} />
            <button type="button" onClick={() => removeHighlight(i)} aria-label="Remove highlight"
              className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
          </div>
        ))}
        <button type="button" onClick={addHighlight}
          className="text-xs text-blue-600 hover:text-blue-800">+ Add bullet</button>
      </div>
    </div>
  )
}

export function WorkForm() {
  const work = useResumeEditorStore((s) => s.data.work ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<WorkItem>
      items={work}
      onChange={(items) => setSectionData('work', items)}
      createEmpty={createEmpty}
      addLabel="Add work experience"
      renderItem={(item, _, onUpdate, onRemove) => (
        <WorkItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />
      )}
    />
  )
}
```

- [ ] **Step 5: Run tests**

```bash
npm run test:run components/editor/forms/WorkForm.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add components/editor/forms/ListFieldManager.tsx components/editor/forms/WorkForm.tsx components/editor/forms/WorkForm.test.tsx
git commit -m "feat: add ListFieldManager and WorkForm components"
```

---

### Task 7: EducationForm and SkillsForm

**Files:**
- Create: `components/editor/forms/EducationForm.tsx`
- Create: `components/editor/forms/SkillsForm.tsx`

No separate test files — both follow the pattern proven in WorkForm. Verify by smoke-testing in the editor (Task 12).

- [ ] **Step 1: Create EducationForm**

```tsx
// components/editor/forms/EducationForm.tsx
'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type EduItem = NonNullable<ResumeData['education']>[number]

const createEmpty = (): EduItem => ({
  institution: '', url: '', area: '', studyType: '', startDate: '', endDate: '', score: '', courses: [],
})

const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

function EduItemForm({ item, onUpdate, onRemove }: { item: EduItem; onUpdate: (v: EduItem) => void; onRemove: () => void }) {
  const set = (field: keyof EduItem, value: string) => onUpdate({ ...item, [field]: value })
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <input type="text" value={item.institution ?? ''} onChange={(e) => set('institution', e.target.value)}
          placeholder="University / School" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove education entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.studyType ?? ''} onChange={(e) => set('studyType', e.target.value)}
          placeholder="Degree (B.Sc.)" className={inputClass} />
        <input type="text" value={item.area ?? ''} onChange={(e) => set('area', e.target.value)}
          placeholder="Field of study" className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input type="text" value={item.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)}
          placeholder="Start (2018-09)" className={inputClass} />
        <input type="text" value={item.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)}
          placeholder="End (2022-06)" className={inputClass} />
        <input type="text" value={item.score ?? ''} onChange={(e) => set('score', e.target.value)}
          placeholder="GPA / Score" className={inputClass} />
      </div>
    </div>
  )
}

export function EducationForm() {
  const education = useResumeEditorStore((s) => s.data.education ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<EduItem>
      items={education}
      onChange={(items) => setSectionData('education', items)}
      createEmpty={createEmpty}
      addLabel="Add education"
      renderItem={(item, _, onUpdate, onRemove) => (
        <EduItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />
      )}
    />
  )
}
```

- [ ] **Step 2: Create SkillsForm**

```tsx
// components/editor/forms/SkillsForm.tsx
'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type SkillItem = NonNullable<ResumeData['skills']>[number]

const createEmpty = (): SkillItem => ({ name: '', level: '', keywords: [] })

const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

function SkillItemForm({ item, onUpdate, onRemove }: { item: SkillItem; onUpdate: (v: SkillItem) => void; onRemove: () => void }) {
  const set = (field: keyof SkillItem, value: string) => onUpdate({ ...item, [field]: value })
  const setKeywords = (keywords: string[]) => onUpdate({ ...item, keywords })
  const addKeyword = () => setKeywords([...(item.keywords ?? []), ''])
  const updateKeyword = (i: number, v: string) =>
    setKeywords((item.keywords ?? []).map((k, idx) => (idx === i ? v : k)))
  const removeKeyword = (i: number) =>
    setKeywords((item.keywords ?? []).filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <input type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Skill name" className={inputClass} />
          <input type="text" value={item.level ?? ''} onChange={(e) => set('level', e.target.value)}
            placeholder="Level (Expert)" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove skill"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-600">Keywords</label>
        {(item.keywords ?? []).map((k, i) => (
          <div key={i} className="flex gap-1">
            <input type="text" value={k} onChange={(e) => updateKeyword(i, e.target.value)}
              placeholder="e.g. React" className={`${inputClass} flex-1`} />
            <button type="button" onClick={() => removeKeyword(i)} aria-label="Remove keyword"
              className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
          </div>
        ))}
        <button type="button" onClick={addKeyword}
          className="text-xs text-blue-600 hover:text-blue-800">+ Add keyword</button>
      </div>
    </div>
  )
}

export function SkillsForm() {
  const skills = useResumeEditorStore((s) => s.data.skills ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<SkillItem>
      items={skills}
      onChange={(items) => setSectionData('skills', items)}
      createEmpty={createEmpty}
      addLabel="Add skill"
      renderItem={(item, _, onUpdate, onRemove) => (
        <SkillItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />
      )}
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/editor/forms/EducationForm.tsx components/editor/forms/SkillsForm.tsx
git commit -m "feat: add EducationForm and SkillsForm components"
```

---

### Task 8: Remaining section forms (Certificates, Languages, Awards, Publications, Interests, Volunteer, Projects)

**Files:**
- Create: `components/editor/forms/CertificatesForm.tsx`
- Create: `components/editor/forms/LanguagesForm.tsx`
- Create: `components/editor/forms/AwardsForm.tsx`
- Create: `components/editor/forms/PublicationsForm.tsx`
- Create: `components/editor/forms/InterestsForm.tsx`
- Create: `components/editor/forms/VolunteerForm.tsx`
- Create: `components/editor/forms/ProjectsForm.tsx`

- [ ] **Step 1: Create CertificatesForm**

```tsx
// components/editor/forms/CertificatesForm.tsx
'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['certificates']>[number]
const createEmpty = (): Item => ({ name: '', date: '', issuer: '', url: '' })
const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <input type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
          placeholder="Certificate name" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove certificate"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.issuer ?? ''} onChange={(e) => set('issuer', e.target.value)}
          placeholder="Issuing organization" className={inputClass} />
        <input type="text" value={item.date ?? ''} onChange={(e) => set('date', e.target.value)}
          placeholder="Date (2023-05)" className={inputClass} />
      </div>
      <input type="url" value={item.url ?? ''} onChange={(e) => set('url', e.target.value)}
        placeholder="Certificate URL" className={inputClass} />
    </div>
  )
}

export function CertificatesForm() {
  const items = useResumeEditorStore((s) => s.data.certificates ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('certificates', v)}
      createEmpty={createEmpty} addLabel="Add certificate"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
```

- [ ] **Step 2: Create LanguagesForm**

```tsx
// components/editor/forms/LanguagesForm.tsx
'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['languages']>[number]
const createEmpty = (): Item => ({ language: '', fluency: '' })
const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  return (
    <div className="flex gap-2 items-center">
      <input type="text" value={item.language ?? ''} onChange={(e) => set('language', e.target.value)}
        placeholder="Language" className={`${inputClass} flex-1`} />
      <input type="text" value={item.fluency ?? ''} onChange={(e) => set('fluency', e.target.value)}
        placeholder="Fluency (Native)" className={`${inputClass} flex-1`} />
      <button type="button" onClick={onRemove} aria-label="Remove language"
        className="text-gray-400 hover:text-red-500 text-sm">✕</button>
    </div>
  )
}

export function LanguagesForm() {
  const items = useResumeEditorStore((s) => s.data.languages ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('languages', v)}
      createEmpty={createEmpty} addLabel="Add language"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
```

- [ ] **Step 3: Create AwardsForm**

```tsx
// components/editor/forms/AwardsForm.tsx
'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['awards']>[number]
const createEmpty = (): Item => ({ title: '', date: '', awarder: '', summary: '' })
const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <input type="text" value={item.title ?? ''} onChange={(e) => set('title', e.target.value)}
          placeholder="Award title" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove award"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.awarder ?? ''} onChange={(e) => set('awarder', e.target.value)}
          placeholder="Awarded by" className={inputClass} />
        <input type="text" value={item.date ?? ''} onChange={(e) => set('date', e.target.value)}
          placeholder="Date (2023-06)" className={inputClass} />
      </div>
      <textarea value={item.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
        placeholder="Description..." rows={2}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
    </div>
  )
}

export function AwardsForm() {
  const items = useResumeEditorStore((s) => s.data.awards ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('awards', v)}
      createEmpty={createEmpty} addLabel="Add award"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
```

- [ ] **Step 4: Create PublicationsForm**

```tsx
// components/editor/forms/PublicationsForm.tsx
'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['publications']>[number]
const createEmpty = (): Item => ({ name: '', publisher: '', releaseDate: '', url: '', summary: '' })
const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <input type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
          placeholder="Publication title" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove publication"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.publisher ?? ''} onChange={(e) => set('publisher', e.target.value)}
          placeholder="Publisher" className={inputClass} />
        <input type="text" value={item.releaseDate ?? ''} onChange={(e) => set('releaseDate', e.target.value)}
          placeholder="Release date (2023-01)" className={inputClass} />
      </div>
      <input type="url" value={item.url ?? ''} onChange={(e) => set('url', e.target.value)}
        placeholder="URL" className={inputClass} />
      <textarea value={item.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
        placeholder="Abstract / Summary..." rows={2}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
    </div>
  )
}

export function PublicationsForm() {
  const items = useResumeEditorStore((s) => s.data.publications ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('publications', v)}
      createEmpty={createEmpty} addLabel="Add publication"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
```

- [ ] **Step 5: Create InterestsForm**

```tsx
// components/editor/forms/InterestsForm.tsx
'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['interests']>[number]
const createEmpty = (): Item => ({ name: '', keywords: [] })
const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const setKeywords = (keywords: string[]) => onUpdate({ ...item, keywords })
  const addKw = () => setKeywords([...(item.keywords ?? []), ''])
  const updateKw = (i: number, v: string) =>
    setKeywords((item.keywords ?? []).map((k, idx) => (idx === i ? v : k)))
  const removeKw = (i: number) =>
    setKeywords((item.keywords ?? []).filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <input type="text" value={item.name ?? ''} onChange={(e) => onUpdate({ ...item, name: e.target.value })}
          placeholder="Interest (e.g. Open Source)" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove interest"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      {(item.keywords ?? []).map((k, i) => (
        <div key={i} className="flex gap-1">
          <input type="text" value={k} onChange={(e) => updateKw(i, e.target.value)}
            placeholder="keyword" className={`${inputClass} flex-1`} />
          <button type="button" onClick={() => removeKw(i)} aria-label="Remove keyword"
            className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
        </div>
      ))}
      <button type="button" onClick={addKw} className="text-xs text-blue-600 hover:text-blue-800">
        + Add keyword
      </button>
    </div>
  )
}

export function InterestsForm() {
  const items = useResumeEditorStore((s) => s.data.interests ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('interests', v)}
      createEmpty={createEmpty} addLabel="Add interest"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
```

- [ ] **Step 6: Create VolunteerForm**

```tsx
// components/editor/forms/VolunteerForm.tsx
'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['volunteer']>[number]
const createEmpty = (): Item => ({
  organization: '', position: '', url: '', startDate: '', endDate: '', summary: '', highlights: [],
})
const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  const setHighlights = (highlights: string[]) => onUpdate({ ...item, highlights })
  const addH = () => setHighlights([...(item.highlights ?? []), ''])
  const updateH = (i: number, v: string) =>
    setHighlights((item.highlights ?? []).map((h, idx) => (idx === i ? v : h)))
  const removeH = (i: number) =>
    setHighlights((item.highlights ?? []).filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <input type="text" value={item.organization ?? ''} onChange={(e) => set('organization', e.target.value)}
            placeholder="Organization" className={inputClass} />
          <input type="text" value={item.position ?? ''} onChange={(e) => set('position', e.target.value)}
            placeholder="Role" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove volunteer entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)}
          placeholder="Start date" className={inputClass} />
        <input type="text" value={item.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)}
          placeholder="End date" className={inputClass} />
      </div>
      <textarea value={item.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
        placeholder="Summary..." rows={2}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-600">Highlights</label>
        {(item.highlights ?? []).map((h, i) => (
          <div key={i} className="flex gap-1">
            <input type="text" value={h} onChange={(e) => updateH(i, e.target.value)}
              placeholder="Achievement..." className={`${inputClass} flex-1`} />
            <button type="button" onClick={() => removeH(i)} aria-label="Remove highlight"
              className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
          </div>
        ))}
        <button type="button" onClick={addH} className="text-xs text-blue-600 hover:text-blue-800">
          + Add highlight
        </button>
      </div>
    </div>
  )
}

export function VolunteerForm() {
  const items = useResumeEditorStore((s) => s.data.volunteer ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('volunteer', v)}
      createEmpty={createEmpty} addLabel="Add volunteer experience"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
```

- [ ] **Step 7: Create ProjectsForm**

```tsx
// components/editor/forms/ProjectsForm.tsx
'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['projects']>[number]
const createEmpty = (): Item => ({
  name: '', description: '', highlights: [], keywords: [],
  startDate: '', endDate: '', url: '', roles: [], entity: '', type: '',
})
const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

function StringListEditor({ label, items, onChange, addLabel, placeholder }: {
  label: string; items: string[]; onChange: (v: string[]) => void; addLabel: string; placeholder: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      {items.map((v, i) => (
        <div key={i} className="flex gap-1">
          <input type="text" value={v}
            onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))}
            placeholder={placeholder} className={`${inputClass} flex-1`} />
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            aria-label={`Remove ${label.toLowerCase()} item`}
            className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])}
        className="text-xs text-blue-600 hover:text-blue-800">+ {addLabel}</button>
    </div>
  )
}

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <input type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
          placeholder="Project name" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove project"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <textarea value={item.description ?? ''} onChange={(e) => set('description', e.target.value)}
        placeholder="Project description..." rows={2}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)}
          placeholder="Start date" className={inputClass} />
        <input type="text" value={item.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)}
          placeholder="End date" className={inputClass} />
      </div>
      <input type="url" value={item.url ?? ''} onChange={(e) => set('url', e.target.value)}
        placeholder="Project URL" className={inputClass} />
      <StringListEditor label="Highlights" items={item.highlights ?? []}
        onChange={(v) => onUpdate({ ...item, highlights: v })}
        addLabel="Add highlight" placeholder="Key achievement..." />
      <StringListEditor label="Keywords" items={item.keywords ?? []}
        onChange={(v) => onUpdate({ ...item, keywords: v })}
        addLabel="Add keyword" placeholder="Technology / skill..." />
    </div>
  )
}

export function ProjectsForm() {
  const items = useResumeEditorStore((s) => s.data.projects ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('projects', v)}
      createEmpty={createEmpty} addLabel="Add project"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
```

- [ ] **Step 8: Commit all forms**

```bash
git add components/editor/forms/CertificatesForm.tsx components/editor/forms/LanguagesForm.tsx components/editor/forms/AwardsForm.tsx components/editor/forms/PublicationsForm.tsx components/editor/forms/InterestsForm.tsx components/editor/forms/VolunteerForm.tsx components/editor/forms/ProjectsForm.tsx
git commit -m "feat: add remaining section form components"
```

---

### Task 9: ClassicTemplate HTML/CSS

**Files:**
- Create: `components/templates/ClassicTemplate.tsx`

- [ ] **Step 1: Create the template**

```tsx
// components/templates/ClassicTemplate.tsx
'use client'

import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export interface TemplateProps {
  data: ResumeData
  meta: ResumeMeta
}

const ALL_SECTIONS = ['work', 'education', 'skills', 'certificates', 'awards',
  'publications', 'volunteer', 'languages', 'interests', 'projects']

export function ClassicTemplate({ data, meta }: TemplateProps) {
  const { basics = {} } = data
  const pad = meta.pageMargins * 96
  const sectionOrder = meta.sectionOrder?.length > 0 ? meta.sectionOrder : ALL_SECTIONS

  const page: React.CSSProperties = {
    fontFamily: `${meta.fontFamily}, Arial, sans-serif`,
    fontSize: '11pt',
    lineHeight: meta.lineSpacing,
    background: '#fff',
    color: '#000',
    width: '794px',
    minHeight: '1123px',
    padding: `${pad}px`,
    boxSizing: 'border-box',
  }

  const sectionTitle: React.CSSProperties = {
    fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`,
    fontSize: '13pt',
    fontWeight: 700,
    color: meta.primaryColor,
    borderBottom: `1.5px solid ${meta.primaryColor}`,
    paddingBottom: '2px',
    marginTop: '18px',
    marginBottom: '8px',
  }

  function renderSection(section: string) {
    switch (section) {
      case 'work': {
        const work = data.work ?? []
        if (!work.length) return null
        return (
          <div key="work">
            <div style={sectionTitle}>Work Experience</div>
            {work.map((job, i) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: '11pt' }}>{job.name}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {[job.startDate, job.endDate || 'Present'].filter(Boolean).join(' – ')}
                  </span>
                </div>
                <div style={{ color: meta.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>{job.position}</div>
                {job.summary && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{job.summary}</div>}
                {(job.highlights ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
                    {(job.highlights ?? []).map((h, hi) => <li key={hi}>{h}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )
      }
      case 'education': {
        const education = data.education ?? []
        if (!education.length) return null
        return (
          <div key="education">
            <div style={sectionTitle}>Education</div>
            {education.map((edu, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{edu.institution}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}
                  </span>
                </div>
                <div style={{ fontSize: '10.5pt' }}>{[edu.studyType, edu.area].filter(Boolean).join(' in ')}</div>
                {edu.score && <div style={{ fontSize: '10pt', color: '#666' }}>Score: {edu.score}</div>}
              </div>
            ))}
          </div>
        )
      }
      case 'skills': {
        const skills = data.skills ?? []
        if (!skills.length) return null
        return (
          <div key="skills">
            <div style={sectionTitle}>Skills</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {skills.map((s, i) => (
                <span key={i}>
                  <strong>{s.name}</strong>
                  {s.level && <span style={{ color: '#666' }}> ({s.level})</span>}
                  {(s.keywords ?? []).length > 0 && <span style={{ color: '#555' }}>: {(s.keywords ?? []).join(', ')}</span>}
                  {i < skills.length - 1 && <span style={{ margin: '0 8px', color: '#ccc' }}>|</span>}
                </span>
              ))}
            </div>
          </div>
        )
      }
      case 'certificates': {
        const certs = data.certificates ?? []
        if (!certs.length) return null
        return (
          <div key="certificates">
            <div style={sectionTitle}>Certifications</div>
            {certs.map((c, i) => (
              <div key={i} style={{ marginBottom: '6px', fontSize: '10pt' }}>
                <strong>{c.name}</strong>
                {c.issuer && <span style={{ color: '#666' }}> — {c.issuer}</span>}
                {c.date && <span style={{ color: '#666', float: 'right' }}>{c.date}</span>}
              </div>
            ))}
          </div>
        )
      }
      case 'languages': {
        const langs = data.languages ?? []
        if (!langs.length) return null
        return (
          <div key="languages">
            <div style={sectionTitle}>Languages</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.8 }}>
              {langs.map((l, i) => (
                <span key={i}>
                  <strong>{l.language}</strong>
                  {l.fluency && <span style={{ color: '#666' }}> ({l.fluency})</span>}
                  {i < langs.length - 1 && <span style={{ margin: '0 8px' }}>·</span>}
                </span>
              ))}
            </div>
          </div>
        )
      }
      case 'awards': {
        const awards = data.awards ?? []
        if (!awards.length) return null
        return (
          <div key="awards">
            <div style={sectionTitle}>Awards</div>
            {awards.map((a, i) => (
              <div key={i} style={{ marginBottom: '6px', fontSize: '10pt' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{a.title}</strong>
                  <span style={{ color: '#666' }}>{a.date}</span>
                </div>
                {a.awarder && <div style={{ color: '#555' }}>{a.awarder}</div>}
                {a.summary && <div>{a.summary}</div>}
              </div>
            ))}
          </div>
        )
      }
      case 'publications': {
        const pubs = data.publications ?? []
        if (!pubs.length) return null
        return (
          <div key="publications">
            <div style={sectionTitle}>Publications</div>
            {pubs.map((p, i) => (
              <div key={i} style={{ marginBottom: '6px', fontSize: '10pt' }}>
                <strong>{p.name}</strong>
                {p.publisher && <span style={{ color: '#666' }}> — {p.publisher}</span>}
                {p.releaseDate && <span style={{ color: '#666', float: 'right' }}>{p.releaseDate}</span>}
                {p.summary && <div style={{ marginTop: '2px' }}>{p.summary}</div>}
              </div>
            ))}
          </div>
        )
      }
      case 'volunteer': {
        const vol = data.volunteer ?? []
        if (!vol.length) return null
        return (
          <div key="volunteer">
            <div style={sectionTitle}>Volunteer</div>
            {vol.map((v, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{v.organization}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {[v.startDate, v.endDate || 'Present'].filter(Boolean).join(' – ')}
                  </span>
                </div>
                <div style={{ color: meta.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>{v.position}</div>
                {v.summary && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{v.summary}</div>}
              </div>
            ))}
          </div>
        )
      }
      case 'interests': {
        const interests = data.interests ?? []
        if (!interests.length) return null
        return (
          <div key="interests">
            <div style={sectionTitle}>Interests</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {interests.map((int, i) => (
                <span key={i}>
                  <strong>{int.name}</strong>
                  {(int.keywords ?? []).length > 0 && <span style={{ color: '#555' }}>: {(int.keywords ?? []).join(', ')}</span>}
                  {i < interests.length - 1 && <span style={{ margin: '0 8px', color: '#ccc' }}>|</span>}
                </span>
              ))}
            </div>
          </div>
        )
      }
      case 'projects': {
        const projects = data.projects ?? []
        if (!projects.length) return null
        return (
          <div key="projects">
            <div style={sectionTitle}>Projects</div>
            {projects.map((p, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{p.name}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {[p.startDate, p.endDate].filter(Boolean).join(' – ')}
                  </span>
                </div>
                {p.description && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{p.description}</div>}
                {(p.highlights ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
                    {(p.highlights ?? []).map((h, hi) => <li key={hi}>{h}</li>)}
                  </ul>
                )}
                {(p.keywords ?? []).length > 0 && (
                  <div style={{ fontSize: '9pt', color: '#666', marginTop: '2px' }}>
                    {(p.keywords ?? []).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
      default:
        return null
    }
  }

  const header = (
    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
      <div style={{ fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`, fontSize: '20pt', fontWeight: 700 }}>
        {basics.name}
      </div>
      {basics.label && <div style={{ fontSize: '12pt', color: '#555', marginTop: '2px' }}>{basics.label}</div>}
      <div style={{ fontSize: '10pt', color: '#555', marginTop: '4px' }}>
        {[basics.email, basics.phone, basics.url, [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
      </div>
    </div>
  )

  if (meta.layout === 'two-column') {
    const leftSections = sectionOrder.filter((s) => ['work', 'education', 'volunteer', 'projects'].includes(s))
    const rightSections = sectionOrder.filter((s) => ['skills', 'certificates', 'languages', 'interests', 'awards', 'publications'].includes(s))
    return (
      <div style={page}>
        {header}
        {basics.summary && (
          <div style={{ fontSize: '10pt', fontStyle: 'italic', marginBottom: '12px' }}>{basics.summary}</div>
        )}
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ flex: '0 0 58%' }}>{leftSections.map(renderSection)}</div>
          <div style={{ flex: 1 }}>{rightSections.map(renderSection)}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      {header}
      {basics.summary && (
        <div>
          <div style={sectionTitle}>Summary</div>
          <div style={{ fontSize: '10pt' }}>{basics.summary}</div>
        </div>
      )}
      {sectionOrder.map(renderSection)}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/templates/ClassicTemplate.tsx
git commit -m "feat: add ClassicTemplate HTML/CSS preview component"
```

---

### Task 10: ModernTemplate and MinimalTemplate

**Files:**
- Create: `components/templates/ModernTemplate.tsx`
- Create: `components/templates/MinimalTemplate.tsx`

- [ ] **Step 1: Create ModernTemplate**

ModernTemplate renders a bold dark header block (full-width, white text on `primaryColor` background), then body content with accent-colored section titles and no border-bottom dividers. The section rendering logic (work, education, etc.) is identical to ClassicTemplate — copy `renderSection` and adjust only the style objects.

```tsx
// components/templates/ModernTemplate.tsx
'use client'
import type { TemplateProps } from './ClassicTemplate'

const ALL_SECTIONS = ['work', 'education', 'skills', 'certificates', 'awards',
  'publications', 'volunteer', 'languages', 'interests', 'projects']

export function ModernTemplate({ data, meta }: TemplateProps) {
  const { basics = {} } = data
  const pad = meta.pageMargins * 96
  const sectionOrder = meta.sectionOrder?.length > 0 ? meta.sectionOrder : ALL_SECTIONS

  const page: React.CSSProperties = {
    fontFamily: `${meta.fontFamily}, Arial, sans-serif`,
    fontSize: '11pt',
    lineHeight: meta.lineSpacing,
    background: '#fff',
    color: '#000',
    width: '794px',
    minHeight: '1123px',
    boxSizing: 'border-box',
  }

  const sectionTitle: React.CSSProperties = {
    fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`,
    fontSize: '12pt',
    fontWeight: 700,
    color: meta.accentColor,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginTop: '16px',
    marginBottom: '8px',
  }

  // renderSection is identical to ClassicTemplate but uses the local sectionTitle style
  // Copy the entire renderSection function from ClassicTemplate and replace sectionTitle references
  function renderSection(section: string): React.ReactNode {
    // (same implementation as ClassicTemplate.renderSection — use same code, different sectionTitle style above)
    // For brevity, the implementation is identical to ClassicTemplate's renderSection.
    // Implementer: copy renderSection from ClassicTemplate verbatim here.
    return null
  }

  const body = (
    <div style={{ padding: `${pad}px` }}>
      {basics.summary && (
        <div style={{ marginBottom: '12px', fontSize: '10pt', color: '#444' }}>{basics.summary}</div>
      )}
      {sectionOrder.map(renderSection)}
    </div>
  )

  if (meta.layout === 'two-column') {
    const leftSections = sectionOrder.filter((s) => ['work', 'education', 'volunteer', 'projects'].includes(s))
    const rightSections = sectionOrder.filter((s) => !leftSections.includes(s))
    return (
      <div style={page}>
        {/* Dark header block */}
        <div style={{ background: meta.primaryColor, color: '#fff', padding: `${pad}px ${pad}px ${pad * 0.75}px` }}>
          <div style={{ fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`, fontSize: '22pt', fontWeight: 700 }}>{basics.name}</div>
          {basics.label && <div style={{ fontSize: '12pt', opacity: 0.85, marginTop: '2px' }}>{basics.label}</div>}
          <div style={{ fontSize: '10pt', opacity: 0.75, marginTop: '4px' }}>
            {[basics.email, basics.phone, [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={{ padding: `${pad}px`, display: 'flex', gap: '24px' }}>
          <div style={{ flex: '0 0 58%' }}>{leftSections.map(renderSection)}</div>
          <div style={{ flex: 1 }}>{rightSections.map(renderSection)}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      <div style={{ background: meta.primaryColor, color: '#fff', padding: `${pad}px ${pad}px ${pad * 0.75}px` }}>
        <div style={{ fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`, fontSize: '22pt', fontWeight: 700 }}>{basics.name}</div>
        {basics.label && <div style={{ fontSize: '12pt', opacity: 0.85, marginTop: '2px' }}>{basics.label}</div>}
        <div style={{ fontSize: '10pt', opacity: 0.75, marginTop: '4px' }}>
          {[basics.email, basics.phone, [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
        </div>
      </div>
      {body}
    </div>
  )
}
```

**Important:** `ModernTemplate`'s `renderSection` must be a complete copy of `ClassicTemplate`'s `renderSection` — the only difference is the local `sectionTitle` style object (no `borderBottom`, uses `accentColor` instead of `primaryColor`, adds `textTransform: uppercase`). Replace the `return null` stub above with the full function body from Task 9.

- [ ] **Step 2: Create MinimalTemplate**

MinimalTemplate uses no lines, no background blocks, no decorative elements. All visual hierarchy comes from font size and weight only. Section titles are uppercase, slightly larger body text, generous spacing.

```tsx
// components/templates/MinimalTemplate.tsx
'use client'
import type { TemplateProps } from './ClassicTemplate'

const ALL_SECTIONS = ['work', 'education', 'skills', 'certificates', 'awards',
  'publications', 'volunteer', 'languages', 'interests', 'projects']

export function MinimalTemplate({ data, meta }: TemplateProps) {
  const { basics = {} } = data
  const pad = meta.pageMargins * 96
  const sectionOrder = meta.sectionOrder?.length > 0 ? meta.sectionOrder : ALL_SECTIONS

  const page: React.CSSProperties = {
    fontFamily: `${meta.fontFamily}, Arial, sans-serif`,
    fontSize: '11pt',
    lineHeight: meta.lineSpacing,
    background: '#fff',
    color: '#000',
    width: '794px',
    minHeight: '1123px',
    padding: `${pad}px`,
    boxSizing: 'border-box',
  }

  const sectionTitle: React.CSSProperties = {
    fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`,
    fontSize: '10pt',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#333',
    marginTop: '20px',
    marginBottom: '8px',
  }

  // Same renderSection logic as ClassicTemplate but with the local sectionTitle style.
  // Implementer: copy renderSection from ClassicTemplate verbatim here.
  function renderSection(section: string): React.ReactNode {
    return null // replace with full implementation from Task 9
  }

  return (
    <div style={page}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`, fontSize: '22pt', fontWeight: 700, letterSpacing: '-0.02em' }}>
          {basics.name}
        </div>
        {basics.label && <div style={{ fontSize: '11pt', color: '#555', marginTop: '3px' }}>{basics.label}</div>}
        <div style={{ fontSize: '10pt', color: '#777', marginTop: '4px' }}>
          {[basics.email, basics.phone, [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')].filter(Boolean).join('  ·  ')}
        </div>
      </div>
      {basics.summary && <div style={{ fontSize: '10pt', color: '#444', marginBottom: '16px' }}>{basics.summary}</div>}
      {sectionOrder.map(renderSection)}
    </div>
  )
}
```

**Important:** Replace `return null` in `renderSection` with the full function body from Task 9 (ClassicTemplate). Only the `sectionTitle` style object is different; all `switch` cases are identical.

- [ ] **Step 3: Commit**

```bash
git add components/templates/ModernTemplate.tsx components/templates/MinimalTemplate.tsx
git commit -m "feat: add ModernTemplate and MinimalTemplate preview components"
```

---

### Task 11: DesignPanel

**Files:**
- Create: `components/editor/DesignPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/editor/DesignPanel.tsx
'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'

const ATS_FONTS = [
  'Calibri', 'Arial', 'Helvetica', 'Garamond', 'Cambria', 'Georgia',
  'Lato', 'Roboto', 'IBM Plex Sans',
]

const TEMPLATES = [
  { id: 'classic', label: 'Classic', desc: 'Clean, professional, thin dividers' },
  { id: 'modern', label: 'Modern', desc: 'Bold header block, accent titles' },
  { id: 'minimal', label: 'Minimal', desc: 'Typography-only, maximum ATS compatibility' },
]

export function DesignPanel() {
  const meta = useResumeEditorStore((s) => s.meta)
  const setMeta = useResumeEditorStore((s) => s.setMeta)

  const selectClass = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1'

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
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm">{t.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
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
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {layout === 'single-column' ? 'Single column' : 'Two columns'}
            </button>
          ))}
        </div>
      </div>

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
              className="h-8 w-10 rounded border border-gray-300 cursor-pointer p-0.5" />
            <input type="text" value={meta.primaryColor}
              onChange={(e) => setMeta({ primaryColor: e.target.value })}
              placeholder="#000000" className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Accent color</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={meta.accentColor}
              onChange={(e) => setMeta({ accentColor: e.target.value })}
              className="h-8 w-10 rounded border border-gray-300 cursor-pointer p-0.5" />
            <input type="text" value={meta.accentColor}
              onChange={(e) => setMeta({ accentColor: e.target.value })}
              placeholder="#0066cc" className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Margins */}
      <div>
        <label className={labelClass}>
          Page margins — <span className="font-mono">{meta.pageMargins.toFixed(1)}"</span>
        </label>
        <input type="range" min={0.5} max={1.5} step={0.1}
          value={meta.pageMargins}
          onChange={(e) => setMeta({ pageMargins: parseFloat(e.target.value) })}
          className="w-full accent-blue-600" />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>0.5" (min)</span><span>1.5"</span>
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
          className="w-full accent-blue-600" />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>1.00</span><span>1.15</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/editor/DesignPanel.tsx
git commit -m "feat: add DesignPanel component"
```

---

### Task 12: EditTab, PreviewTab, EditorShell, and update page.tsx

**Files:**
- Create: `components/editor/EditTab.tsx`
- Create: `components/editor/PreviewTab.tsx`
- Create: `components/editor/EditorShell.tsx`
- Modify: `app/(dashboard)/dashboard/resumes/[id]/page.tsx`

- [ ] **Step 1: Create EditTab**

```tsx
// components/editor/EditTab.tsx
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

  const sectionOrder = ['basics', ...(meta.sectionOrder?.length > 0
    ? meta.sectionOrder
    : ['work', 'education', 'skills', 'certificates', 'awards', 'publications', 'volunteer', 'languages', 'interests', 'projects'])]

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-2">
      {sectionOrder.map((section) => {
        const FormComponent = SECTION_FORMS[section]
        if (!FormComponent) return null
        return (
          <AccordionSection
            key={section}
            title={SECTION_LABELS[section] ?? section}
            badge={getBadge(section, data)}
            isOpen={openSection === section}
            onToggle={() => setOpenSection((prev) => (prev === section ? null : section))}
          >
            <FormComponent />
          </AccordionSection>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create PreviewTab**

```tsx
// components/editor/PreviewTab.tsx
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

type Zoom = 75 | 100 | 'fit'

export function PreviewTab() {
  const data = useResumeEditorStore((s) => s.data)
  const meta = useResumeEditorStore((s) => s.meta)
  const debouncedData = useDebounce(data, 300)
  const debouncedMeta = useDebounce(meta, 300)
  const [zoom, setZoom] = useState<Zoom>('fit')
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

  const scale = zoom === 'fit' ? fitScale : zoom / 100
  const Template = TEMPLATES[debouncedMeta.templateId] ?? ClassicTemplate

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-4 py-2 border-b border-gray-200 bg-white">
        {([75, 100, 'fit'] as Zoom[]).map((z) => (
          <button key={String(z)} onClick={() => setZoom(z)}
            className={`text-xs px-3 py-1 rounded ${zoom === z ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {z === 'fit' ? 'Fit' : `${z}%`}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100 flex justify-center py-8">
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
          <Template data={debouncedData} meta={debouncedMeta} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create EditorShell**

```tsx
// components/editor/EditorShell.tsx
'use client'

import { useEffect, useState } from 'react'
import { useResumeEditorStore, initAutoSave } from '@/lib/stores/resume-editor.store'
import { EditTab } from './EditTab'
import { PreviewTab } from './PreviewTab'
import { DesignPanel } from './DesignPanel'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

type Tab = 'edit' | 'preview' | 'design'

export interface EditorShellProps {
  resumeId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
}

export function EditorShell({ resumeId, title, data, meta }: EditorShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('edit')
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
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-2 border-b border-gray-200 shrink-0">
        <input
          type="text"
          value={storeTitle}
          onChange={(e) => setTitle(e.target.value)}
          className="font-semibold text-base bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 min-w-0 flex-1 max-w-xs"
        />
        <span className={`text-xs shrink-0 ${saveError ? 'text-red-500' : 'text-gray-400'}`}>
          {saveError ?? saveStatus}
        </span>
        <div className="ml-auto flex gap-2 shrink-0">
          <button onClick={handleJsonExport}
            className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors">
            JSON
          </button>
          <button onClick={() => handleExport('pdf')}
            className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors">
            PDF
          </button>
          <button onClick={() => handleExport('docx')}
            className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors">
            DOCX
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-4 shrink-0">
        {(['edit', 'preview', 'design'] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <div className={`h-full ${activeTab === 'edit' ? 'overflow-auto' : 'hidden'}`}>
          <EditTab />
        </div>
        <div className={`h-full ${activeTab === 'preview' ? 'flex flex-col' : 'hidden'}`}>
          <PreviewTab />
        </div>
        <div className={`h-full ${activeTab === 'design' ? 'overflow-auto' : 'hidden'}`}>
          <DesignPanel />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update page.tsx**

Replace the entire file at `app/(dashboard)/dashboard/resumes/[id]/page.tsx`:

```tsx
// app/(dashboard)/dashboard/resumes/[id]/page.tsx
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { EditorShell } from '@/components/editor/EditorShell'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export default async function ResumePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) notFound()

  const { id } = await params
  const resume = await getResume(session.user.id, id)
  if (!resume) notFound()

  return (
    <EditorShell
      resumeId={String(resume._id)}
      title={resume.title}
      data={(resume.data ?? {}) as ResumeData}
      meta={resume.meta as ResumeMeta}
    />
  )
}
```

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```

Expected: all previously passing tests still pass. No new failures.

- [ ] **Step 6: Start dev server and verify the editor loads**

```bash
npm run dev
```

Navigate to `http://localhost:3000`. Sign in, create a resume, click Open. Verify:
- Editor loads with 3 tabs (Edit / Preview / Design)
- Edit tab shows accordion with "Personal Info" open by default
- Typing in the Name field updates the store (check browser DevTools Zustand extension or observe Preview tab)
- Switching to Preview shows the ClassicTemplate rendered
- Switching to Design shows font/color/margin controls
- Making a change shows "● Unsaved" in header, then "Saving…", then "Saved"

- [ ] **Step 7: Commit**

```bash
git add components/editor/EditTab.tsx components/editor/PreviewTab.tsx components/editor/EditorShell.tsx app/(dashboard)/dashboard/resumes/[id]/page.tsx
git commit -m "feat: wire up EditorShell with tabs, auto-save, and live preview"
```
