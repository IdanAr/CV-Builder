# Sprint 1 — Trust & UX Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate silent failures via a global toast system, make delete recoverable, remove dead demo/stub UI, redesign the dashboard empty state, and fix the ATS keyword matcher's substring false-positives.

**Architecture:** A Zustand-backed toast store (`lib/stores/toast.store.ts`) with a `<Toaster />` portal mounted in the root layout; all async user actions route errors/success through it. Delete becomes optimistic-hide + undo toast. ATS matching moves from `String.includes` to boundary-aware regex, and placement scoring scans the two most recent jobs.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind (indigo glassmorphic utility classes), Zustand, Vitest + Testing Library.

## Global Constraints

- All work happens inside `cv-builder/` (the Next.js app root). All paths below are relative to `cv-builder/`.
- Work on branch `feat/sprint1-trust-ux` (create from `main` before Task 1).
- Run tests with `npx vitest run <path>` from `cv-builder/`. Full suite: `npx vitest run`. Type check: `npx tsc --noEmit`.
- Match the existing visual language: indigo palette, `rounded-xl`, `border-indigo-100/200`, `bg-white/xx backdrop-blur` glassmorphism.
- No new dependencies. Zustand, Testing Library, and vitest are already installed.
- Every user-facing async failure must surface in the UI — `console.error`-only handling is forbidden in code this plan touches.
- Commit after every task with a conventional-commit message ending in:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Toast store + `<Toaster />` component

