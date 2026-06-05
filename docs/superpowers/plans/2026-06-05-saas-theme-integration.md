# SaaS Theme Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the indigo/purple light SaaS visual theme (plasma WebGL background, frosted-glass panels, indigo palette) to every page and component in the CV Builder app.

**Architecture:** Two new shared components — `PlasmaBackground` (client, renders animated WebGL canvas behind page content) and `AppNavbar` (server, full-width frosted-glass bar with logo + injected action buttons) — are consumed by all layouts and page shells. All UI components are restyled in-place using Tailwind; no behavioral or data-layer code changes.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, TypeScript, `ogl` (already installed for WebGL plasma)

---

## File Map

| Action | File |
|--------|------|
| Create | `cv-builder/components/ui/PlasmaBackground.tsx` |
| Create | `cv-builder/components/ui/AppNavbar.tsx` |
| Modify | `cv-builder/app/globals.css` |
| Modify | `cv-builder/app/layout.tsx` |
| Modify | `cv-builder/app/(auth)/signin/page.tsx` |
| Modify | `cv-builder/app/(dashboard)/layout.tsx` |
| Modify | `cv-builder/app/(dashboard)/dashboard/page.tsx` |
| Modify | `cv-builder/components/ResumeCard.tsx` |
| Modify | `cv-builder/components/NewResumeButton.tsx` |
| Modify | `cv-builder/components/UploadCVButton.tsx` |
| Modify | `cv-builder/components/editor/EditorShell.tsx` |
| Modify | `cv-builder/components/editor/AccordionSection.tsx` |
| Modify | `cv-builder/components/editor/EditTab.tsx` |
| Modify | `cv-builder/components/editor/DesignPanel.tsx` |
| Modify | `cv-builder/components/editor/PreviewTab.tsx` |
| Modify | `cv-builder/components/ats/AtsScorePanel.tsx` |
| Modify | `cv-builder/components/ai/AiSuggestButton.tsx` |
| Modify | `cv-builder/components/editor/forms/BasicsForm.tsx` |
| Modify | `cv-builder/components/editor/forms/WorkForm.tsx` |
| Modify | `cv-builder/components/editor/forms/EducationForm.tsx` |
| Modify | `cv-builder/components/editor/forms/SkillsForm.tsx` |
| Modify | `cv-builder/components/editor/forms/CertificatesForm.tsx` |
| Modify | `cv-builder/components/editor/forms/ProjectsForm.tsx` |
| Modify | `cv-builder/components/editor/forms/LanguagesForm.tsx` |
| Modify | `cv-builder/components/editor/forms/VolunteerForm.tsx` |
| Modify | `cv-builder/components/editor/forms/AwardsForm.tsx` |
| Modify | `cv-builder/components/editor/forms/PublicationsForm.tsx` |
| Modify | `cv-builder/components/editor/forms/InterestsForm.tsx` |

---

### Task 1: Create `PlasmaBackground` component

**Files:**
- Create: `cv-builder/components/ui/PlasmaBackground.tsx`

- [ ] **Step 1: Create the file**

```tsx
// cv-builder/components/ui/PlasmaBackground.tsx
'use client'

import { Plasma } from './light-saas-hero-section'

interface PlasmaBackgroundProps {
  children: React.ReactNode
  opacity?: number
}

export function PlasmaBackground({ children, opacity = 0.15 }: PlasmaBackgroundProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-white">
      <div className="absolute inset-0 z-0">
        <Plasma
          color="#4f46e5"
          speed={0.5}
          direction="forward"
          scale={1.2}
          opacity={opacity}
          mouseInteractive={true}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-white/60" />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd cv-builder && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `PlasmaBackground.tsx`

- [ ] **Step 3: Commit**

```bash
git add cv-builder/components/ui/PlasmaBackground.tsx
git commit -m "feat(theme): add PlasmaBackground shared component"
```

---

### Task 2: Create `AppNavbar` component

**Files:**
- Create: `cv-builder/components/ui/AppNavbar.tsx`

- [ ] **Step 1: Create the file**

```tsx
// cv-builder/components/ui/AppNavbar.tsx
import type { ReactNode } from 'react'

