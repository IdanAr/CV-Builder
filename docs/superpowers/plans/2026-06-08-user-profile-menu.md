# User Profile Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an avatar+name pill to the navbar that opens a dropdown with Settings (blank modal), Terms & Conditions (modal with full text), and Sign Out (redirects to /signin).

**Architecture:** A single `UserProfileButton` client component owns all state and is threaded into the existing `AppNavbar` `actions` slot. Server pages (`DashboardPage`, `ResumePage`) read `session.user` and pass it down as a prop — no changes to `AppNavbar` itself. Sign-out calls `next-auth/react`'s `signOut` with `callbackUrl: '/signin'`.

**Tech Stack:** Next.js 14 App Router, TypeScript, NextAuth v5, `next-auth/react` (client-side signOut), Tailwind CSS, Vitest, @testing-library/react

---

## File Map

| File | Action |
|------|--------|
| `cv-builder/components/ui/UserProfileButton.tsx` | **Create** — full interactive component (trigger pill, dropdown, Settings modal, Terms modal) |
| `cv-builder/components/ui/UserProfileButton.test.tsx` | **Create** — full test suite |
| `cv-builder/app/(dashboard)/dashboard/page.tsx` | **Edit** — import and add `<UserProfileButton user={session.user} />` to AppNavbar actions |
| `cv-builder/app/(dashboard)/dashboard/resumes/[id]/page.tsx` | **Edit** — pass `user={session.user}` to `EditorShell` |
| `cv-builder/components/editor/EditorShell.tsx` | **Edit** — add `user` prop to `EditorShellProps`, render `<UserProfileButton user={user} />` in AppNavbar actions |

---

## Task 1: `UserProfileButton` component

**Files:**
- Create: `cv-builder/components/ui/UserProfileButton.tsx`
- Create: `cv-builder/components/ui/UserProfileButton.test.tsx`

- [ ] **Step 1: Write the test file**

Create `cv-builder/components/ui/UserProfileButton.test.tsx` with the full content below. All tests will fail at this point — the component does not exist yet.

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserProfileButton } from './UserProfileButton'
import { signOut } from 'next-auth/react'

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}))

const user = { name: 'Idan Arbel', email: 'idan@example.com', image: null }

describe('UserProfileButton', () => {
  beforeEach(() => {
    vi.mocked(signOut).mockClear()
  })

  it('renders the first name in the trigger pill', () => {
    render(<UserProfileButton user={user} />)
    expect(screen.getByText('Idan')).toBeInTheDocument()
  })

  it('renders 2-char uppercase initials when no image', () => {
    render(<UserProfileButton user={user} />)
    expect(screen.getByText('IA')).toBeInTheDocument()
  })

  it('dropdown is hidden on mount', () => {
    render(<UserProfileButton user={user} />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens dropdown on trigger click', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('dropdown contains Settings, Terms & Conditions, and Sign Out', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /terms/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()
  })

  it('closes dropdown on outside mousedown', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes dropdown on Escape key', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('calls signOut with callbackUrl /signin', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /sign out/i }))
    expect(vi.mocked(signOut)).toHaveBeenCalledWith({ callbackUrl: '/signin' })
  })

  it('opens Settings modal when Settings is clicked', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /settings/i }))
    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument()
    expect(screen.getByText(/settings content coming soon/i)).toBeInTheDocument()
  })

  it('closes Settings modal on backdrop click', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /settings/i }))
    fireEvent.click(screen.getByTestId('settings-backdrop'))
    expect(screen.queryByRole('heading', { name: /^settings$/i })).not.toBeInTheDocument()
  })

  it('closes Settings modal on close button', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /settings/i }))
    fireEvent.click(screen.getByRole('button', { name: /close settings/i }))
    expect(screen.queryByRole('heading', { name: /^settings$/i })).not.toBeInTheDocument()
  })

  it('opens Terms modal when Terms & Conditions is clicked', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    expect(screen.getByRole('heading', { name: /terms & conditions/i })).toBeInTheDocument()
    expect(screen.getByText(/acceptance of terms/i)).toBeInTheDocument()
  })

  it('closes Terms modal on backdrop click', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    fireEvent.click(screen.getByTestId('terms-backdrop'))
    expect(screen.queryByRole('heading', { name: /terms & conditions/i })).not.toBeInTheDocument()
  })

  it('closes Terms modal on close button', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    fireEvent.click(screen.getByRole('button', { name: /close terms/i }))
    expect(screen.queryByRole('heading', { name: /terms & conditions/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests and confirm they all fail**

```bash
cd cv-builder && npx vitest run components/ui/UserProfileButton.test.tsx
```

Expected: all 14 tests fail with "Cannot find module './UserProfileButton'" or similar.

- [ ] **Step 3: Implement the component**

Create `cv-builder/components/ui/UserProfileButton.tsx` with the full content below:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import Image from 'next/image'

interface UserProfileButtonProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('')
}

function Avatar({
  image,
  name,
  size,
}: {
  image?: string | null
  name?: string | null
  size: number
}) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? 'User'}
        width={size}
        height={size}
        className="rounded-full"
      />
    )
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.floor(size * 0.42) }}
    >
      {getInitials(name)}
    </div>
  )
}

