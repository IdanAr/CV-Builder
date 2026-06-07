# Phase 4: Polish & Beta Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the four remaining product gaps before beta: section drag-and-drop reordering in the Design tab, real ATS format score badge on the dashboard, inline delete confirmation replacing `window.confirm()`, and an editor error boundary that catches crashes gracefully.

**Architecture:** All four tasks are independent UI polish items with no new dependencies. Task 1 adds a drag-and-drop list to `DesignPanel.tsx` using the browser's native HTML5 DnD API plus up/down keyboard buttons (no library). Task 2 adds server-side score computation to the dashboard page and a badge to `ResumeCard`. Task 3 replaces the `window.confirm()` call in `ResumeCard` with inline confirmation state. Task 4 wraps `EditorShell` in a React class-based error boundary component.

**Tech Stack:** React (class component for error boundary), HTML5 Drag and Drop API, existing `scoreResume` from `lib/ats/scorer.ts`, Tailwind CSS, React Testing Library (existing).

---

## File Map

**New:**
- `components/editor/EditorErrorBoundary.tsx` — React class error boundary

**Modified:**
- `components/editor/DesignPanel.tsx` — add `SectionOrderEditor` component (inline, not a separate file) at the bottom of the panel
- `app/(dashboard)/dashboard/page.tsx` — compute `formatScore` per resume using `scoreResume`, pass to `ResumeCard`
- `components/ResumeCard.tsx` — accept `formatScore` prop, render score badge; replace `window.confirm()` with inline confirmation state
- `app/(dashboard)/dashboard/resumes/[id]/page.tsx` — wrap `EditorShell` with `EditorErrorBoundary`

---

### Task 1: Section drag-and-drop reordering in DesignPanel

**Files:**
- Modify: `components/editor/DesignPanel.tsx`

The `meta.sectionOrder` array is already the source of truth for section order across PDF, DOCX, and the editor. This task adds a UI to reorder it: a list of draggable section chips with up/down arrow buttons as a keyboard-accessible fallback. The section labeled "Personal Info" (basics) is never in `sectionOrder` — it's always first and cannot be moved.

- [ ] **Step 1: Read the current DesignPanel**

Read `components/editor/DesignPanel.tsx` to understand the current structure so edits land in the right place.

- [ ] **Step 2: Replace the full file with the updated version**