interface AppNavbarProps {
  actions?: ReactNode
}

export function AppNavbar({ actions }: AppNavbarProps) {
  return (
    <nav className="w-full bg-white/55 backdrop-blur-xl border-b border-white/30 shadow-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 shrink-0">
              <defs>
                <linearGradient id="ng1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#8B5CF6', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#6366F1', stopOpacity: 1 }} />
                </linearGradient>
                <linearGradient id="ng2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#A78BFA', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#8B5CF6', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <polygon points="50,25 65,35 65,55 50,65 35,55 35,35" fill="url(#ng1)" />
              <circle cx="30" cy="30" r="4" fill="url(#ng2)" />
              <circle cx="70" cy="30" r="4" fill="url(#ng2)" />
              <circle cx="20" cy="50" r="4" fill="url(#ng2)" />
              <circle cx="80" cy="50" r="4" fill="url(#ng2)" />
              <circle cx="30" cy="70" r="4" fill="url(#ng2)" />
              <circle cx="70" cy="70" r="4" fill="url(#ng2)" />
              <line x1="30" y1="30" x2="42" y2="38" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="70" y1="30" x2="58" y2="38" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="20" y1="50" x2="35" y2="45" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="80" y1="50" x2="65" y2="45" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="30" y1="70" x2="42" y2="58" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="70" y1="70" x2="58" y2="58" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <path d="M 42 42 L 48 42 L 50 38 L 52 42 L 58 42 L 54 48 L 56 54 L 50 50 L 44 54 L 46 48 Z"
                fill="#FFFFFF" opacity="0.9" />
            </svg>
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              CV Builder
            </span>
          </div>

          {/* Right-side actions */}
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd cv-builder && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add cv-builder/components/ui/AppNavbar.tsx
git commit -m "feat(theme): add AppNavbar shared component"
```

---

### Task 3: Update globals.css and root layout

**Files:**
- Modify: `cv-builder/app/globals.css`
- Modify: `cv-builder/app/layout.tsx`

- [ ] **Step 1: Update `globals.css`**

Replace the entire file with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #f5f3ff;
  --foreground: #1e1b4b;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: Inter, system-ui, Arial, Helvetica, sans-serif;
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

- [ ] **Step 2: Update `app/layout.tsx`**

Replace the entire file with:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CV Builder',
  description: 'AI-powered CV builder with ATS optimization',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Run tests to confirm no breakage**

```bash
cd cv-builder && npm run test:run 2>&1 | tail -10
```

Expected: all tests pass (test count unchanged)

- [ ] **Step 4: Commit**

```bash
git add cv-builder/app/globals.css cv-builder/app/layout.tsx
git commit -m "feat(theme): update globals and root layout for SaaS theme"
```

---

### Task 4: Restyle sign-in page

**Files:**
- Modify: `cv-builder/app/(auth)/signin/page.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { signIn } from '@/lib/auth'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PlasmaBackground } from '@/components/ui/PlasmaBackground'

export default async function SignInPage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <PlasmaBackground>
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/30 bg-white/70 backdrop-blur-xl p-8 shadow-xl">
          {/* Logo */}
          <div className="mb-6 flex flex-col items-center gap-2">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="h-12 w-12">
              <defs>
                <linearGradient id="sg1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#8B5CF6', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#6366F1', stopOpacity: 1 }} />
                </linearGradient>
                <linearGradient id="sg2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#A78BFA', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#8B5CF6', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <polygon points="50,25 65,35 65,55 50,65 35,55 35,35" fill="url(#sg1)" />
              <circle cx="30" cy="30" r="4" fill="url(#sg2)" />
              <circle cx="70" cy="30" r="4" fill="url(#sg2)" />
              <circle cx="20" cy="50" r="4" fill="url(#sg2)" />
              <circle cx="80" cy="50" r="4" fill="url(#sg2)" />
              <circle cx="30" cy="70" r="4" fill="url(#sg2)" />
              <circle cx="70" cy="70" r="4" fill="url(#sg2)" />
              <line x1="30" y1="30" x2="42" y2="38" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="70" y1="30" x2="58" y2="38" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="20" y1="50" x2="35" y2="45" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="80" y1="50" x2="65" y2="45" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="30" y1="70" x2="42" y2="58" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="70" y1="70" x2="58" y2="58" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <path d="M 42 42 L 48 42 L 50 38 L 52 42 L 58 42 L 54 48 L 56 54 L 50 50 L 44 54 L 46 48 Z"
                fill="#FFFFFF" opacity="0.9" />
            </svg>
            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              CV Builder
            </h1>
            <p className="text-sm text-indigo-400">Sign in to continue</p>
          </div>

          <div className="flex flex-col gap-3">
            <form
              action={async () => {
                'use server'
                await signIn('google', { redirectTo: '/dashboard' })
              }}
            >
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-indigo-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-white"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </form>

            <form
              action={async () => {
                'use server'
                await signIn('github', { redirectTo: '/dashboard' })
              }}
            >
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-gray-700"
              >
                <svg className="h-5 w-5 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
                Continue with GitHub
              </button>
            </form>
          </div>
        </div>
      </main>
    </PlasmaBackground>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
cd cv-builder && npm run test:run 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add cv-builder/app/'(auth)'/signin/page.tsx
git commit -m "feat(theme): restyle sign-in page with plasma background and glass card"
```

---

### Task 5: Update dashboard layout

**Files:**
- Modify: `cv-builder/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { PlasmaBackground } from '@/components/ui/PlasmaBackground'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlasmaBackground>
      <main className="mx-auto max-w-4xl px-4 py-8">
        {children}
      </main>
    </PlasmaBackground>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
cd cv-builder && npm run test:run 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add cv-builder/app/'(dashboard)'/layout.tsx
git commit -m "feat(theme): add plasma background to dashboard layout"
```

---

### Task 6: Restyle dashboard page

**Files:**
- Modify: `cv-builder/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listResumes } from '@/lib/api/resumes'
import ResumeCard from '@/components/ResumeCard'
import NewResumeButton from '@/components/NewResumeButton'
import UploadCVButton from '@/components/UploadCVButton'
import { AppNavbar } from '@/components/ui/AppNavbar'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const resumes = await listResumes(session.user.id)

  return (
    <>
      <AppNavbar
        actions={
          <>
            <UploadCVButton />
            <NewResumeButton />
          </>
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-indigo-900">My CVs</h1>
        </div>

        {resumes.length === 0 ? (
          <div className="rounded-xl border border-indigo-100 bg-white/50 backdrop-blur-sm py-16 text-center">
            <p className="text-sm text-indigo-400">No CVs yet.</p>
            <p className="mt-1 text-sm text-indigo-300">Click &quot;+ New CV&quot; to get started.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {resumes.map((resume) => (
              <ResumeCard
                key={String(resume._id)}
                resume={{
                  _id: String(resume._id),
                  title: resume.title,
                  data: (resume.data ?? {}) as { basics?: { label?: string } },
                  meta: resume.meta as { templateId?: string; layout?: string },
                  sectionsFilledCount: resume.sectionsFilledCount,
                  formatScore: resume.formatScore ?? 0,
                  createdAt: resume.createdAt.toISOString(),
                  updatedAt: resume.updatedAt.toISOString(),
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
cd cv-builder && npm run test:run 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add cv-builder/app/'(dashboard)'/dashboard/page.tsx
git commit -m "feat(theme): restyle dashboard page with AppNavbar and indigo palette"
```

---

### Task 7: Restyle ResumeCard, NewResumeButton, UploadCVButton

**Files:**
- Modify: `cv-builder/components/ResumeCard.tsx`
- Modify: `cv-builder/components/NewResumeButton.tsx`
- Modify: `cv-builder/components/UploadCVButton.tsx`

- [ ] **Step 1: Update `ResumeCard.tsx`** — replace the `return (` block (lines 102–198) with:

```tsx
  return (
    <div className="rounded-xl border border-white/30 bg-white/65 backdrop-blur-xl p-4 shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-indigo-900">{resume.title}</p>
          <p className="truncate text-sm text-indigo-400">
            {resume.data.basics?.label ?? 'No role set'} · {resume.meta.templateId ?? 'classic'} template
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/dashboard/resumes/${resume._id}`}
            className="rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
          >
            Open
          </Link>
          <button
            onClick={handleDownload}
            className="rounded-md border border-indigo-100 px-3 py-1.5 text-xs font-medium text-indigo-500 transition hover:bg-indigo-50"
            title="Download as JSON"
          >
            ↓ JSON
          </button>
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="rounded-md border border-indigo-100 px-3 py-1.5 text-xs font-medium text-indigo-500 transition hover:bg-indigo-50 disabled:opacity-50"
            title="Duplicate"
          >
            {duplicating ? '…' : '⧉'}
          </button>
          {confirmingDelete ? (
            <span className="flex items-center gap-1">
              <span className="text-xs font-medium text-red-600">Sure?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-red-500 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
              >
                {deleting ? '…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded-md border border-indigo-100 px-2 py-1.5 text-xs font-medium text-indigo-500 transition hover:bg-indigo-50"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              title="Delete"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="mt-3 flex flex-wrap gap-6 border-t border-indigo-100 pt-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-400">Created</p>
          <p className="mt-0.5 text-sm text-indigo-900">{formatDate(resume.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-400">Last Edited</p>
          <p className="mt-0.5 text-sm text-indigo-900">{formatRelativeTime(resume.updatedAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-400">Sections</p>
          <p className="mt-0.5 text-sm text-indigo-900">{resume.sectionsFilledCount} filled</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-400">Layout</p>
          <p className="mt-0.5 text-sm capitalize text-indigo-900">
            {(resume.meta.layout ?? 'single-column').replace('-', ' ')}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-400">Format Score</p>
          <p className={`mt-0.5 text-sm font-medium ${
            resume.formatScore >= 20
              ? 'text-green-600'
              : resume.formatScore >= 10
              ? 'text-yellow-600'
              : 'text-red-500'
          }`}>
            {resume.formatScore}/25
          </p>
        </div>
      </div>
    </div>
  )
```

- [ ] **Step 2: Update `NewResumeButton.tsx`** — replace the `className` on the `<button>`:

Old:
```tsx
className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-700 disabled:opacity-50"
```

New:
```tsx
className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
```

- [ ] **Step 3: Update `UploadCVButton.tsx`** — three style changes:

(a) The idle state `<button>` className, old:
```tsx
className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
```
New:
```tsx
className="rounded-lg border border-indigo-300 bg-white/80 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-50"
```

(b) The spinner `<svg>` className, old:
```tsx
className="h-4 w-4 animate-spin text-blue-600"
```
New:
```tsx
className="h-4 w-4 animate-spin text-indigo-600"
```

(c) The loading progress dots — first dot old `bg-blue-600`, second dot old `bg-blue-600`, both change to `bg-indigo-600`:
```tsx
<span className="h-2 w-2 rounded-full bg-indigo-600" />
<span className={`h-2 w-2 rounded-full ${phase === 'extracting' ? 'bg-indigo-600' : 'bg-gray-200'}`} />
```

(d) The "Try another file" error button className, old:
```tsx
className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
```
New:
```tsx
className="rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
```

- [ ] **Step 4: Run tests**

```bash
cd cv-builder && npm run test:run 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add cv-builder/components/ResumeCard.tsx cv-builder/components/NewResumeButton.tsx cv-builder/components/UploadCVButton.tsx
git commit -m "feat(theme): restyle ResumeCard, NewResumeButton, UploadCVButton"
```

---

### Task 8: Restyle EditorShell

**Files:**
- Modify: `cv-builder/components/editor/EditorShell.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
'use client'

import { useEffect, useState } from 'react'
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

export interface EditorShellProps {
  resumeId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
}

export function EditorShell({ resumeId, title, data, meta }: EditorShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('edit')
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
          <div className="w-80 min-w-[320px] flex flex-col border-r border-white/20 bg-white/40 backdrop-blur-xl shrink-0">
            {/* Title + save status */}
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

- [ ] **Step 2: Run tests**

```bash
cd cv-builder && npm run test:run 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add cv-builder/components/editor/EditorShell.tsx
git commit -m "feat(theme): restyle EditorShell with AppNavbar and indigo palette"
```

---

### Task 9: Restyle AccordionSection and EditTab

**Files:**
- Modify: `cv-builder/components/editor/AccordionSection.tsx`
- Modify: `cv-builder/components/editor/EditTab.tsx`

- [ ] **Step 1: Replace `AccordionSection.tsx`**

```tsx
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
    <div className="border border-indigo-100 rounded-xl overflow-hidden bg-white/60 backdrop-blur-sm shadow-sm">
      <div className="flex items-center gap-1 pr-2 bg-white/70 hover:bg-white/90 transition-colors">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex-1 flex items-center gap-2 px-4 py-3 text-left min-w-0"
        >
          <span className="font-medium text-sm text-indigo-900">{title}</span>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500">
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

- [ ] **Step 2: Update `EditTab.tsx`** — change only the wrapper `<div>` className on line 65:

Old:
```tsx
<div className="max-w-2xl mx-auto py-6 px-4 space-y-2">
```

New:
```tsx
<div className="max-w-2xl mx-auto py-6 px-4 space-y-2 bg-transparent">
```

(No other changes needed — accordion sections provide their own glass styling.)

- [ ] **Step 3: Run tests**

```bash
cd cv-builder && npm run test:run 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add cv-builder/components/editor/AccordionSection.tsx cv-builder/components/editor/EditTab.tsx
git commit -m "feat(theme): restyle AccordionSection and EditTab"
```

---

### Task 10: Restyle DesignPanel, PreviewTab, AtsScorePanel

**Files:**
- Modify: `cv-builder/components/editor/DesignPanel.tsx`
- Modify: `cv-builder/components/editor/PreviewTab.tsx`
- Modify: `cv-builder/components/ats/AtsScorePanel.tsx`

- [ ] **Step 1: In `DesignPanel.tsx`** — update the three class constant strings and active states:

Replace:
```tsx
const selectClass = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
```
With:
```tsx
const selectClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
const labelClass = 'block text-xs font-medium text-indigo-600 mb-1'
```

Replace active template button class:
```tsx
? 'border-blue-500 bg-blue-50'
```
With:
```tsx
? 'border-indigo-500 bg-indigo-50'
```

Replace active layout button class:
```tsx
? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
```
With:
```tsx
? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
```

Replace both range inputs `accent-blue-600`:
```tsx
className="w-full accent-indigo-600"
```

Replace color input focus ring `focus:ring-blue-500` (appears twice):
```tsx
className="flex-1 border border-indigo-200 rounded px-2 py-1 text-xs font-mono bg-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500"
```

Also replace the color picker border `border-gray-300` (appears twice):
```tsx
className="h-8 w-10 rounded border border-indigo-200 cursor-pointer p-0.5"
```

- [ ] **Step 2: In `PreviewTab.tsx`** — change the outer container className only (the paper canvas inside stays white):

Old:
```tsx
<div ref={containerRef} className="flex-1 overflow-auto bg-gray-100 flex justify-center py-8">
```
New:
```tsx
<div ref={containerRef} className="flex-1 overflow-auto bg-white/20 backdrop-blur-sm flex justify-center py-8">
```

- [ ] **Step 3: In `AtsScorePanel.tsx`** — update classNames:

Replace textarea class:
```tsx
className="w-full h-40 rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
```
With:
```tsx
className="w-full h-40 rounded-lg border border-indigo-200 bg-white/70 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
```

Replace Analyze button class:
```tsx
className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
```
With:
```tsx
className="mt-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
```

Replace score card border/bg:
```tsx
<div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
```
With:
```tsx
<div className="rounded-xl border border-white/30 bg-white/60 backdrop-blur-xl p-6 text-center shadow-lg">
```

Replace breakdown card border/bg:
```tsx
<div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
```
With:
```tsx
<div className="rounded-xl border border-white/30 bg-white/60 backdrop-blur-xl p-4 shadow-lg space-y-3">
```

Replace score bar background:
```tsx
<div className="h-2 w-full rounded-full bg-gray-200">
```
With:
```tsx
<div className="h-2 w-full rounded-full bg-indigo-100">
```

Replace breakdown label text-gray-600:
```tsx
<div className="flex justify-between text-xs text-gray-600 mb-1">
```
With:
```tsx
<div className="flex justify-between text-xs text-indigo-600 mb-1">
```

Replace label class text-sm font-semibold text-gray-700:
```tsx
<p className="text-sm font-semibold text-gray-700">Score Breakdown</p>
```
With:
```tsx
<p className="text-sm font-semibold text-indigo-900">Score Breakdown</p>
```

Also replace the label class in the textarea section:
```tsx
<label className="block text-sm font-medium text-gray-700 mb-1">
```
With:
```tsx
<label className="block text-sm font-medium text-indigo-700 mb-1">
```

- [ ] **Step 4: Run tests**

```bash
cd cv-builder && npm run test:run 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add cv-builder/components/editor/DesignPanel.tsx cv-builder/components/editor/PreviewTab.tsx cv-builder/components/ats/AtsScorePanel.tsx
git commit -m "feat(theme): restyle DesignPanel, PreviewTab, AtsScorePanel"
```

---

### Task 11: Restyle AiSuggestButton

**Files:**
- Modify: `cv-builder/components/ai/AiSuggestButton.tsx`

- [ ] **Step 1: Update button and popover classNames**

Replace trigger button class:
```tsx
className="px-1.5 py-1 text-sm text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors disabled:opacity-30"
```
With:
```tsx
className="px-1.5 py-1 text-sm text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30"
```

Replace suggestion popover border/bg:
```tsx
className="absolute top-full right-0 z-20 mt-1 w-80 rounded-lg border border-purple-200 bg-white p-3 shadow-lg"
```
With:
```tsx
className="absolute top-full right-0 z-20 mt-1 w-80 rounded-xl border border-indigo-200 bg-white/90 backdrop-blur-xl p-3 shadow-xl"
```

Replace "Use this" button:
```tsx
className="rounded bg-purple-600 px-3 py-1 text-xs text-white transition-colors hover:bg-purple-700"
```
With:
```tsx
className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white transition-colors hover:bg-indigo-700"
```

- [ ] **Step 2: Run tests**

```bash
cd cv-builder && npm run test:run 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add cv-builder/components/ai/AiSuggestButton.tsx
git commit -m "feat(theme): restyle AiSuggestButton"
```

---

### Task 12: Restyle all editor form files

This task applies the same input/label token swap to all 11 form files. The pattern is identical in every form.

**Files:**
- Modify: `cv-builder/components/editor/forms/BasicsForm.tsx`
- Modify: `cv-builder/components/editor/forms/WorkForm.tsx`
- Modify: `cv-builder/components/editor/forms/EducationForm.tsx`
- Modify: `cv-builder/components/editor/forms/SkillsForm.tsx`
- Modify: `cv-builder/components/editor/forms/CertificatesForm.tsx`
- Modify: `cv-builder/components/editor/forms/ProjectsForm.tsx`
- Modify: `cv-builder/components/editor/forms/LanguagesForm.tsx`
- Modify: `cv-builder/components/editor/forms/VolunteerForm.tsx`
- Modify: `cv-builder/components/editor/forms/AwardsForm.tsx`
- Modify: `cv-builder/components/editor/forms/PublicationsForm.tsx`
- Modify: `cv-builder/components/editor/forms/InterestsForm.tsx`

**The substitutions to apply in every form file:**

| Old | New |
|-----|-----|
| `border-gray-300` | `border-indigo-200` |
| `focus:ring-blue-500` | `focus:ring-indigo-500` |
| `focus:border-blue-500` | `focus:border-indigo-500` (if present) |
| `text-gray-600` (label) | `text-indigo-600` |
| `text-gray-700` (label) | `text-indigo-700` |
| `bg-blue-600` (button) | `bg-indigo-600` |
| `hover:bg-blue-700` | `hover:bg-indigo-700` |
| `text-blue-600` | `text-indigo-600` |
| `border-blue-300` | `border-indigo-300` |
| `hover:bg-blue-50` | `hover:bg-indigo-50` |

Also add `bg-white/70` to every `inputClass` string (the `w-full border ... rounded px-3 py-1.5 text-sm ...` class definition). For `BasicsForm` specifically the `inputClass` is defined as a const — change it to:

```tsx
const inputClass =
  'w-full border border-indigo-200 rounded-lg px-3 py-1.5 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
```

And the `labelClass` where it appears:
```tsx
const labelClass = 'block text-xs font-medium text-indigo-600 mb-1'
```

For forms that use inline `className` strings rather than a `const inputClass`, apply the same substitution inline.

- [ ] **Step 1: Update `BasicsForm.tsx`** — replace `inputClass` and `labelClass` constants as shown above (all other class strings already use the constants so no further changes needed)

- [ ] **Step 2: Read and update `WorkForm.tsx`**

```bash
cat cv-builder/components/editor/forms/WorkForm.tsx
```

Apply the substitution table to all Tailwind class strings in the file.

- [ ] **Step 3: Read and update `EducationForm.tsx`**

```bash
cat cv-builder/components/editor/forms/EducationForm.tsx
```

Apply substitution table.

- [ ] **Step 4: Read and update remaining 8 forms**

For each of: `SkillsForm.tsx`, `CertificatesForm.tsx`, `ProjectsForm.tsx`, `LanguagesForm.tsx`, `VolunteerForm.tsx`, `AwardsForm.tsx`, `PublicationsForm.tsx`, `InterestsForm.tsx` — read the file, then apply the substitution table.

- [ ] **Step 5: Run tests**

```bash
cd cv-builder && npm run test:run 2>&1 | tail -10
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add cv-builder/components/editor/forms/
git commit -m "feat(theme): restyle all editor form inputs to indigo palette"
```

---

### Task 13: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd cv-builder && npm run test:run
```

Expected: all tests pass, same count as before (155 tests across 24 files)

- [ ] **Step 2: TypeScript check**

```bash
cd cv-builder && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: only pre-existing errors (none introduced by theme changes)

- [ ] **Step 3: Start dev server and visually verify**

```bash
cd cv-builder && npm run dev
```

Open `http://localhost:3000` and verify:
- Sign-in page: plasma background visible, frosted glass card, logo present
- Dashboard: plasma background, glass navbar with logo, glass ResumeCards with indigo accents, indigo buttons
- Editor: glass navbar with "← My CVs" + export buttons, indigo tab bar, glass accordion sections, indigo form inputs, glass ATS panel

- [ ] **Step 4: Commit final tag**

```bash
git tag theme-integration-complete
```