export function UserProfileButton({ user }: UserProfileButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [dropdownOpen])

  const firstName = user.name?.split(' ')[0] ?? 'Account'

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger pill */}
      <button
        onClick={() => setDropdownOpen(o => !o)}
        aria-label="Open user menu"
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-indigo-200/40 bg-white/70 px-2.5 py-1 shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <Avatar image={user.image} name={user.name} size={26} />
        <span className="text-xs font-medium text-indigo-700">{firstName}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
          className={`text-indigo-400 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/40 bg-white/90 shadow-xl backdrop-blur-xl"
        >
          {/* User info header (non-interactive) */}
          <div className="flex items-center gap-3 border-b border-indigo-50 px-4 py-3">
            <Avatar image={user.image} name={user.name} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-indigo-900">
                {user.name ?? 'User'}
              </p>
              <p className="truncate text-xs text-indigo-400">{user.email ?? ''}</p>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-1.5">
            <button
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false)
                setSettingsOpen(true)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-indigo-900 transition hover:bg-indigo-50/70"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0 text-indigo-400"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false)
                setTermsOpen(true)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-indigo-900 transition hover:bg-indigo-50/70"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0 text-indigo-400"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Terms &amp; Conditions
            </button>
          </div>

          {/* Sign Out */}
          <div className="border-t border-indigo-50 p-1.5">
            <button
              role="menuitem"
              onClick={() => signOut({ callbackUrl: '/signin' })}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50/80"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {settingsOpen && (
        <div
          data-testid="settings-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-900/10 px-4 backdrop-blur-sm"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/50 bg-white/90 p-6 shadow-2xl backdrop-blur-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-indigo-900">Settings</h2>
              <button
                aria-label="Close Settings"
                onClick={() => setSettingsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50/60 text-sm text-indigo-400 transition hover:bg-indigo-100/80"
              >
                ✕
              </button>
            </div>
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-indigo-200/60 bg-indigo-50/30">
              <p className="text-sm text-indigo-300">Settings content coming soon</p>
            </div>
          </div>
        </div>
      )}

      {/* Terms & Conditions modal */}
      {termsOpen && (
        <div
          data-testid="terms-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-900/10 px-4 backdrop-blur-sm"
          onClick={() => setTermsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/50 bg-white/90 shadow-2xl backdrop-blur-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-indigo-50 px-6 py-4">
              <h2 className="text-base font-bold text-indigo-900">
                Terms &amp; Conditions
              </h2>
              <button
                aria-label="Close Terms"
                onClick={() => setTermsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50/60 text-sm text-indigo-400 transition hover:bg-indigo-100/80"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-5 text-sm">
              <p className="mb-4 text-xs text-indigo-400">Effective date: June 2026</p>

              <h3 className="mb-1 font-semibold text-indigo-900">1. Acceptance of Terms</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                By accessing or using CV Builder, you agree to be bound by these Terms and
                Conditions. If you do not agree, you may not use the service.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">2. Description of Service</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                CV Builder is an AI-assisted platform for creating, editing, and exporting
                professional CVs and résumés. Features include a live editor, AI content
                suggestions, ATS scoring, and export to PDF and DOCX formats.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">3. User Accounts</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                You must authenticate via a supported OAuth provider (Google or GitHub) to use
                the service. You are responsible for all activity that occurs under your
                account. You agree not to share access credentials or use the service for any
                unlawful purpose.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">4. AI-Generated Content</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                CV Builder uses AI models to generate and refine CV content. AI-generated
                suggestions are provided as a starting point only. You are solely responsible
                for reviewing, editing, and verifying the accuracy of all content before
                submitting it to employers or third parties. CV Builder does not guarantee that
                AI-generated content is accurate, complete, or appropriate for your specific
                situation.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">5. Your Content</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                You retain ownership of all CV data and documents you create using the service.
                By using the service, you grant CV Builder a limited licence to store and
                process your data solely for the purpose of providing the service to you. We do
                not sell or share your personal CV data with third parties.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">6. Acceptable Use</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                You agree not to: (a) upload content that is unlawful, harmful, or infringes
                third-party rights; (b) attempt to reverse-engineer, scrape, or disrupt the
                service; (c) use the service to generate false or misleading employment
                credentials.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">7. Intellectual Property</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                The CV Builder application, including its design, code, and branding, is the
                intellectual property of its creators. Nothing in these Terms grants you any
                right to use CV Builder&apos;s trademarks or branding.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">8. Disclaimer of Warranties</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                The service is provided &quot;as is&quot; without warranties of any kind,
                express or implied, including fitness for a particular purpose. We do not
                warrant that the service will be uninterrupted or error-free.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">9. Limitation of Liability</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                To the fullest extent permitted by law, CV Builder and its creators shall not
                be liable for any indirect, incidental, or consequential damages arising from
                your use of the service, including any decisions made by employers or recruiters
                based on CV content generated using this platform.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">10. Changes to These Terms</h3>
              <p className="mb-4 leading-relaxed text-indigo-700">
                We may update these Terms from time to time. Continued use of the service after
                changes are posted constitutes your acceptance of the revised Terms.
              </p>

              <h3 className="mb-1 font-semibold text-indigo-900">11. Contact</h3>
              <p className="leading-relaxed text-indigo-700">
                Questions about these Terms may be directed to:{' '}
                <a
                  href="mailto:idan.rbel@gmail.com"
                  className="text-indigo-600 underline"
                >
                  idan.rbel@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests and confirm all 14 pass**

```bash
cd cv-builder && npx vitest run components/ui/UserProfileButton.test.tsx
```

Expected output: `14 passed`

- [ ] **Step 5: Commit**

```bash
cd cv-builder
git add components/ui/UserProfileButton.tsx components/ui/UserProfileButton.test.tsx
git commit -m "feat(ui): add UserProfileButton with dropdown, Settings modal, T&C modal, and sign-out"
```

---

## Task 2: Wire into DashboardPage

**Files:**
- Modify: `cv-builder/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Edit the file**

In `cv-builder/app/(dashboard)/dashboard/page.tsx`, add the import at the top and add `<UserProfileButton>` as the last element inside the `AppNavbar` `actions` fragment:

```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listResumes } from '@/lib/api/resumes'
import ResumeCard from '@/components/ResumeCard'
import NewResumeButton from '@/components/NewResumeButton'
import UploadCVButton from '@/components/UploadCVButton'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { UserProfileButton } from '@/components/ui/UserProfileButton'

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
            <UserProfileButton user={session.user} />
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

- [ ] **Step 2: Run the full test suite to verify no regressions**

```bash
cd cv-builder && npx vitest run
```

Expected: all tests pass (previously 232 + 14 new = 246 total).

- [ ] **Step 3: Commit**

```bash
cd cv-builder
git add app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(dashboard): add UserProfileButton to navbar"
```

---

## Task 3: Wire into EditorShell via ResumePage

**Files:**
- Modify: `cv-builder/components/editor/EditorShell.tsx`
- Modify: `cv-builder/app/(dashboard)/dashboard/resumes/[id]/page.tsx`

- [ ] **Step 1: Edit `EditorShell.tsx`**

**3a.** Add the import at the top of the file (alongside existing imports):

```tsx
import { UserProfileButton } from '@/components/ui/UserProfileButton'
```

**3b.** Extend `EditorShellProps` to include the optional `user` field:

```tsx
export interface EditorShellProps {
  resumeId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}
```

**3c.** Destructure `user` in the function signature:

```tsx
export function EditorShell({ resumeId, title, data, meta, user }: EditorShellProps) {
```

**3d.** In the `AppNavbar` `actions` block (around line 134), add a separator and `<UserProfileButton>` after the DOCX export button:

The current actions block ends with:
```tsx
            <button
              onClick={() => handleExport('docx')}
              className="text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 transition-colors"
            >
              DOCX
            </button>
          </div>
        }
      />
```

Replace it with:
```tsx
            <button
              onClick={() => handleExport('docx')}
              className="text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 transition-colors"
            >
              DOCX
            </button>
            {user && (
              <>
                <div className="w-px h-4 bg-indigo-200" />
                <UserProfileButton user={user} />
              </>
            )}
          </div>
        }
      />
```

- [ ] **Step 2: Edit `ResumePage`**

Replace the full content of `cv-builder/app/(dashboard)/dashboard/resumes/[id]/page.tsx`:

```tsx
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
      user={session.user}
    />
  )
}
```

- [ ] **Step 3: Run the full test suite**

```bash
cd cv-builder && npx vitest run
```

Expected: all 246 tests pass.

- [ ] **Step 4: Commit**

```bash
cd cv-builder
git add components/editor/EditorShell.tsx app/\(dashboard\)/dashboard/resumes/\[id\]/page.tsx
git commit -m "feat(editor): pass user to EditorShell, show UserProfileButton in editor navbar"
```