```tsx
// components/editor/DesignPanel.tsx
'use client'

import { useState } from 'react'
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

const SECTION_LABELS: Record<string, string> = {
  work: 'Work Experience', education: 'Education', skills: 'Skills',
  certificates: 'Certifications', awards: 'Awards', publications: 'Publications',
  volunteer: 'Volunteer', languages: 'Languages', interests: 'Interests',
  projects: 'Projects',
}

interface SectionOrderEditorProps {
  sections: string[]
  onChange: (newOrder: string[]) => void
}

function SectionOrderEditor({ sections, onChange }: SectionOrderEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function moveUp(index: number) {
    if (index === 0) return
    const next = [...sections]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  function moveDown(index: number) {
    if (index === sections.length - 1) return
    const next = [...sections]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const next = [...sections]
    const [removed] = next.splice(dragIndex, 1)
    next.splice(targetIndex, 0, removed)
    onChange(next)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <ul className="space-y-1" role="list" aria-label="Section order">
      {sections.map((section, index) => (
        <li
          key={section}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-grab active:cursor-grabbing transition-colors ${
            dragIndex === index
              ? 'opacity-40 border-blue-300 bg-blue-50'
              : dragOverIndex === index
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <span className="text-gray-300 select-none" aria-hidden="true">⠿</span>
          <span className="flex-1 text-gray-700">{SECTION_LABELS[section] ?? section}</span>
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => moveUp(index)}
              disabled={index === 0}
              aria-label={`Move ${SECTION_LABELS[section] ?? section} up`}
              className="rounded px-1 py-0.5 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-20"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => moveDown(index)}
              disabled={index === sections.length - 1}
              aria-label={`Move ${SECTION_LABELS[section] ?? section} down`}
              className="rounded px-1 py-0.5 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-20"
            >
              ▼
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function DesignPanel() {
  const meta = useResumeEditorStore((s) => s.meta)
  const setMeta = useResumeEditorStore((s) => s.setMeta)

  const selectClass = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1'

  const DEFAULT_ORDER = ['work', 'education', 'skills', 'certificates', 'awards',
    'publications', 'volunteer', 'languages', 'interests', 'projects']
  const sectionOrder = meta.sectionOrder?.length > 0 ? meta.sectionOrder : DEFAULT_ORDER

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
          Page margins — <span className="font-mono">{meta.pageMargins.toFixed(1)}&quot;</span>
        </label>
        <input type="range" min={0.5} max={1.5} step={0.1}
          value={meta.pageMargins}
          onChange={(e) => setMeta({ pageMargins: parseFloat(e.target.value) })}
          className="w-full accent-blue-600" />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
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
          className="w-full accent-blue-600" />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>1.00</span><span>1.15</span>
        </div>
      </div>

      {/* Section order */}
      <div>
        <p className={labelClass}>Section order</p>
        <p className="text-xs text-gray-400 mb-2">Drag or use ▲▼ to reorder. Affects PDF, DOCX, and preview.</p>
        <SectionOrderEditor
          sections={sectionOrder}
          onChange={(newOrder) => setMeta({ sectionOrder: newOrder })}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run full test suite**

```bash
npm run test:run
```

Expected: all tests PASS (no regressions).

- [ ] **Step 5: Commit**

```bash
git add components/editor/DesignPanel.tsx
git commit -m "feat: add section drag-and-drop reordering to Design panel"
```

---

### Task 2: ATS format score badge on dashboard card

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `components/ResumeCard.tsx`

The `scoreResume(data, '').breakdown.format` returns 0–25 (no job description needed). We compute it server-side in `DashboardPage` and pass it as `formatScore` to `ResumeCard`. The badge shows green (≥20), yellow (10–19), or red (<10). The existing "ATS Score — (Phase 3)" placeholder is replaced.

- [ ] **Step 1: Update DashboardPage to compute and pass the format score**

Replace the entire content of `app/(dashboard)/dashboard/page.tsx` with:

```tsx
// app/(dashboard)/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listResumes } from '@/lib/api/resumes'
import { scoreResume } from '@/lib/ats/scorer'
import ResumeCard from '@/components/ResumeCard'
import NewResumeButton from '@/components/NewResumeButton'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const resumes = await listResumes(session.user.id)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My CVs</h1>
        <NewResumeButton />
      </div>

      {resumes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-sm text-gray-500">No CVs yet.</p>
          <p className="mt-1 text-sm text-gray-400">Click &quot;+ New CV&quot; to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {resumes.map((resume) => {
            const formatScore = scoreResume((resume.data ?? {}) as ResumeData, '').breakdown.format
            return (
              <ResumeCard
                key={String(resume._id)}
                resume={{
                  _id: String(resume._id),
                  title: resume.title,
                  data: (resume.data ?? {}) as { basics?: { label?: string } },
                  meta: resume.meta as { templateId?: string; layout?: string },
                  sectionsFilledCount: resume.sectionsFilledCount,
                  formatScore,
                  createdAt: resume.createdAt.toISOString(),
                  updatedAt: resume.updatedAt.toISOString(),
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update ResumeCard to accept and display formatScore**

Replace the entire content of `components/ResumeCard.tsx` with:

```tsx
// components/ResumeCard.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ResumeCardProps {
  resume: {
    _id: string
    title: string
    data: {
      basics?: { label?: string }
    }
    meta: {
      templateId?: string
      layout?: string
    }
    sectionsFilledCount: number
    formatScore: number
    createdAt: string
    updatedAt: string
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 7) return formatDate(iso)
  if (days > 1) return `${days} days ago`
  if (days === 1) return 'Yesterday'
  if (hours > 1) return `${hours} hours ago`
  if (hours === 1) return '1 hour ago'
  if (minutes > 1) return `${minutes} minutes ago`
  return 'Just now'
}

export default function ResumeCard({ resume }: ResumeCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    setConfirmDelete(false)
    try {
      const res = await fetch(`/api/resumes/${resume._id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch (err) {
      console.error(err)
      setDeleting(false)
    }
  }

  async function handleDuplicate() {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/resumes/${resume._id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error('Duplicate failed')
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setDuplicating(false)
    }
  }

  async function handleDownload() {
    try {
      const res = await fetch(`/api/resumes/${resume._id}`)
      if (!res.ok) throw new Error('Fetch failed')
      const { resume: full } = await res.json()
      const blob = new Blob([JSON.stringify(full.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${resume.title}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    }
  }

  const scoreColor =
    resume.formatScore >= 20 ? 'text-green-600' :
    resume.formatScore >= 10 ? 'text-yellow-600' :
    'text-red-500'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{resume.title}</p>
          <p className="truncate text-sm text-gray-500">
            {resume.data.basics?.label ?? 'No role set'} · {resume.meta.templateId ?? 'classic'} template
          </p>
        </div>
        <div className="flex shrink-0 gap-2 items-center">
          <Link
            href={`/dashboard/resumes/${resume._id}`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Open
          </Link>
          <button
            onClick={handleDownload}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            title="Download as JSON"
            aria-label="Download as JSON"
          >
            ↓ JSON
          </button>
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            title="Duplicate"
            aria-label="Duplicate CV"
          >
            {duplicating ? '…' : '⧉'}
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-600 font-medium">Delete?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-red-500 bg-red-500 px-2 py-1.5 text-xs text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? '…' : 'Delete'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              title="Delete"
              aria-label={`Delete ${resume.title}`}
            >
              {deleting ? '…' : '✕'}
            </button>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="mt-3 flex flex-wrap gap-6 border-t border-gray-100 pt-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Created</p>
          <p className="mt-0.5 text-sm text-gray-700">{formatDate(resume.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Last Edited</p>
          <p className="mt-0.5 text-sm text-gray-700">{formatRelativeTime(resume.updatedAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Sections</p>
          <p className="mt-0.5 text-sm text-gray-700">{resume.sectionsFilledCount} filled</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Layout</p>
          <p className="mt-0.5 text-sm capitalize text-gray-700">
            {(resume.meta.layout ?? 'single-column').replace('-', ' ')}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Format Score</p>
          <p className={`mt-0.5 text-sm font-semibold ${scoreColor}`}>
            {resume.formatScore} / 25
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run full test suite**

```bash
npm run test:run
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx" components/ResumeCard.tsx
git commit -m "feat: show format score on dashboard card and replace window.confirm with inline confirmation"
```

---

### Task 3: Editor error boundary

**Files:**
- Create: `components/editor/EditorErrorBoundary.tsx`
- Modify: `app/(dashboard)/dashboard/resumes/[id]/page.tsx`

React error boundaries must be class components. The boundary catches any unhandled error thrown during render inside `EditorShell`, displays a friendly message, and offers a "Try again" button that resets the error state.

- [ ] **Step 1: Write the failing test**

```typescript
// components/editor/EditorErrorBoundary.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorErrorBoundary } from '../EditorErrorBoundary'

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test explosion')
  return <div>Safe content</div>
}

describe('EditorErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <EditorErrorBoundary>
        <Bomb shouldThrow={false} />
      </EditorErrorBoundary>
    )
    expect(screen.getByText('Safe content')).toBeTruthy()
  })

  it('renders error UI when child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <EditorErrorBoundary>
        <Bomb shouldThrow={true} />
      </EditorErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
    consoleSpy.mockRestore()
  })

  it('resets error state when Try again is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <EditorErrorBoundary>
        <Bomb shouldThrow={true} />
      </EditorErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    rerender(
      <EditorErrorBoundary>
        <Bomb shouldThrow={false} />
      </EditorErrorBoundary>
    )
    expect(screen.getByText('Safe content')).toBeTruthy()
    consoleSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run "components/editor/EditorErrorBoundary.test.tsx"
```

Expected: FAIL — Cannot find module `'../EditorErrorBoundary'`

- [ ] **Step 3: Create the error boundary**

```tsx
// components/editor/EditorErrorBoundary.tsx
'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class EditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Editor error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-white">
          <div className="max-w-sm px-6 text-center">
            <p className="text-lg font-semibold text-gray-800">Something went wrong</p>
            <p className="mt-2 text-sm text-gray-500">
              The editor encountered an unexpected error. Your data is saved automatically.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run "components/editor/EditorErrorBoundary.test.tsx"
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Wrap EditorShell in the resume page**

Read `app/(dashboard)/dashboard/resumes/[id]/page.tsx` first, then replace its content with:

```tsx
// app/(dashboard)/dashboard/resumes/[id]/page.tsx
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { EditorShell } from '@/components/editor/EditorShell'
import { EditorErrorBoundary } from '@/components/editor/EditorErrorBoundary'
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
    <EditorErrorBoundary>
      <EditorShell
        resumeId={String(resume._id)}
        title={resume.title}
        data={(resume.data ?? {}) as ResumeData}
        meta={resume.meta as ResumeMeta}
      />
    </EditorErrorBoundary>
  )
}
```

- [ ] **Step 6: Run full test suite**

```bash
npm run test:run
```

Expected: all tests PASS (new 3 + no regressions).

- [ ] **Step 7: Verify next build succeeds**

```bash
npx next build 2>&1 | tail -15
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 8: Commit**

```bash
git add components/editor/EditorErrorBoundary.tsx "components/editor/EditorErrorBoundary.test.tsx" "app/(dashboard)/dashboard/resumes/[id]/page.tsx"
git commit -m "feat: add error boundary to editor with try-again recovery"
```
