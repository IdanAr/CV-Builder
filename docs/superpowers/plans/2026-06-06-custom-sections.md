# Custom Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five broken fixed editor sections (certificates, awards, publications, interests, projects) with a flexible user-defined custom section system — users name sections, configure field types inline, and add multiple entries.

**Architecture:** `customSections: CustomSection[]` is added to `ResumeData`. Three new store actions (add/update/remove) keep `meta.sectionOrder` atomically in sync. The editor renders `custom:${id}` keys via a new `CustomSectionForm`; all three templates share a `renderCustomSection` function.

**Tech Stack:** Next.js 14, TypeScript, Zustand, Zod, Vitest + React Testing Library, Tailwind CSS

---

## File Map

| Action | Path |
|--------|------|
| Modify | `cv-builder/lib/schemas/resume.zod.ts` |
| Modify | `cv-builder/lib/schemas/__tests__/resume.zod.test.ts` |
| Modify | `cv-builder/lib/stores/resume-editor.store.ts` |
| Modify | `cv-builder/lib/stores/__tests__/resume-editor.store.test.ts` |
| Modify | `cv-builder/components/editor/AccordionSection.tsx` |
| Modify | `cv-builder/components/editor/AccordionSection.test.tsx` |
| Modify | `cv-builder/components/editor/EditTab.tsx` |
| Modify | `cv-builder/components/editor/EditTab.test.tsx` |
| Modify | `cv-builder/components/templates/ClassicTemplate.tsx` |
| Modify | `cv-builder/components/templates/ModernTemplate.tsx` |
| Modify | `cv-builder/components/templates/MinimalTemplate.tsx` |
| Create | `cv-builder/components/templates/renderCustomSection.tsx` |
| Create | `cv-builder/components/templates/renderCustomSection.test.tsx` |
| Create | `cv-builder/components/editor/forms/CustomSectionForm.tsx` |
| Create | `cv-builder/components/editor/forms/CustomSectionForm.test.tsx` |
| Delete | `cv-builder/components/editor/forms/CertificatesForm.tsx` |
| Delete | `cv-builder/components/editor/forms/AwardsForm.tsx` |
| Delete | `cv-builder/components/editor/forms/PublicationsForm.tsx` |
| Delete | `cv-builder/components/editor/forms/InterestsForm.tsx` |
| Delete | `cv-builder/components/editor/forms/ProjectsForm.tsx` |

---

## Task 1: Zod Schema — CustomSection types

**Files:**
- Modify: `cv-builder/lib/schemas/resume.zod.ts`
- Test: `cv-builder/lib/schemas/__tests__/resume.zod.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `cv-builder/lib/schemas/__tests__/resume.zod.test.ts`:

```typescript
import {
  CreateResumeSchema,
  PatchResumeSchema,
  ResumeMetaSchema,
  ResumeDataSchema,
  CustomSectionSchema,
} from '../resume.zod'

// ... (keep existing tests) ...