**Files:**
- Create: `lib/stores/toast.store.ts`
- Create: `lib/stores/toast.store.test.ts`
- Create: `components/ui/Toaster.tsx`
- Create: `components/ui/Toaster.test.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: `toast.success(message: string): number`, `toast.error(message: string): number`, `toast.info(message: string): number`, `toast.withAction(message: string, actionLabel: string, onAction: () => void, duration?: number): number` (all return the toast id), `useToastStore` with `{ toasts: Toast[]; show(...): number; dismiss(id: number): void }`, and `<Toaster />` (client component, no props). Later tasks import `{ toast }` from `@/lib/stores/toast.store`.

- [ ] **Step 1: Write failing store tests**

```ts
// lib/stores/toast.store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useToastStore, toast } from './toast.store'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('toast store', () => {
  it('adds a success toast with default duration', () => {
    const id = toast.success('Saved')
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({ id, message: 'Saved', variant: 'success', duration: 5000 })
  })

  it('adds an error toast', () => {
    toast.error('Failed')
    expect(useToastStore.getState().toasts[0].variant).toBe('error')
  })

  it('dismiss removes only the targeted toast', () => {
    const a = toast.info('A')
    const b = toast.info('B')
    useToastStore.getState().dismiss(a)
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].id).toBe(b)
  })

  it('withAction stores the action label and callback with custom duration', () => {
    let called = false
    toast.withAction('Deleted "My CV"', 'Undo', () => { called = true }, 6000)
    const t = useToastStore.getState().toasts[0]
    expect(t.actionLabel).toBe('Undo')
    expect(t.duration).toBe(6000)
    t.onAction!()
    expect(called).toBe(true)
  })

  it('assigns unique incrementing ids', () => {
    const a = toast.info('A')
    const b = toast.info('B')
    expect(b).not.toBe(a)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/stores/toast.store.test.ts`
Expected: FAIL — cannot resolve `./toast.store`.

- [ ] **Step 3: Implement the store**

```ts
// lib/stores/toast.store.ts
import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
  duration: number
  actionLabel?: string
  onAction?: () => void
}

interface ToastStore {
  toasts: Toast[]
  show: (t: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (t) => {
    const id = nextId++
    const entry: Toast = { duration: 5000, ...t, id }
    set((s) => ({ toasts: [...s.toasts, entry] }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export const toast = {
  success: (message: string) => useToastStore.getState().show({ message, variant: 'success' }),
  error: (message: string) => useToastStore.getState().show({ message, variant: 'error' }),
  info: (message: string) => useToastStore.getState().show({ message, variant: 'info' }),
  withAction: (
    message: string,
    actionLabel: string,
    onAction: () => void,
    duration = 6000
  ) => useToastStore.getState().show({ message, variant: 'info', actionLabel, onAction, duration }),
}
```

- [ ] **Step 4: Run store tests — expect PASS**

Run: `npx vitest run lib/stores/toast.store.test.ts`

- [ ] **Step 5: Write failing Toaster component tests**

```tsx
// components/ui/Toaster.test.tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Toaster } from './Toaster'
import { useToastStore, toast } from '@/lib/stores/toast.store'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('Toaster', () => {
  it('renders toasts inside an aria-live region', () => {
    render(<Toaster />)
    act(() => { toast.success('Saved') })
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('auto-dismisses after the toast duration', () => {
    render(<Toaster />)
    act(() => { toast.success('Saved') })
    act(() => { vi.advanceTimersByTime(5100) })
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('invokes onAction and dismisses when the action button is clicked', () => {
    render(<Toaster />)
    const onAction = vi.fn()
    act(() => { toast.withAction('Deleted "My CV"', 'Undo', onAction) })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.queryByText('Deleted "My CV"')).not.toBeInTheDocument()
  })

  it('dismisses when the close button is clicked', () => {
    render(<Toaster />)
    act(() => { toast.error('Failed') })
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByText('Failed')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run — expect FAIL (no Toaster)**

- [ ] **Step 7: Implement `<Toaster />`**

```tsx
// components/ui/Toaster.tsx
'use client'

import { useEffect, useRef } from 'react'
import { useToastStore, type Toast } from '@/lib/stores/toast.store'

const VARIANT_STYLES: Record<Toast['variant'], string> = {
  success: 'border-green-200 bg-green-50/95 text-green-800',
  error: 'border-red-200 bg-red-50/95 text-red-800',
  info: 'border-indigo-200 bg-white/95 text-indigo-900',
}

function ToastItem({ toast: t }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    timerRef.current = window.setTimeout(() => dismiss(t.id), t.duration)
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current) }
  }, [t.id, t.duration, dismiss])

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-xl ${VARIANT_STYLES[t.variant]}`}
    >
      <p className="text-sm font-medium">{t.message}</p>
      {t.actionLabel && (
        <button
          onClick={() => { t.onAction?.(); dismiss(t.id) }}
          className="rounded-md border border-current px-2 py-1 text-xs font-semibold hover:opacity-80"
        >
          {t.actionLabel}
        </button>
      )}
      <button
        aria-label="Dismiss notification"
        onClick={() => dismiss(t.id)}
        className="text-xs opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Run Toaster tests — expect PASS**

Run: `npx vitest run components/ui/Toaster.test.tsx`

- [ ] **Step 9: Mount in root layout**

Modify `app/layout.tsx` to:

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/Toaster'

export const metadata: Metadata = {
  title: 'CV Builder',
  description: 'AI-powered CV builder with ATS optimization',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

- [ ] **Step 10: Full check + commit**

Run: `npx vitest run && npx tsc --noEmit` — expect all green.

```bash
git add lib/stores/toast.store.ts lib/stores/toast.store.test.ts components/ui/Toaster.tsx components/ui/Toaster.test.tsx app/layout.tsx
git commit -m "feat: global toast system with action support and aria-live region"
```

---

### Task 2: Route silent failures through toasts

**Files:**
- Modify: `components/NewResumeButton.tsx` (catch block, line 21-24)
- Modify: `components/ResumeCard.tsx` (`handleDuplicate` line 72-83, `handleDownload` line 85-100)
- Modify: `components/editor/EditorShell.tsx` (`handleExport` catch, line 142-144)
- Test: `components/ResumeCard.test.tsx` (extend existing), `components/NewResumeButton.test.tsx` (create)

**Interfaces:**
- Consumes: `toast` from `@/lib/stores/toast.store` (Task 1).
- Produces: nothing new — behavior change only.

- [ ] **Step 1: Write failing tests**

Add to `components/ResumeCard.test.tsx` (follow the file's existing render/mocking conventions; reset `useToastStore.setState({ toasts: [] })` in `beforeEach`):

```tsx
it('shows an error toast when duplicate fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
  render(<ResumeCard resume={baseResume} />)
  fireEvent.click(screen.getByTitle('Duplicate'))
  await waitFor(() => {
    expect(useToastStore.getState().toasts.some(t => t.variant === 'error')).toBe(true)
  })
})

it('shows an error toast when JSON download fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
  render(<ResumeCard resume={baseResume} />)
  fireEvent.click(screen.getByTitle('Download as JSON'))
  await waitFor(() => {
    expect(useToastStore.getState().toasts.some(t => t.variant === 'error')).toBe(true)
  })
})
```

Create `components/NewResumeButton.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewResumeButton from './NewResumeButton'
import { useToastStore } from '@/lib/stores/toast.store'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('NewResumeButton', () => {
  it('shows an error toast and re-enables the button when create fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
    render(<NewResumeButton />)
    fireEvent.click(screen.getByRole('button', { name: '+ New CV' }))
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(t => t.variant === 'error')).toBe(true)
    })
    expect(screen.getByRole('button', { name: '+ New CV' })).toBeEnabled()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run components/NewResumeButton.test.tsx components/ResumeCard.test.tsx`

- [ ] **Step 3: Wire toasts in**

`components/NewResumeButton.tsx` — import `toast`, change catch:

```ts
} catch (err) {
  console.error(err)
  toast.error('Could not create a new CV. Please try again.')
  setLoading(false)
}
```

`components/ResumeCard.tsx` — import `toast`, change catches:

```ts
// handleDuplicate catch:
} catch (err) {
  console.error(err)
  toast.error(`Could not duplicate "${resume.title}". Please try again.`)
} finally {
```

```ts
// handleDownload catch:
} catch (err) {
  console.error(err)
  toast.error(`Could not download "${resume.title}" as JSON. Please try again.`)
}
```

Also add a success toast after duplicate succeeds (before `router.refresh()`):

```ts
toast.success(`Duplicated "${resume.title}"`)
```

`components/editor/EditorShell.tsx` — import `toast` from `@/lib/stores/resume-editor.store`-adjacent path `@/lib/stores/toast.store`, replace the `alert` catch in `handleExport`:

```ts
} catch {
  toast.error(`${format.toUpperCase()} export failed. Please try again.`)
}
```

and add after the download click succeeds (after `URL.revokeObjectURL(url)`):

```ts
toast.success(`${format.toUpperCase()} exported`)
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run components/NewResumeButton.test.tsx components/ResumeCard.test.tsx components/editor`

- [ ] **Step 5: Commit**

```bash
git add components/NewResumeButton.tsx components/NewResumeButton.test.tsx components/ResumeCard.tsx components/ResumeCard.test.tsx components/editor/EditorShell.tsx
git commit -m "feat: surface create/duplicate/download/export failures as toasts (no more silent errors or alert())"
```

---

### Task 3: Delete with undo (optimistic hide + undo toast)

**Files:**
- Modify: `components/ResumeCard.tsx` (replace the two-step `confirmingDelete` flow, lines 49-70 and 140-166)
- Test: `components/ResumeCard.test.tsx`

**Interfaces:**
- Consumes: `toast.withAction`, `useToastStore` (Task 1).
- Produces: nothing new — behavior change only. The `confirmingDelete` state and "Sure? / Yes, delete / Cancel" UI are removed.

Behavior spec: clicking Delete immediately hides the card (renders `null`) and shows a 6-second toast `Deleted "<title>"` with an **Undo** action. Undo restores the card without any network call. If the toast expires (or the component unmounts while a delete is pending), the `DELETE /api/resumes/[id]` request fires. If the request fails, the card is restored and an error toast shows.

- [ ] **Step 1: Write failing tests**

Replace the existing delete-flow tests in `components/ResumeCard.test.tsx` with (use fake timers; keep the file's existing mocks/`baseResume` fixture):

```tsx
it('hides the card and shows an undo toast on delete', () => {
  render(<ResumeCard resume={baseResume} />)
  fireEvent.click(screen.getByTitle('Delete'))
  expect(screen.queryByText(baseResume.title)).not.toBeInTheDocument()
  const t = useToastStore.getState().toasts[0]
  expect(t.message).toBe(`Deleted "${baseResume.title}"`)
  expect(t.actionLabel).toBe('Undo')
})

it('restores the card when undo is invoked, without calling DELETE', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  render(<ResumeCard resume={baseResume} />)
  fireEvent.click(screen.getByTitle('Delete'))
  act(() => { useToastStore.getState().toasts[0].onAction!() })
  expect(screen.getByText(baseResume.title)).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('fires DELETE after the undo window expires', async () => {
  vi.useFakeTimers()
  const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
  vi.stubGlobal('fetch', fetchMock)
  render(<ResumeCard resume={baseResume} />)
  fireEvent.click(screen.getByTitle('Delete'))
  await act(async () => { vi.advanceTimersByTime(6100) })
  expect(fetchMock).toHaveBeenCalledWith(`/api/resumes/${baseResume._id}`, { method: 'DELETE' })
  vi.useRealTimers()
})

it('restores the card and shows an error toast when DELETE fails', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
  render(<ResumeCard resume={baseResume} />)
  fireEvent.click(screen.getByTitle('Delete'))
  await act(async () => { vi.advanceTimersByTime(6100) })
  await act(async () => { await vi.runAllTimersAsync() })
  expect(screen.getByText(baseResume.title)).toBeInTheDocument()
  expect(useToastStore.getState().toasts.some(t => t.variant === 'error')).toBe(true)
  vi.useRealTimers()
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

In `components/ResumeCard.tsx`: delete `confirmingDelete`/`deleting` state and the old `handleDelete`; add:

```tsx
const [pendingDelete, setPendingDelete] = useState(false)
const deleteTimerRef = useRef<number | null>(null)
const undoToastIdRef = useRef<number | null>(null)

async function commitDelete() {
  try {
    const res = await fetch(`/api/resumes/${resume._id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Delete failed')
    router.refresh()
  } catch (err) {
    console.error(err)
    setPendingDelete(false)
    toast.error(`Could not delete "${resume.title}". It has been restored.`)
  }
}

function handleDelete() {
  setPendingDelete(true)
  undoToastIdRef.current = toast.withAction(
    `Deleted "${resume.title}"`,
    'Undo',
    () => {
      if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current)
      deleteTimerRef.current = null
      setPendingDelete(false)
    }
  )
  deleteTimerRef.current = window.setTimeout(() => {
    deleteTimerRef.current = null
    if (undoToastIdRef.current !== null) useToastStore.getState().dismiss(undoToastIdRef.current)
    void commitDelete()
  }, 6000)
}
```

Add unmount flush (delete must not be lost if the user navigates away mid-window):

```tsx
useEffect(() => {
  return () => {
    if (deleteTimerRef.current) {
      window.clearTimeout(deleteTimerRef.current)
      void fetch(`/api/resumes/${resume._id}`, { method: 'DELETE' })
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

At the top of the returned JSX:

```tsx
if (pendingDelete) return null
```

Replace the old conditional delete UI (lines 140-166) with a single button:

```tsx
<button
  onClick={handleDelete}
  aria-label={`Delete ${resume.title}`}
  className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
  title="Delete"
>
  ✕
</button>
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run components/ResumeCard.test.tsx`

- [ ] **Step 5: Full check + commit**

Run: `npx vitest run && npx tsc --noEmit`

```bash
git add components/ResumeCard.tsx components/ResumeCard.test.tsx
git commit -m "feat: recoverable delete - optimistic hide with 6s undo toast replaces two-step confirm"
```

---

### Task 4: Remove demo boilerplate and Settings stub

**Files:**
- Delete: `app/demo/page.tsx`
- Create: `components/ui/Plasma.tsx` (extracted verbatim from the hero file)
- Modify: `components/ui/PlasmaBackground.tsx` (line 4 import)
- Delete: `components/ui/light-saas-hero-section.tsx`
- Modify: `components/ui/UserProfileButton.tsx` (remove Settings menu item + modal + state)
- Test: `components/UserProfileButton.test.tsx` (update existing)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `Plasma` named export from `@/components/ui/Plasma` (same props/signature as the current export in `light-saas-hero-section.tsx`).

Context: `components/ui/PlasmaBackground.tsx` imports `Plasma` from `./light-saas-hero-section` — the only live dependency on the boilerplate file. The `HeroSection` export and `/demo` route are unused Mysh.ai leftovers. `UserProfileButton.tsx` ships a dead "Settings" menu item opening a "Settings content coming soon" modal (state at line 58, menu item ~lines 192-209, modal lines 266-297).

- [ ] **Step 1: Extract Plasma**

Move the `Plasma` component **and every helper/import it uses** (ogl imports, shader strings, hooks) from `components/ui/light-saas-hero-section.tsx` into a new `components/ui/Plasma.tsx`, verbatim — no rewrites. Keep the same export name and prop types. Do NOT move `HeroSection` or anything only it uses.

- [ ] **Step 2: Update the consumer and delete dead files**

In `components/ui/PlasmaBackground.tsx` change line 4 to:

```ts
import { Plasma } from './Plasma'
```

Then:

```bash
git rm app/demo/page.tsx components/ui/light-saas-hero-section.tsx
```

- [ ] **Step 3: Verify nothing else referenced the deleted files**

Run: `grep -rn "light-saas-hero\|/demo" app components lib --include="*.ts*"`
Expected: no matches.

- [ ] **Step 4: Remove the Settings stub from UserProfileButton**

In `components/ui/UserProfileButton.tsx`:
- Delete `const [settingsOpen, setSettingsOpen] = useState(false)` (line 58).
- Remove `settingsOpen` from the Escape-key effect condition and the `setSettingsOpen(false)` call (lines 113-122) and the focus effect that depends on `settingsOpen` (lines 125-129) — keep the `termsOpen` handling intact.
- Delete the "Settings" menu item button (the block around lines 192-209 that calls `setSettingsOpen(true)`).
- Delete the entire Settings modal portal block (lines 266-297, the `{mounted && settingsOpen && createPortal(...)}` expression).
- Update `components/UserProfileButton.test.tsx`: remove/adjust any test that clicks "Settings" or asserts the settings dialog; keep Terms tests.

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run components/UserProfileButton.test.tsx && npx tsc --noEmit && npx vitest run`
Expected: all pass, no type errors.

```bash
git add -A
git commit -m "chore: remove Mysh.ai demo boilerplate and Settings stub; extract Plasma background"
```

---

### Task 5: Dashboard empty-state redesign

**Files:**
- Modify: `components/NewResumeButton.tsx` (add `variant` prop)
- Modify: `components/UploadCVButton.tsx` (add `variant` prop to the trigger button only)
- Create: `components/EmptyDashboardState.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx` (lines 35-39, replace empty-state block)
- Test: `components/EmptyDashboardState.test.tsx`

**Interfaces:**
- Consumes: `NewResumeButton`, `UploadCVButton` (existing), toast system indirectly.
- Produces: `<EmptyDashboardState />` (no props); `NewResumeButtonProps { variant?: 'navbar' | 'hero' }` and the same optional prop on `UploadCVButton`. Default `'navbar'` preserves current styling exactly.

Spec: when a user has zero CVs, the empty panel itself must present the two primary actions as large cards — "Upload your existing CV" (recommended path: instant extraction + ATS score) and "Start from scratch" — instead of pointing at navbar buttons.

- [ ] **Step 1: Write failing test**

```tsx
// components/EmptyDashboardState.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyDashboardState } from './EmptyDashboardState'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('EmptyDashboardState', () => {
  it('renders both primary actions as buttons', () => {
    render(<EmptyDashboardState />)
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new cv|start/i })).toBeInTheDocument()
  })

  it('explains the value of each path', () => {
    render(<EmptyDashboardState />)
    expect(screen.getByText(/ATS/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Add `variant` prop to both buttons**

`components/NewResumeButton.tsx`:

```tsx
interface NewResumeButtonProps {
  variant?: 'navbar' | 'hero'
}

export default function NewResumeButton({ variant = 'navbar' }: NewResumeButtonProps) {
  // ... existing state/handler unchanged ...
  const className =
    variant === 'hero'
      ? 'w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50'
      : 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50'
  return (
    <button onClick={handleCreate} disabled={loading} className={className}>
      {loading ? 'Creating…' : '+ New CV'}
    </button>
  )
}
```

`components/UploadCVButton.tsx`: add the same `variant?: 'navbar' | 'hero'` prop and apply an analogous full-width `hero` className to the **trigger button only** (the button that opens the upload flow — read the file and keep all upload-phase logic untouched). Hero trigger className:

```
w-full rounded-lg border border-indigo-300 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-50
```

- [ ] **Step 4: Implement `EmptyDashboardState`**

```tsx
// components/EmptyDashboardState.tsx
'use client'

import NewResumeButton from './NewResumeButton'
import UploadCVButton from './UploadCVButton'

export function EmptyDashboardState() {
  return (
    <div className="rounded-xl border border-indigo-100 bg-white/50 py-12 px-6 text-center backdrop-blur-sm">
      <h2 className="text-lg font-semibold text-indigo-900">Let&apos;s build your first CV</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-indigo-400">
        Import your existing CV or start fresh — either way you get a live preview and an ATS score.
      </p>
      <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-indigo-200 bg-white/70 p-6 text-left shadow-sm">
          <span className="text-2xl" aria-hidden="true">📄</span>
          <h3 className="mt-3 font-semibold text-indigo-900">Upload your existing CV</h3>
          <p className="mb-4 mt-1 flex-1 text-sm text-indigo-400">
            PDF or Word. We extract everything automatically and show you your ATS score.
          </p>
          <UploadCVButton variant="hero" />
        </div>
        <div className="flex flex-col rounded-xl border border-indigo-100 bg-white/70 p-6 text-left shadow-sm">
          <span className="text-2xl" aria-hidden="true">✨</span>
          <h3 className="mt-3 font-semibold text-indigo-900">Start from scratch</h3>
          <p className="mb-4 mt-1 flex-1 text-sm text-indigo-400">
            A guided editor with 5 ATS-safe templates and live PDF-accurate preview.
          </p>
          <NewResumeButton variant="hero" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire into the dashboard**

In `app/(dashboard)/dashboard/page.tsx`, import `{ EmptyDashboardState } from '@/components/EmptyDashboardState'` and replace the empty-state block (lines 35-39) with:

```tsx
{resumes.length === 0 ? (
  <EmptyDashboardState />
) : (
```

- [ ] **Step 6: Run — expect PASS, then full check + commit**

Run: `npx vitest run components/EmptyDashboardState.test.tsx && npx vitest run && npx tsc --noEmit`

```bash
git add components/EmptyDashboardState.tsx components/EmptyDashboardState.test.tsx components/NewResumeButton.tsx components/UploadCVButton.tsx "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: dashboard empty state with upload-first and start-fresh action cards"
```

---

### Task 6: ATS matcher fix — boundary-aware matching + multi-job placement

**Files:**
- Modify: `lib/ats/keywords.ts` (`keywordOverlap`, lines 26-38)
- Modify: `lib/ats/scorer.ts` (`flattenHighValueText`, lines 55-67)
- Test: `lib/ats/__tests__/keywords.test.ts`, `lib/ats/__tests__/scorer.test.ts` (extend existing)

**Interfaces:**
- Consumes: nothing from earlier tasks (independent).
- Produces: `matchesKeyword(text: string, keyword: string): boolean` exported from `lib/ats/keywords.ts`. `keywordOverlap` signature unchanged. `flattenHighValueText` now scans the two most recent work entries.

Defect being fixed: `keywordOverlap` uses `lower.includes(kw)`, so "java" matches "javascript" and "react" matches "reactive" — inflated scores. And placement scoring reads only `work[0]`.

- [ ] **Step 1: Write failing keyword tests**

Add to `lib/ats/__tests__/keywords.test.ts`:

```ts
import { matchesKeyword } from '../keywords'

describe('matchesKeyword', () => {
  it('does not match a keyword embedded in a longer word', () => {
    expect(matchesKeyword('senior javascript developer', 'java')).toBe(false)
    expect(matchesKeyword('built reactive pipelines', 'react')).toBe(false)
  })

  it('matches exact whole words case-insensitively', () => {
    expect(matchesKeyword('Senior Java developer', 'java')).toBe(true)
    expect(matchesKeyword('React and Node.js', 'react')).toBe(true)
  })

  it('handles keywords with regex-special characters', () => {
    expect(matchesKeyword('expert in c++ and c#', 'c++')).toBe(true)
    expect(matchesKeyword('worked with node.js daily', 'node.js')).toBe(true)
    expect(matchesKeyword('used nodexjs once', 'node.js')).toBe(false)
  })

  it('matches at string boundaries and around punctuation', () => {
    expect(matchesKeyword('python', 'python')).toBe(true)
    expect(matchesKeyword('skills: python, sql.', 'python')).toBe(true)
  })
})

describe('keywordOverlap word boundaries', () => {
  it('does not count substring-only matches', () => {
    const { matched, missing } = keywordOverlap('senior javascript developer', ['java', 'javascript'])
    expect(matched).toEqual(['javascript'])
    expect(missing).toEqual(['java'])
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run lib/ats/__tests__/keywords.test.ts`

- [ ] **Step 3: Implement boundary-aware matching**

In `lib/ats/keywords.ts`, replace `keywordOverlap` with:

```ts
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function matchesKeyword(text: string, keyword: string): boolean {
  const pattern = new RegExp(
    `(?<![a-z0-9])${escapeRegExp(keyword.toLowerCase())}(?![a-z0-9])`,
    'i'
  )
  return pattern.test(text)
}

export function keywordOverlap(
  resumeText: string,
  jdKeywords: string[]
): { matched: string[]; missing: string[] } {
  const lower = resumeText.toLowerCase()
  const matched: string[] = []
  const missing: string[] = []
  for (const kw of jdKeywords) {
    if (matchesKeyword(lower, kw)) matched.push(kw)
    else missing.push(kw)
  }
  return { matched, missing }
}
```

- [ ] **Step 4: Run keyword tests — expect PASS. Then write failing scorer test**

Add to `lib/ats/__tests__/scorer.test.ts` (reuse the file's existing fixture-building conventions):

```ts
it('placement score counts keywords found in the second most recent job', () => {
  const data = {
    basics: { name: 'A', email: 'a@b.c' },
    work: [
      { name: 'Acme', position: 'Manager', highlights: ['Led roadmap planning'] },
      { name: 'Beta', position: 'Engineer', highlights: ['Built kubernetes clusters'] },
    ],
  } as ResumeData
  const result = scoreResume(data, 'kubernetes engineer')
  expect(result.breakdown.keywordPlacement).toBeGreaterThan(0)
})

it('placement score ignores jobs older than the two most recent', () => {
  const data = {
    basics: { name: 'A', email: 'a@b.c' },
    work: [
      { name: 'Acme', position: 'Manager', highlights: ['Led roadmap planning'] },
      { name: 'Beta', position: 'Analyst', highlights: ['Wrote reports'] },
      { name: 'Gamma', position: 'Engineer', highlights: ['Built kubernetes clusters'] },
    ],
  } as ResumeData
  const result = scoreResume(data, 'kubernetes engineer')
  expect(result.breakdown.keywordPlacement).toBe(0)
})
```

- [ ] **Step 5: Implement multi-job placement**

In `lib/ats/scorer.ts`, replace `flattenHighValueText` (lines 55-67) with:

```ts
function flattenHighValueText(data: ResumeData): string {
  const parts: string[] = []
  const b = data.basics ?? {}
  if (b.label) parts.push(b.label)
  if (b.summary) parts.push(b.summary)
  for (const job of (data.work ?? []).slice(0, 2)) {
    if (job.position) parts.push(job.position)
    if (job.name) parts.push(job.name)
    parts.push(...(job.highlights ?? []))
  }
  return parts.join(' ')
}
```

- [ ] **Step 6: Run all ATS tests + dependent suites — expect PASS**

Run: `npx vitest run lib/ats app/api/resumes` — the ats-score route tests and ats-fix tests consume these functions; if any existing assertion relied on substring matching (e.g. expected "java" to match "javascript"), update that assertion to the corrected behavior and note it in the commit body.

- [ ] **Step 7: Full check + commit**

Run: `npx vitest run && npx tsc --noEmit`

```bash
git add lib/ats
git commit -m "fix: ATS keyword matching uses word boundaries; placement scans two most recent jobs"
```

---

## Final verification (after Task 6)

- [ ] `npx vitest run` — full suite green
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — production build succeeds (catches deleted-file import breakage)
- [ ] Manual smoke: dashboard empty state renders both cards; delete → undo restores; export failure path shows toast (can be forced by killing the dev server mid-export)