describe('CustomSectionSchema', () => {
  it('accepts a valid custom section with items', () => {
    const result = CustomSectionSchema.safeParse({
      id: 'abc',
      name: 'My Section',
      enabledFields: ['summary', 'highlights'],
      items: [{ id: 'i1', title: 'Entry', summary: 'Details' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid enabledFields value', () => {
    const result = CustomSectionSchema.safeParse({
      id: 'abc',
      name: 'X',
      enabledFields: ['bogusField'],
      items: [],
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty items and enabledFields', () => {
    const result = CustomSectionSchema.safeParse({
      id: 'x', name: 'Y', enabledFields: [], items: [],
    })
    expect(result.success).toBe(true)
  })
})

describe('ResumeDataSchema — customSections', () => {
  it('accepts data with customSections array', () => {
    const result = ResumeDataSchema.safeParse({
      customSections: [{
        id: 's1',
        name: 'Publications',
        enabledFields: ['subtitle', 'dateRange', 'url'],
        items: [{ id: 'i1', title: 'My Paper', subtitle: 'Journal X', startDate: '2024-01' }],
      }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts data without customSections (optional)', () => {
    expect(ResumeDataSchema.safeParse({}).success).toBe(true)
  })
})

describe('ResumeMetaSchema — updated sectionOrder default', () => {
  it('default sectionOrder no longer includes removed sections', () => {
    const result = ResumeMetaSchema.parse({})
    expect(result.sectionOrder).not.toContain('certificates')
    expect(result.sectionOrder).not.toContain('awards')
    expect(result.sectionOrder).not.toContain('publications')
    expect(result.sectionOrder).not.toContain('interests')
    expect(result.sectionOrder).not.toContain('projects')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd cv-builder && npx vitest run lib/schemas/__tests__/resume.zod.test.ts
```

Expected: FAIL — `CustomSectionSchema` not exported, `customSections` not a known field.

- [ ] **Step 3: Implement schema changes**

Replace the contents of `cv-builder/lib/schemas/resume.zod.ts` with:

```typescript
// lib/schemas/resume.zod.ts
import { z } from 'zod'

const LocationSchema = z.object({
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryCode: z.string().optional(),
  region: z.string().optional(),
})

const ProfileSchema = z.object({
  network: z.string().optional(),
  username: z.string().optional(),
  url: z.string().url().optional(),
})

const BasicsSchema = z.object({
  name: z.string().optional(),
  label: z.string().optional(),
  image: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  url: z.string().url().optional(),
  summary: z.string().optional(),
  location: LocationSchema.optional(),
  profiles: z.array(ProfileSchema).optional(),
})

const WorkSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  position: z.string().optional(),
  url: z.string().url().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
})

const EducationSchema = z.object({
  institution: z.string().optional(),
  url: z.string().url().optional(),
  area: z.string().optional(),
  studyType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  score: z.string().optional(),
  courses: z.array(z.string()).optional(),
})

const SkillSchema = z.object({
  name: z.string().optional(),
  level: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

const CertificateSchema = z.object({
  name: z.string().optional(),
  date: z.string().optional(),
  issuer: z.string().optional(),
  url: z.string().url().optional(),
})

const AwardSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  awarder: z.string().optional(),
  summary: z.string().optional(),
})

const PublicationSchema = z.object({
  name: z.string().optional(),
  publisher: z.string().optional(),
  releaseDate: z.string().optional(),
  url: z.string().url().optional(),
  summary: z.string().optional(),
})

const VolunteerSchema = z.object({
  organization: z.string().optional(),
  position: z.string().optional(),
  url: z.string().url().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
})

const LanguageSchema = z.object({
  language: z.string().optional(),
  fluency: z.string().optional(),
})

const InterestSchema = z.object({
  name: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

const ProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  url: z.string().url().optional(),
  roles: z.array(z.string()).optional(),
  entity: z.string().optional(),
  type: z.string().optional(),
})

export const CUSTOM_SECTION_FIELDS = [
  'subtitle', 'url', 'dateRange', 'summary', 'highlights', 'keywords', 'level',
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

export const CustomSectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabledFields: z.array(z.enum(CUSTOM_SECTION_FIELDS)),
  items: z.array(CustomSectionItemSchema),
})

export const ResumeDataSchema = z.object({
  basics: BasicsSchema.optional(),
  work: z.array(WorkSchema).optional(),
  education: z.array(EducationSchema).optional(),
  skills: z.array(SkillSchema).optional(),
  certificates: z.array(CertificateSchema).optional(),
  awards: z.array(AwardSchema).optional(),
  publications: z.array(PublicationSchema).optional(),
  volunteer: z.array(VolunteerSchema).optional(),
  languages: z.array(LanguageSchema).optional(),
  interests: z.array(InterestSchema).optional(),
  projects: z.array(ProjectSchema).optional(),
  customSections: z.array(CustomSectionSchema).optional(),
})

export const ResumeMetaSchema = z.object({
  templateId: z.string().default('classic'),
  fontFamily: z.string().default('Calibri'),
  headerFontFamily: z.string().default('Calibri'),
  primaryColor: z.string().default('#000000'),
  accentColor: z.string().default('#0066cc'),
  pageMargins: z.number().min(0.5).max(1.5).default(1.0),
  lineSpacing: z.number().min(1.0).max(1.15).default(1.15),
  sectionOrder: z
    .array(z.string())
    .default(['work', 'education', 'skills', 'volunteer', 'languages']),
  layout: z.enum(['single-column', 'two-column']).default('single-column'),
})

export const CreateResumeSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  data: ResumeDataSchema.optional().default({}),
  meta: ResumeMetaSchema.optional().default(() => ResumeMetaSchema.parse({})),
})

const ResumeMetaPatchSchema = z.object({
  templateId: z.string().optional(),
  fontFamily: z.string().optional(),
  headerFontFamily: z.string().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  pageMargins: z.number().min(0.5).max(1.5).optional(),
  lineSpacing: z.number().min(1.0).max(1.15).optional(),
  sectionOrder: z.array(z.string()).optional(),
  layout: z.enum(['single-column', 'two-column']).optional(),
})

export const PatchResumeSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  data: ResumeDataSchema.optional(),
  meta: ResumeMetaPatchSchema.optional(),
})

export type ResumeData = z.infer<typeof ResumeDataSchema>
export type ResumeMeta = z.infer<typeof ResumeMetaSchema>
export type CustomSection = z.infer<typeof CustomSectionSchema>
export type CustomSectionItem = z.infer<typeof CustomSectionItemSchema>
export type CustomSectionFieldType = typeof CUSTOM_SECTION_FIELDS[number]
export type CreateResumeInput = z.infer<typeof CreateResumeSchema>
export type PatchResumeInput = z.infer<typeof PatchResumeSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd cv-builder && npx vitest run lib/schemas/__tests__/resume.zod.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```
git add cv-builder/lib/schemas/resume.zod.ts cv-builder/lib/schemas/__tests__/resume.zod.test.ts
git commit -m "feat(schema): add CustomSection types and customSections field to ResumeData"
```

---

## Task 2: Store — Custom section actions

**Files:**
- Modify: `cv-builder/lib/stores/resume-editor.store.ts`
- Test: `cv-builder/lib/stores/__tests__/resume-editor.store.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `cv-builder/lib/stores/__tests__/resume-editor.store.test.ts`:

```typescript
import type { CustomSection } from '@/lib/schemas/resume.zod'

// Add to the existing beforeEach reset — update defaultMeta to use new sectionOrder:
// sectionOrder: ['work', 'education', 'skills', 'volunteer', 'languages'],
// (update the existing defaultMeta constant in the file)

const sampleSection: CustomSection = {
  id: 'sec1',
  name: 'My Publications',
  enabledFields: ['subtitle', 'dateRange'],
  items: [],
}

describe('addCustomSection', () => {
  it('appends section to data.customSections and adds custom:id to sectionOrder', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', {}, defaultMeta)
    useResumeEditorStore.getState().addCustomSection(sampleSection)
    const s = useResumeEditorStore.getState()
    expect(s.data.customSections).toEqual([sampleSection])
    expect(s.meta.sectionOrder).toContain('custom:sec1')
    expect(s.isDirty).toBe(true)
  })

  it('appends multiple sections independently', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', {}, defaultMeta)
    useResumeEditorStore.getState().addCustomSection(sampleSection)
    useResumeEditorStore.getState().addCustomSection({ ...sampleSection, id: 'sec2', name: 'Awards' })
    const s = useResumeEditorStore.getState()
    expect(s.data.customSections).toHaveLength(2)
    expect(s.meta.sectionOrder).toContain('custom:sec1')
    expect(s.meta.sectionOrder).toContain('custom:sec2')
  })
})

describe('updateCustomSection', () => {
  it('patches name without affecting other sections or sectionOrder', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', { customSections: [sampleSection] }, {
      ...defaultMeta,
      sectionOrder: [...defaultMeta.sectionOrder, 'custom:sec1'],
    })
    useResumeEditorStore.getState().updateCustomSection('sec1', { name: 'Renamed' })
    const s = useResumeEditorStore.getState()
    expect(s.data.customSections?.[0].name).toBe('Renamed')
    expect(s.meta.sectionOrder).toContain('custom:sec1')
    expect(s.isDirty).toBe(true)
  })

  it('patches enabledFields without losing items', () => {
    const withItem: CustomSection = {
      ...sampleSection,
      items: [{ id: 'i1', title: 'Paper' }],
    }
    useResumeEditorStore.getState().hydrate('r1', 'CV', { customSections: [withItem] }, defaultMeta)
    useResumeEditorStore.getState().updateCustomSection('sec1', { enabledFields: ['summary', 'keywords'] })
    const s = useResumeEditorStore.getState()
    expect(s.data.customSections?.[0].enabledFields).toEqual(['summary', 'keywords'])
    expect(s.data.customSections?.[0].items).toEqual([{ id: 'i1', title: 'Paper' }])
  })
})

describe('removeCustomSection', () => {
  it('removes section from data and removes key from sectionOrder', () => {
    useResumeEditorStore.getState().hydrate('r1', 'CV', { customSections: [sampleSection] }, {
      ...defaultMeta,
      sectionOrder: [...defaultMeta.sectionOrder, 'custom:sec1'],
    })
    useResumeEditorStore.getState().removeCustomSection('sec1')
    const s = useResumeEditorStore.getState()
    expect(s.data.customSections).toEqual([])
    expect(s.meta.sectionOrder).not.toContain('custom:sec1')
    expect(s.isDirty).toBe(true)
  })

  it('removing one section does not affect other custom sections', () => {
    const sec2: CustomSection = { ...sampleSection, id: 'sec2', name: 'Other' }
    useResumeEditorStore.getState().hydrate('r1', 'CV',
      { customSections: [sampleSection, sec2] },
      { ...defaultMeta, sectionOrder: [...defaultMeta.sectionOrder, 'custom:sec1', 'custom:sec2'] }
    )
    useResumeEditorStore.getState().removeCustomSection('sec1')
    const s = useResumeEditorStore.getState()
    expect(s.data.customSections).toHaveLength(1)
    expect(s.data.customSections?.[0].id).toBe('sec2')
    expect(s.meta.sectionOrder).toContain('custom:sec2')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd cv-builder && npx vitest run lib/stores/__tests__/resume-editor.store.test.ts
```

Expected: FAIL — `addCustomSection`, `updateCustomSection`, `removeCustomSection` are not functions.

- [ ] **Step 3: Implement store changes**

Replace `cv-builder/lib/stores/resume-editor.store.ts` with:

```typescript
// lib/stores/resume-editor.store.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { ResumeData, ResumeMeta, CustomSection } from '@/lib/schemas/resume.zod'

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
  addCustomSection: (section: CustomSection) => void
  updateCustomSection: (id: string, patch: Partial<CustomSection>) => void
  removeCustomSection: (id: string) => void
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
      sectionOrder: ['work', 'education', 'skills', 'volunteer', 'languages'],
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
    addCustomSection: (section) =>
      set((s) => ({
        data: { ...s.data, customSections: [...(s.data.customSections ?? []), section] },
        meta: { ...s.meta, sectionOrder: [...s.meta.sectionOrder, `custom:${section.id}`] },
        isDirty: true,
      })),
    updateCustomSection: (id, patch) =>
      set((s) => ({
        data: {
          ...s.data,
          customSections: (s.data.customSections ?? []).map((cs) =>
            cs.id === id ? { ...cs, ...patch } : cs
          ),
        },
        isDirty: true,
      })),
    removeCustomSection: (id) =>
      set((s) => ({
        data: {
          ...s.data,
          customSections: (s.data.customSections ?? []).filter((cs) => cs.id !== id),
        },
        meta: {
          ...s.meta,
          sectionOrder: s.meta.sectionOrder.filter((k) => k !== `custom:${id}`),
        },
        isDirty: true,
      })),
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
  _retryCount = 0
  if (_saveTimer) {
    clearTimeout(_saveTimer)
    _saveTimer = null
  }
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
      _setSaveError("Changes couldn't be saved — retrying failed. Please check your connection.")
    }
  } finally {
    _setIsSaving(false)
  }
}
```

- [ ] **Step 4: Run all store tests**

```
cd cv-builder && npx vitest run lib/stores/__tests__/resume-editor.store.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```
git add cv-builder/lib/stores/resume-editor.store.ts cv-builder/lib/stores/__tests__/resume-editor.store.test.ts
git commit -m "feat(store): add addCustomSection, updateCustomSection, removeCustomSection actions"
```

---

## Task 3: AccordionSection — onRename and onDelete props

**Files:**
- Modify: `cv-builder/components/editor/AccordionSection.tsx`
- Test: `cv-builder/components/editor/AccordionSection.test.tsx`

- [ ] **Step 1: Write failing tests**

Append to `cv-builder/components/editor/AccordionSection.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd cv-builder && npx vitest run components/editor/AccordionSection.test.tsx
```

Expected: FAIL — `onRename` and `onDelete` props are not implemented.

- [ ] **Step 3: Implement AccordionSection changes**

Replace `cv-builder/components/editor/AccordionSection.tsx` with:

```typescript
'use client'

import type { ReactNode } from 'react'

interface AccordionSectionProps {
  title: string
  badge?: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRename?: (name: string) => void
  onDelete?: () => void
}

export function AccordionSection({
  title,
  badge,
  isOpen,
  onToggle,
  children,
  onMoveUp,
  onMoveDown,
  onRename,
  onDelete,
}: AccordionSectionProps) {
  return (
    <div className="border border-indigo-100 rounded-xl overflow-hidden bg-white/60 backdrop-blur-sm shadow-sm">
      <div className="flex items-center gap-1 pr-2 bg-white/70 hover:bg-white/90 transition-colors">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex-1 flex items-center gap-2 px-4 py-3 text-left min-w-0"
        >
          {onRename ? (
            <input
              type="text"
              value={title}
              onChange={(e) => onRename(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Section name"
              className="font-medium text-sm text-indigo-900 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 w-full"
            />
          ) : (
            <span className="font-medium text-sm text-indigo-900">{title}</span>
          )}
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 shrink-0">
              {badge}
            </span>
          )}
        </button>
        {onMoveUp && (
          <button
            type="button"
            onClick={onMoveUp}
            className="p-1 text-indigo-300 hover:text-indigo-600 rounded"
            aria-label={`Move ${title} up`}
          >
            ↑
          </button>
        )}
        {onMoveDown && (
          <button
            type="button"
            onClick={onMoveDown}
            className="p-1 text-indigo-300 hover:text-indigo-600 rounded"
            aria-label={`Move ${title} down`}
          >
            ↓
          </button>
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
        <span aria-hidden="true" className="text-indigo-300 text-xs px-3">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-indigo-100 bg-white/50">{children}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run all AccordionSection tests**

```
cd cv-builder && npx vitest run components/editor/AccordionSection.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```
git add cv-builder/components/editor/AccordionSection.tsx cv-builder/components/editor/AccordionSection.test.tsx
git commit -m "feat(accordion): add onRename and onDelete optional props for custom sections"
```

---

## Task 4: renderCustomSection — Shared template renderer

**Files:**
- Create: `cv-builder/components/templates/renderCustomSection.tsx`
- Create: `cv-builder/components/templates/renderCustomSection.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `cv-builder/components/templates/renderCustomSection.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CSSProperties } from 'react'
import { renderCustomSection } from './renderCustomSection'
import type { CustomSection } from '@/lib/schemas/resume.zod'

const styles = {
  sectionTitle: { fontSize: '13pt', fontWeight: 700 } as CSSProperties,
  accentColor: '#0066cc',
}

describe('renderCustomSection', () => {
  it('returns null when items array is empty', () => {
    const section: CustomSection = { id: '1', name: 'Empty', enabledFields: [], items: [] }
    const result = renderCustomSection(section, styles)
    expect(result).toBeNull()
  })

  it('renders the section name', () => {
    const section: CustomSection = {
      id: '1', name: 'My Publications', enabledFields: [],
      items: [{ id: 'i1', title: 'Paper One' }],
    }
    render(<div>{renderCustomSection(section, styles)}</div>)
    expect(screen.getByText('My Publications')).toBeTruthy()
  })

  it('renders item title always', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: [],
      items: [{ id: 'i1', title: 'The Title' }],
    }
    render(<div>{renderCustomSection(section, styles)}</div>)
    expect(screen.getByText('The Title')).toBeTruthy()
  })

  it('renders subtitle only when enabledFields includes subtitle', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['subtitle'],
      items: [{ id: 'i1', title: 'T', subtitle: 'Sub Text' }],
    }
    render(<div>{renderCustomSection(section, styles)}</div>)
    expect(screen.getByText('Sub Text')).toBeTruthy()
  })

  it('does not render subtitle when not in enabledFields', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: [],
      items: [{ id: 'i1', title: 'T', subtitle: 'Hidden' }],
    }
    render(<div>{renderCustomSection(section, styles)}</div>)
    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('renders summary when enabledFields includes summary', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['summary'],
      items: [{ id: 'i1', title: 'T', summary: 'Detail text here' }],
    }
    render(<div>{renderCustomSection(section, styles)}</div>)
    expect(screen.getByText('Detail text here')).toBeTruthy()
  })

  it('renders highlights as list items when enabledFields includes highlights', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['highlights'],
      items: [{ id: 'i1', title: 'T', highlights: ['Bullet A', 'Bullet B'] }],
    }
    render(<div>{renderCustomSection(section, styles)}</div>)
    expect(screen.getByText('Bullet A')).toBeTruthy()
    expect(screen.getByText('Bullet B')).toBeTruthy()
  })

  it('renders keywords joined by · when enabledFields includes keywords', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['keywords'],
      items: [{ id: 'i1', title: 'T', keywords: ['React', 'TypeScript'] }],
    }
    render(<div>{renderCustomSection(section, styles)}</div>)
    expect(screen.getByText('React · TypeScript')).toBeTruthy()
  })

  it('renders level when enabledFields includes level', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['level'],
      items: [{ id: 'i1', title: 'T', level: 'Advanced' }],
    }
    render(<div>{renderCustomSection(section, styles)}</div>)
    expect(screen.getByText('Level: Advanced')).toBeTruthy()
  })

  it('renders date range when enabledFields includes dateRange', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['dateRange'],
      items: [{ id: 'i1', title: 'T', startDate: '2022-01', endDate: '2023-06' }],
    }
    render(<div>{renderCustomSection(section, styles)}</div>)
    expect(screen.getByText('2022-01 – 2023-06')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd cv-builder && npx vitest run components/templates/renderCustomSection.test.tsx
```

Expected: FAIL — module `renderCustomSection` does not exist.

- [ ] **Step 3: Create renderCustomSection**

Create `cv-builder/components/templates/renderCustomSection.tsx`:

```typescript
import type { CSSProperties } from 'react'
import type { CustomSection } from '@/lib/schemas/resume.zod'

interface RenderStyles {
  sectionTitle: CSSProperties
  accentColor: string
}

export function renderCustomSection(
  section: CustomSection,
  styles: RenderStyles
): React.ReactNode {
  const { name, enabledFields, items } = section
  if (!items.length) return null

  return (
    <div key={section.id}>
      <div style={styles.sectionTitle}>{name}</div>
      {items.map((item, i) => (
        <div key={item.id || i} style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            {item.title && <strong style={{ fontSize: '11pt' }}>{item.title}</strong>}
            {enabledFields.includes('dateRange') && (item.startDate || item.endDate) && (
              <span style={{ fontSize: '10pt', color: '#666' }}>
                {[item.startDate, item.endDate].filter(Boolean).join(' – ')}
              </span>
            )}
          </div>
          {enabledFields.includes('subtitle') && item.subtitle && (
            <div style={{ color: styles.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>
              {item.subtitle}
            </div>
          )}
          {enabledFields.includes('url') && item.url && (
            <div style={{ fontSize: '9pt', color: '#666' }}>
              <a href={item.url}>{item.url}</a>
            </div>
          )}
          {enabledFields.includes('summary') && item.summary && (
            <div style={{ fontSize: '10pt', marginTop: '3px' }}>{item.summary}</div>
          )}
          {enabledFields.includes('highlights') && (item.highlights ?? []).length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
              {(item.highlights ?? []).map((h, hi) => <li key={hi}>{h}</li>)}
            </ul>
          )}
          {enabledFields.includes('keywords') && (item.keywords ?? []).length > 0 && (
            <div style={{ fontSize: '9pt', color: '#555', marginTop: '3px' }}>
              {(item.keywords ?? []).join(' · ')}
            </div>
          )}
          {enabledFields.includes('level') && item.level && (
            <div style={{ fontSize: '9pt', color: '#555' }}>Level: {item.level}</div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd cv-builder && npx vitest run components/templates/renderCustomSection.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```
git add cv-builder/components/templates/renderCustomSection.tsx cv-builder/components/templates/renderCustomSection.test.tsx
git commit -m "feat(templates): add shared renderCustomSection renderer"
```

---

## Task 5: CustomSectionForm — Editor form component

**Files:**
- Create: `cv-builder/components/editor/forms/CustomSectionForm.tsx`
- Create: `cv-builder/components/editor/forms/CustomSectionForm.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `cv-builder/components/editor/forms/CustomSectionForm.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CustomSectionForm } from './CustomSectionForm'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import type { CustomSection, CustomSectionFieldType } from '@/lib/schemas/resume.zod'

vi.mock('@/lib/stores/resume-editor.store', () => ({
  useResumeEditorStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}))

const updateCustomSection = vi.fn()

const baseSection: CustomSection = {
  id: 'sec1',
  name: 'My Section',
  enabledFields: ['summary'] as CustomSectionFieldType[],
  items: [],
}

function mockStore(section: CustomSection) {
  vi.mocked(useResumeEditorStore).mockImplementation((sel: (s: unknown) => unknown) =>
    sel({ data: { customSections: [section] }, updateCustomSection })
  )
}

beforeEach(() => {
  updateCustomSection.mockClear()
  mockStore(baseSection)
})

describe('CustomSectionForm', () => {
  it('renders all 7 field toggle buttons', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    expect(screen.getByRole('button', { name: /^subtitle$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^dates$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^url$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^text$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^bullets$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^keywords$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^level$/i })).toBeTruthy()
  })

  it('active toggle (summary→Text) has indigo background class', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    expect(screen.getByRole('button', { name: /^text$/i }).className).toContain('bg-indigo-500')
  })

  it('inactive toggle does not have indigo background', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    expect(screen.getByRole('button', { name: /^subtitle$/i }).className).not.toContain('bg-indigo-500')
  })

  it('clicking inactive toggle calls updateCustomSection with the field added', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    fireEvent.click(screen.getByRole('button', { name: /^subtitle$/i }))
    expect(updateCustomSection).toHaveBeenCalledWith('sec1', {
      enabledFields: ['summary', 'subtitle'],
    })
  })

  it('clicking active toggle calls updateCustomSection with the field removed', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    fireEvent.click(screen.getByRole('button', { name: /^text$/i }))
    expect(updateCustomSection).toHaveBeenCalledWith('sec1', {
      enabledFields: [],
    })
  })

  it('renders "Add entry" button', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    expect(screen.getByRole('button', { name: /add entry/i })).toBeTruthy()
  })

  it('returns nothing when section is not found', () => {
    render(<CustomSectionForm sectionId="nonexistent" />)
    expect(screen.queryByRole('button', { name: /^subtitle$/i })).toBeNull()
  })

  it('shows enabled field input for items when field is active', () => {
    const sectionWithItem: CustomSection = {
      ...baseSection,
      enabledFields: ['summary'] as CustomSectionFieldType[],
      items: [{ id: 'i1', title: 'My Entry', summary: 'Existing summary' }],
    }
    mockStore(sectionWithItem)
    render(<CustomSectionForm sectionId="sec1" />)
    expect(screen.getByDisplayValue('Existing summary')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd cv-builder && npx vitest run components/editor/forms/CustomSectionForm.test.tsx
```

Expected: FAIL — module `CustomSectionForm` does not exist.

- [ ] **Step 3: Create CustomSectionForm**

Create `cv-builder/components/editor/forms/CustomSectionForm.tsx`:

```typescript
'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { CUSTOM_SECTION_FIELDS } from '@/lib/schemas/resume.zod'
import type { CustomSection, CustomSectionItem, CustomSectionFieldType } from '@/lib/schemas/resume.zod'

const FIELD_LABELS: Record<CustomSectionFieldType, string> = {
  subtitle: 'Subtitle',
  dateRange: 'Dates',
  url: 'URL',
  summary: 'Text',
  highlights: 'Bullets',
  keywords: 'Keywords',
  level: 'Level',
}

const inputClass =
  'w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function createEmptyItem(): CustomSectionItem {
  return { id: crypto.randomUUID() }
}

interface ItemFormProps {
  item: CustomSectionItem
  enabledFields: CustomSectionFieldType[]
  onUpdate: (v: CustomSectionItem) => void
  onRemove: () => void
}

function ItemForm({ item, enabledFields, onUpdate, onRemove }: ItemFormProps) {
  const set = (f: keyof CustomSectionItem, v: string) => onUpdate({ ...item, [f]: v })
  const setArr = (f: 'highlights' | 'keywords', v: string[]) => onUpdate({ ...item, [f]: v })

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <input type="text" value={item.title ?? ''} onChange={(e) => set('title', e.target.value)}
          placeholder="Title" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove item"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>

      {enabledFields.includes('subtitle') && (
        <input type="text" value={item.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)}
          placeholder="Subtitle" className={inputClass} />
      )}

      {enabledFields.includes('dateRange') && (
        <div className="grid grid-cols-2 gap-2">
          <input type="text" value={item.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)}
            placeholder="Start date" className={inputClass} />
          <input type="text" value={item.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)}
            placeholder="End date" className={inputClass} />
        </div>
      )}

      {enabledFields.includes('url') && (
        <input type="url" value={item.url ?? ''} onChange={(e) => set('url', e.target.value)}
          placeholder="URL" className={inputClass} />
      )}

      {enabledFields.includes('summary') && (
        <textarea value={item.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
          placeholder="Description..." rows={2}
          className="w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y" />
      )}

      {enabledFields.includes('highlights') && (
        <div className="space-y-1">
          <div className="text-xs text-indigo-500 font-medium">Bullets</div>
          {(item.highlights ?? []).map((h, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" value={h}
                onChange={(e) => {
                  const next = [...(item.highlights ?? [])]
                  next[i] = e.target.value
                  setArr('highlights', next)
                }}
                placeholder="Bullet point..." className={`${inputClass} flex-1`} />
              <button type="button"
                onClick={() => setArr('highlights', (item.highlights ?? []).filter((_, idx) => idx !== i))}
                className="text-gray-400 hover:text-red-500 text-sm">✕</button>
            </div>
          ))}
          <button type="button"
            onClick={() => setArr('highlights', [...(item.highlights ?? []), ''])}
            className="text-xs text-indigo-500 hover:text-indigo-700">+ Add bullet</button>
        </div>
      )}

      {enabledFields.includes('keywords') && (
        <div className="space-y-1">
          <div className="text-xs text-indigo-500 font-medium">Keywords</div>
          <div className="flex flex-wrap gap-1">
            {(item.keywords ?? []).map((kw, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs">
                {kw}
                <button type="button"
                  onClick={() => setArr('keywords', (item.keywords ?? []).filter((_, idx) => idx !== i))}
                  className="hover:text-red-500">×</button>
              </span>
            ))}
          </div>
          <input type="text" placeholder="Add keyword, press Enter" className={inputClass}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const val = (e.target as HTMLInputElement).value.trim()
                if (val) {
                  setArr('keywords', [...(item.keywords ?? []), val]);
                  (e.target as HTMLInputElement).value = ''
                }
              }
            }} />
        </div>
      )}

      {enabledFields.includes('level') && (
        <input type="text" value={item.level ?? ''} onChange={(e) => set('level', e.target.value)}
          placeholder="Level (e.g. Beginner, Advanced)" className={inputClass} />
      )}
    </div>
  )
}

export function CustomSectionForm({ sectionId }: { sectionId: string }) {
  const section = useResumeEditorStore(
    (s) => s.data.customSections?.find((cs) => cs.id === sectionId)
  ) as CustomSection | undefined
  const updateCustomSection = useResumeEditorStore((s) => s.updateCustomSection)

  if (!section) return null

  function toggleField(field: CustomSectionFieldType) {
    const has = section!.enabledFields.includes(field)
    updateCustomSection(sectionId, {
      enabledFields: has
        ? section!.enabledFields.filter((f) => f !== field)
        : [...section!.enabledFields, field],
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {CUSTOM_SECTION_FIELDS.map((field) => {
          const active = section.enabledFields.includes(field)
          return (
            <button
              key={field}
              type="button"
              onClick={() => toggleField(field)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                active
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : 'bg-white border-indigo-200 text-indigo-400 hover:border-indigo-400'
              }`}
            >
              {FIELD_LABELS[field]}
            </button>
          )
        })}
      </div>

      <ListFieldManager<CustomSectionItem>
        items={section.items}
        onChange={(items) => updateCustomSection(sectionId, { items })}
        createEmpty={createEmptyItem}
        addLabel="Add entry"
        renderItem={(item, _, onUpdate, onRemove) => (
          <ItemForm
            item={item}
            enabledFields={section.enabledFields}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        )}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd cv-builder && npx vitest run components/editor/forms/CustomSectionForm.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```
git add cv-builder/components/editor/forms/CustomSectionForm.tsx cv-builder/components/editor/forms/CustomSectionForm.test.tsx
git commit -m "feat(editor): add CustomSectionForm with configurable field toggles"
```

---

## Task 6: EditTab — Rewire with custom sections

**Files:**
- Modify: `cv-builder/components/editor/EditTab.tsx`
- Modify: `cv-builder/components/editor/EditTab.test.tsx`

- [ ] **Step 1: Rewrite EditTab.test.tsx**

Replace `cv-builder/components/editor/EditTab.test.tsx` with:

```typescript
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
vi.mock('./forms/CustomSectionForm', () => ({ CustomSectionForm: ({ sectionId }: { sectionId: string }) => <div>CustomSectionForm:{sectionId}</div> }))

const setMeta = vi.fn()
const addCustomSection = vi.fn()
const updateCustomSection = vi.fn()
const removeCustomSection = vi.fn()

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
  vi.mocked(useResumeEditorStore).mockImplementation((sel: (s: unknown) => unknown) =>
    sel({ meta, data, setMeta, addCustomSection, updateCustomSection, removeCustomSection })
  );
  (useResumeEditorStore as { getState: ReturnType<typeof vi.fn> }).getState.mockReturnValue(
    { meta, data, setMeta, addCustomSection, updateCustomSection, removeCustomSection }
  )
}

beforeEach(() => {
  setMeta.mockClear()
  addCustomSection.mockClear()
  updateCustomSection.mockClear()
  removeCustomSection.mockClear()
  setupStore()
})

describe('EditTab — built-in sections', () => {
  it('renders Personal Info first, then sectionOrder sections', () => {
    render(<EditTab />)
    expect(screen.getByRole('button', { name: /personal info/i })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /work experience/i }).length).toBeGreaterThan(0)
  })

  it('basics section has no ↑↓ or delete buttons', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /move personal info/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete personal info/i })).toBeNull()
  })

  it('first section in sectionOrder has ↓ but no ↑', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /move work experience up/i })).toBeNull()
    expect(screen.getByRole('button', { name: /move work experience down/i })).toBeTruthy()
  })

  it('clicking ↓ on a section calls setMeta with swapped sectionOrder', () => {
    render(<EditTab />)
    fireEvent.click(screen.getByRole('button', { name: /move work experience down/i }))
    expect(setMeta).toHaveBeenCalledWith({ sectionOrder: ['education', 'work', 'skills'] })
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

  it('renders custom section accordion with its name', () => {
    setupStore({
      sectionOrder: ['work', 'custom:cs1'],
      customSections: [customSection],
    })
    render(<EditTab />)
    const input = screen.getByDisplayValue('My Certifications')
    expect(input).toBeTruthy()
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

- [ ] **Step 2: Run tests to verify they fail**

```
cd cv-builder && npx vitest run components/editor/EditTab.test.tsx
```

Expected: FAIL on custom section tests — EditTab doesn't support custom sections yet.

- [ ] **Step 3: Rewrite EditTab.tsx**

Replace `cv-builder/components/editor/EditTab.tsx` with:

```typescript
'use client'

import { useState } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { AccordionSection } from './AccordionSection'
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

export function EditTab() {
  const [openSection, setOpenSection] = useState<string | null>('basics')
  const meta = useResumeEditorStore((s) => s.meta)
  const data = useResumeEditorStore((s) => s.data)
  const setMeta = useResumeEditorStore((s) => s.setMeta)
  const addCustomSection = useResumeEditorStore((s) => s.addCustomSection)
  const updateCustomSection = useResumeEditorStore((s) => s.updateCustomSection)
  const removeCustomSection = useResumeEditorStore((s) => s.removeCustomSection)

  const orderedSections = (meta.sectionOrder?.length > 0
    ? meta.sectionOrder
    : ['work', 'education', 'skills', 'volunteer', 'languages']
  ).filter((s) => s in SECTION_FORMS || s.startsWith('custom:'))

  const sectionOrder = ['basics', ...orderedSections]

  function moveSection(metaIdx: number, direction: 'up' | 'down') {
    const current = useResumeEditorStore.getState().meta.sectionOrder
    const order = [...current]
    const swapIdx = direction === 'up' ? metaIdx - 1 : metaIdx + 1
    ;[order[metaIdx], order[swapIdx]] = [order[swapIdx], order[metaIdx]]
    setMeta({ sectionOrder: order })
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
      {sectionOrder.map((section, idx) => {
        const metaIdx = idx - 1
        const isBasics = section === 'basics'
        const isCustom = section.startsWith('custom:')

        if (isCustom) {
          const customId = section.slice(7)
          const customSection = data.customSections?.find((cs) => cs.id === customId)
          if (!customSection) return null
          return (
            <AccordionSection
              key={section}
              title={customSection.name}
              badge={getCustomBadge(customSection)}
              isOpen={openSection === section}
              onToggle={() => setOpenSection((prev) => (prev === section ? null : section))}
              onMoveUp={metaIdx > 0 ? () => moveSection(metaIdx, 'up') : undefined}
              onMoveDown={metaIdx < orderedSections.length - 1 ? () => moveSection(metaIdx, 'down') : undefined}
              onRename={(name) => updateCustomSection(customId, { name })}
              onDelete={() => removeCustomSection(customId)}
            >
              <CustomSectionForm sectionId={customId} />
            </AccordionSection>
          )
        }

        const FormComponent = SECTION_FORMS[section]
        if (!FormComponent) return null
        return (
          <AccordionSection
            key={section}
            title={SECTION_LABELS[section] ?? section}
            badge={getBadge(section, data)}
            isOpen={openSection === section}
            onToggle={() => setOpenSection((prev) => (prev === section ? null : section))}
            onMoveUp={!isBasics && metaIdx > 0 ? () => moveSection(metaIdx, 'up') : undefined}
            onMoveDown={!isBasics && metaIdx < orderedSections.length - 1 ? () => moveSection(metaIdx, 'down') : undefined}
          >
            <FormComponent />
          </AccordionSection>
        )
      })}

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

- [ ] **Step 4: Run all EditTab tests**

```
cd cv-builder && npx vitest run components/editor/EditTab.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```
git add cv-builder/components/editor/EditTab.tsx cv-builder/components/editor/EditTab.test.tsx
git commit -m "feat(editor): rewire EditTab — remove 5 fixed sections, add custom section support"
```

---

## Task 7: ClassicTemplate — Remove old sections, add custom rendering

**Files:**
- Modify: `cv-builder/components/templates/ClassicTemplate.tsx`

No test file exists for templates. Verify visually after Task 9 using the dev server.

- [ ] **Step 1: Update ClassicTemplate.tsx**

Replace `cv-builder/components/templates/ClassicTemplate.tsx` with:

```typescript
'use client'

import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { renderCustomSection } from './renderCustomSection'

export interface TemplateProps {
  data: ResumeData
  meta: ResumeMeta
}

const ALL_SECTIONS = ['work', 'education', 'skills', 'volunteer', 'languages']

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

  function renderSection(section: string): React.ReactNode {
    if (section.startsWith('custom:')) {
      const customId = section.slice(7)
      const customSection = data.customSections?.find((cs) => cs.id === customId)
      if (!customSection) return null
      return renderCustomSection(customSection, { sectionTitle, accentColor: meta.accentColor })
    }
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
    const leftSections = sectionOrder.filter((s) =>
      ['work', 'education', 'volunteer'].includes(s) || s.startsWith('custom:')
    )
    const rightSections = sectionOrder.filter((s) => ['skills', 'languages'].includes(s))
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

- [ ] **Step 2: Run full test suite to confirm no regressions**

```
cd cv-builder && npx vitest run
```

Expected: All previously passing tests continue to PASS.

- [ ] **Step 3: Commit**

```
git add cv-builder/components/templates/ClassicTemplate.tsx
git commit -m "feat(templates): update ClassicTemplate — remove 5 old sections, add custom section rendering"
```

---

## Task 8: ModernTemplate and MinimalTemplate — Same changes

**Files:**
- Modify: `cv-builder/components/templates/ModernTemplate.tsx`
- Modify: `cv-builder/components/templates/MinimalTemplate.tsx`

- [ ] **Step 1: Replace ModernTemplate.tsx**

Replace `cv-builder/components/templates/ModernTemplate.tsx` with:

```typescript
'use client'
import type { TemplateProps } from './ClassicTemplate'
import { renderCustomSection } from './renderCustomSection'

const ALL_SECTIONS = ['work', 'education', 'skills', 'volunteer', 'languages']

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

  function renderSection(section: string): React.ReactNode {
    if (section.startsWith('custom:')) {
      const customId = section.slice(7)
      const customSection = data.customSections?.find((cs) => cs.id === customId)
      if (!customSection) return null
      return renderCustomSection(customSection, { sectionTitle, accentColor: meta.accentColor })
    }
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
      default:
        return null
    }
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
    const leftSections = sectionOrder.filter((s) =>
      ['work', 'education', 'volunteer'].includes(s) || s.startsWith('custom:')
    )
    const rightSections = sectionOrder.filter((s) => ['skills', 'languages'].includes(s))
    return (
      <div style={page}>
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

- [ ] **Step 2: Replace MinimalTemplate.tsx**

Replace `cv-builder/components/templates/MinimalTemplate.tsx` with:

```typescript
'use client'
import type { TemplateProps } from './ClassicTemplate'
import { renderCustomSection } from './renderCustomSection'

const ALL_SECTIONS = ['work', 'education', 'skills', 'volunteer', 'languages']

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

  function renderSection(section: string): React.ReactNode {
    if (section.startsWith('custom:')) {
      const customId = section.slice(7)
      const customSection = data.customSections?.find((cs) => cs.id === customId)
      if (!customSection) return null
      return renderCustomSection(customSection, { sectionTitle, accentColor: meta.accentColor })
    }
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
      default:
        return null
    }
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

- [ ] **Step 3: Run full test suite**

```
cd cv-builder && npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```
git add cv-builder/components/templates/ModernTemplate.tsx cv-builder/components/templates/MinimalTemplate.tsx
git commit -m "feat(templates): update ModernTemplate and MinimalTemplate — remove old sections, add custom"
```

---

## Task 9: Delete removed form files and final cleanup

**Files:**
- Delete: 5 form files
- No test changes needed (their mocks were already removed from EditTab.test.tsx in Task 6)

- [ ] **Step 1: Delete the five form files**

```
cd cv-builder && rm components/editor/forms/CertificatesForm.tsx components/editor/forms/AwardsForm.tsx components/editor/forms/PublicationsForm.tsx components/editor/forms/InterestsForm.tsx components/editor/forms/ProjectsForm.tsx
```

- [ ] **Step 2: Delete the corresponding test files if they exist**

```
cd cv-builder && ls components/editor/forms/*.test.tsx
```

Remove any test files for the deleted forms (e.g. `CertificatesForm.test.tsx` if present — these forms never had tests based on the directory listing, but confirm first).

- [ ] **Step 3: Run the full test suite**

```
cd cv-builder && npx vitest run
```

Expected: All tests PASS. No broken imports.

- [ ] **Step 4: Commit**

```
git add -A
git commit -m "chore: delete removed form files (certificates, awards, publications, interests, projects)"
```

---

## Verification

After all tasks are complete, start the dev server and manually verify:

```
cd cv-builder && npm run dev
```

1. Open a resume in the editor — confirm Certifications, Awards, Publications, Interests, Projects accordion sections are gone
2. Click **+ Add Section** — a new "New Section" accordion should appear, open immediately
3. Rename the section by typing in its title
4. Toggle field type pills on/off — observe the item form fields appearing/disappearing
5. Add an item — fill in visible fields, confirm data persists across pill toggles
6. Delete the section — confirm it disappears from editor and preview
7. Add multiple custom sections — confirm they can be reordered with ↑↓
8. Switch to the live preview — confirm custom sections render with their names and data
