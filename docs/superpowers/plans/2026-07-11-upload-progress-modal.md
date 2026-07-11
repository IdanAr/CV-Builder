# Centralized Upload Progress Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline "Reading…/Extracting…" spinner in `UploadCVButton` with a single centralized, non-dismissible-while-active popup showing a 0–100% progress bar that cycles through staged messages (Reading → Parsing → Extracting → Finalizing).

**Architecture:** A new `components/ui/progress.tsx` (vendored Radix-based linear progress bar) is composed by a new `components/UploadProgressModal.tsx`, which owns an internal "fake progress" animation engine driven by a `stage` prop (`reading` | `extracting` | `done` | `error`). `UploadCVButton.tsx` is rewired to drive that `stage` prop from its existing two-fetch upload flow instead of rendering its own inline indicator. Because both existing call sites (navbar, `EmptyDashboardState`) render `UploadCVButton`, both get the new modal automatically — no other files change.

**Tech Stack:** Next.js 14 / React 18 / TypeScript, Tailwind CSS 3.4, Radix UI (`radix-ui` npm package), Vitest + Testing Library (jsdom), `clsx` + `tailwind-merge`.

## Global Constraints

- New npm dependencies: `radix-ui`, `clsx`, `tailwind-merge` (npm/package-lock.json, not yarn/pnpm — this repo uses npm).
- `tailwind.config.ts` currently defines **no** `primary`/`secondary` color tokens (only `background`/`foreground` CSS vars) — do not rely on the vendored `Progress` component's default `bg-primary`/`bg-secondary`/`text-primary` classes resolving to anything; always pass explicit `className`/`indicatorClassName` overrides using the app's existing indigo palette (`indigo-100`/`indigo-600`, matching every other component in this codebase).
- Modal visual language must match the existing hand-rolled dialog in `components/applications/ApplicationsView.tsx` (`role="dialog" aria-modal="true"`, `fixed inset-0 z-40 flex items-center justify-center bg-indigo-950/30 p-4 backdrop-blur-sm` scrim, white rounded card).
- No close affordance and no backdrop-dismiss while `stage` is `reading` or `extracting` (non-dismissible while active, per approved design).
- Progress phases: `reading` spans 0%→45% (labels "Reading `<filename>`…" then, after 900ms, "Parsing document…"); `extracting` spans 45%→95% (labels "Extracting information…" then, after 1500ms, "Finalizing…"); `done` snaps to 100% ("Done — opening your CV…") and holds for ~400ms before the caller navigates.
- Percent animates toward (never reaching) the active phase's cap via exponential decay `cap - (cap - start) * decayRate^elapsedSeconds` (`decayRate = 0.35`), ticked every 100ms; on a `stage` change it must **snap** immediately to the previous phase's cap before the next phase's animation starts.
- Path alias `@/*` → repo root (already configured in `tsconfig.json` and `vitest.config.ts`) — use it for all new imports.
- Vitest 4.1.8, `vi.useFakeTimers()` fakes `Date` alongside timers in this version — safe to drive the `Date.now()`-based animation engine with `vi.advanceTimersByTime`.

---

### Task 1: Install dependencies and add the `cn()` utility

**Files:**
- Create: `lib/utils.ts`
- Test: `lib/utils.test.ts`
- Modify: `package.json`, `package-lock.json` (via `npm install`)

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` — used by Task 2 and Task 3.

- [ ] **Step 1: Install the new dependencies**

Run: `npm install radix-ui clsx tailwind-merge`
Expected: `package.json` gains `radix-ui`, `clsx`, `tailwind-merge` under `dependencies`; `package-lock.json` updates; exit code 0.

- [ ] **Step 2: Write the failing test**

Create `lib/utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins truthy class names with spaces', () => {
    expect(cn('a', 'b', false && 'c', undefined, 'd')).toBe('a b d')
  })

  it('lets a later conflicting Tailwind class win over an earlier one', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/utils.test.ts`
Expected: FAIL — `Cannot find module './utils'` (or similar resolution error), since `lib/utils.ts` doesn't exist yet.

- [ ] **Step 4: Write minimal implementation**

Create `lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/utils.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/utils.ts lib/utils.test.ts
git commit -m "chore: add radix-ui/clsx/tailwind-merge and cn() helper"
```

---

### Task 2: Add the vendored `Progress` primitive

**Files:**
- Create: `components/ui/progress.tsx`
- Test: `components/ui/progress.test.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils` (Task 1).
- Produces: `Progress`, `ProgressCircle`, `ProgressRadial` React components, each accepting `value?: number` (0–100) and, for `Progress`, `className`/`indicatorClassName`. `Progress` renders `role="progressbar"` with `aria-valuenow` set to `value` (Radix default behavior) — Task 3 relies on querying it via `getByRole('progressbar')`.

- [ ] **Step 1: Write the failing test**

Create `components/ui/progress.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Progress } from './progress'

describe('Progress', () => {
  it('exposes the current value on the progressbar role', () => {
    render(<Progress value={42} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '42')
  })

  it('applies indicatorClassName to the indicator element', () => {
    render(<Progress value={10} indicatorClassName="bg-indigo-600" />)
    const bar = screen.getByRole('progressbar')
    const indicator = bar.querySelector('[data-slot="progress-indicator"]')
    expect(indicator?.className).toContain('bg-indigo-600')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/ui/progress.test.tsx`
Expected: FAIL — `Cannot find module './progress'`.

- [ ] **Step 3: Write minimal implementation**

Create `components/ui/progress.tsx` (vendored as-is, unmodified from the supplied source):

```tsx
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Progress as ProgressPrimitive } from 'radix-ui';

function Progress({
  className,
  indicatorClassName,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-secondary', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn('h-full w-full flex-1 bg-primary transition-all', indicatorClassName)}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

function ProgressCircle({
  className,
  indicatorClassName,
  trackClassName,
  value = 0,
  size = 48,
  strokeWidth = 4,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  /**
   * Progress value from 0 to 100
   */
  value?: number;
  /**
   * Size of the circle in pixels
   */
  size?: number;
  /**
   * Width of the progress stroke
   */
  strokeWidth?: number;
  /**
   * Additional className for the progress stroke
   */
  indicatorClassName?: string;
  /**
   * Additional className for the progress track
   */
  trackClassName?: string;
  /**
   * Content to display in the center of the circle
   */
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div
      data-slot="progress-circle"
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg className="absolute inset-0 -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          data-slot="progress-circle-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className={cn('text-secondary', trackClassName)}
        />
        <circle
          data-slot="progress-circle-indicator"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('text-primary transition-all duration-300 ease-in-out', indicatorClassName)}
        />
      </svg>
      {children && (
        <div
          data-slot="progress-circle-content"
          className="relative z-10 flex items-center justify-center text-sm font-medium"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ProgressRadial({
  className,
  value = 0,
  size = 120,
  strokeWidth = 8,
  startAngle = -90,
  endAngle = 90,
  showLabel = false,
  trackClassName,
  indicatorClassName,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  /**
   * Progress value from 0 to 100
   */
  value?: number;
  /**
   * Size of the radial in pixels
   */
  size?: number;
  /**
   * Width of the progress stroke
   */
  strokeWidth?: number;
  /**
   * Start angle in degrees
   */
  startAngle?: number;
  /**
   * Additional className for the progress stroke
   */
  indicatorClassName?: string;
  /**
   * Additional className for the progress track
   */
  trackClassName?: string;
  /**
   * End angle in degrees
   */
  endAngle?: number;
  /**
   * Whether to show percentage label
   */
  showLabel?: boolean;
  /**
   * Custom content to display
   */
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const angleRange = endAngle - startAngle;
  const progressAngle = (value / 100) * angleRange;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const startX = size / 2 + radius * Math.cos(toRadians(startAngle));
  const startY = size / 2 + radius * Math.sin(toRadians(startAngle));
  const endX = size / 2 + radius * Math.cos(toRadians(startAngle + progressAngle));
  const endY = size / 2 + radius * Math.sin(toRadians(startAngle + progressAngle));

  const largeArc = progressAngle > 180 ? 1 : 0;

  const pathData = ['M', startX, startY, 'A', radius, radius, 0, largeArc, 1, endX, endY].join(' ');

  return (
    <div
      data-slot="progress-radial"
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path
          d={[
            'M',
            size / 2 + radius * Math.cos(toRadians(startAngle)),
            size / 2 + radius * Math.sin(toRadians(startAngle)),
            'A',
            radius,
            radius,
            0,
            angleRange > 180 ? 1 : 0,
            1,
            size / 2 + radius * Math.cos(toRadians(endAngle)),
            size / 2 + radius * Math.sin(toRadians(endAngle)),
          ].join(' ')}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className={cn('text-secondary', trackClassName)}
        />
        <path
          d={pathData}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className={cn('text-primary transition-all duration-300 ease-in-out', indicatorClassName)}
        />
      </svg>
      {(showLabel || children) && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children || <span className="text-lg font-bold">{value}%</span>}
        </div>
      )}
    </div>
  );
}

export { Progress, ProgressCircle, ProgressRadial };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/ui/progress.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/progress.tsx components/ui/progress.test.tsx
git commit -m "feat: vendor Radix-based Progress/ProgressCircle/ProgressRadial primitives"
```

---

### Task 3: Build `UploadProgressModal` with the fake-progress engine

**Files:**
- Create: `components/UploadProgressModal.tsx`
- Test: `components/UploadProgressModal.test.tsx`

**Interfaces:**
- Consumes: `Progress` from `@/components/ui/progress` (Task 2).
- Produces:
  ```ts
  export type UploadStage = 'reading' | 'extracting' | 'done' | 'error'

  interface UploadProgressModalProps {
    open: boolean
    filename: string
    stage: UploadStage
    errorMessage?: string
    onRetry: () => void
    onClose: () => void
  }

  export default function UploadProgressModal(props: UploadProgressModalProps): JSX.Element | null
  ```
  Task 4 imports both the default export and the `UploadStage` type.

- [ ] **Step 1: Write the failing tests**

Create `components/UploadProgressModal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UploadProgressModal from './UploadProgressModal'

describe('UploadProgressModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when closed', () => {
    render(
      <UploadProgressModal
        open={false}
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the filename and "Reading…" immediately at 0%, in a dialog', () => {
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('cv.pdf')).toBeInTheDocument()
    expect(screen.getByText('Reading cv.pdf…')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('swaps to "Parsing document…" 900ms into the reading phase', () => {
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    vi.advanceTimersByTime(900)
    expect(screen.getByText('Parsing document…')).toBeInTheDocument()
  })

  it('animates percent upward but never reaches the 45% cap while stage is "reading"', () => {
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    vi.advanceTimersByTime(5000)
    const value = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))
    expect(value).toBeGreaterThan(0)
    expect(value).toBeLessThan(45)
  })

  it('snaps to 45% immediately when stage changes from "reading" to "extracting"', () => {
    const { rerender } = render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    vi.advanceTimersByTime(300)
    rerender(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="extracting"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45')
    expect(screen.getByText('Extracting information…')).toBeInTheDocument()
  })

  it('swaps to "Finalizing…" 1500ms into the extracting phase', () => {
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="extracting"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    vi.advanceTimersByTime(1500)
    expect(screen.getByText('Finalizing…')).toBeInTheDocument()
  })

  it('shows 100% and "Done — opening your CV…" when stage is "done"', () => {
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="done"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('Done — opening your CV…')).toBeInTheDocument()
  })

  it('does not call onClose when the backdrop is clicked while reading', () => {
    const onClose = vi.fn()
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={onClose}
      />
    )
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows the error message and wires up Try another file / Close on error', () => {
    const onRetry = vi.fn()
    const onClose = vi.fn()
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="error"
        errorMessage="Could not read the file."
        onRetry={onRetry}
        onClose={onClose}
      />
    )
    expect(screen.getByText('Could not read the file.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /try another file/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop is clicked in the error state', () => {
    const onClose = vi.fn()
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="error"
        errorMessage="Could not read the file."
        onRetry={() => {}}
        onClose={onClose}
      />
    )
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/UploadProgressModal.test.tsx`
Expected: FAIL — `Cannot find module './UploadProgressModal'`.

- [ ] **Step 3: Write the implementation**

Create `components/UploadProgressModal.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Progress } from '@/components/ui/progress'

export type UploadStage = 'reading' | 'extracting' | 'done' | 'error'

interface PhaseConfig {
  start: number
  cap: number
  decayRate: number
  swapAfterMs: number
  label2: string
}

const TICK_MS = 100

const READING_PHASE: PhaseConfig = {
  start: 0,
  cap: 45,
  decayRate: 0.35,
  swapAfterMs: 900,
  label2: 'Parsing document…',
}

const EXTRACTING_PHASE: PhaseConfig = {
  start: 45,
  cap: 95,
  decayRate: 0.35,
  swapAfterMs: 1500,
  label2: 'Finalizing…',
}

interface UploadProgressModalProps {
  open: boolean
  filename: string
  stage: UploadStage
  errorMessage?: string
  onRetry: () => void
  onClose: () => void
}

export default function UploadProgressModal({
  open,
  filename,
  stage,
  errorMessage,
  onRetry,
  onClose,
}: UploadProgressModalProps) {
  const [percent, setPercent] = useState(0)
  const [label, setLabel] = useState('')
  const intervalRef = useRef<number | null>(null)
  const swapTimerRef = useRef<number | null>(null)

  useEffect(() => {
    function clearTimers() {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
      if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current)
      intervalRef.current = null
      swapTimerRef.current = null
    }

    function runPhase(phase: PhaseConfig) {
      const phaseStart = Date.now()
      swapTimerRef.current = window.setTimeout(() => setLabel(phase.label2), phase.swapAfterMs)
      intervalRef.current = window.setInterval(() => {
        const elapsedSeconds = (Date.now() - phaseStart) / 1000
        setPercent(phase.cap - (phase.cap - phase.start) * Math.pow(phase.decayRate, elapsedSeconds))
      }, TICK_MS)
    }

    clearTimers()

    if (stage === 'reading') {
      setPercent(READING_PHASE.start)
      setLabel(`Reading ${filename}…`)
      runPhase(READING_PHASE)
    } else if (stage === 'extracting') {
      setPercent(READING_PHASE.cap)
      setLabel('Extracting information…')
      runPhase(EXTRACTING_PHASE)
    } else if (stage === 'done') {
      setPercent(100)
      setLabel('Done — opening your CV…')
    }

    return clearTimers
  }, [stage, filename])

  if (!open) return null

  const dismissible = stage === 'error'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Uploading CV"
      className="fixed inset-0 z-40 flex items-center justify-center bg-indigo-950/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-indigo-100 bg-white p-6 shadow-xl">
        {stage === 'error' ? (
          <>
            <h2 className="mb-2 text-sm font-semibold text-indigo-900">Upload failed</h2>
            <p className="mb-4 text-sm text-red-600">{errorMessage}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
              >
                Close
              </button>
              <button
                onClick={onRetry}
                className="rounded-lg border border-indigo-300 bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Try another file
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-1 truncate text-sm font-semibold text-indigo-900">{filename}</h2>
            <p className="mb-4 text-sm text-indigo-600">{label}</p>
            <Progress value={percent} className="bg-indigo-100" indicatorClassName="bg-indigo-600" />
            <p className="mt-2 text-right text-xs font-medium text-indigo-500">{Math.round(percent)}%</p>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/UploadProgressModal.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add components/UploadProgressModal.tsx components/UploadProgressModal.test.tsx
git commit -m "feat: add centralized upload progress modal with staged fake-progress engine"
```

---

### Task 4: Wire `UploadCVButton` to the new modal

**Files:**
- Modify: `components/UploadCVButton.tsx`
- Modify: `components/UploadCVButton.test.tsx`

**Interfaces:**
- Consumes: `UploadProgressModal`, `UploadStage` from `@/components/UploadProgressModal` (Task 3, default export + named type export — already produced exactly as `export default function UploadProgressModal` and `export type UploadStage` in Task 3 Step 3).

- [ ] **Step 1: Replace the existing test file's expectations up front (TDD for the rewire)**

Replace the full contents of `components/UploadCVButton.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const { default: UploadCVButton } = await import('./UploadCVButton')

function makeFile(name = 'resume.pdf', type = 'application/pdf', size = 1000) {
  return new File(['x'.repeat(size)], name, { type })
}

function triggerFileChange(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

describe('UploadCVButton', () => {
  beforeEach(() => {
    mockPush.mockClear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders the Upload CV button in idle state, with no modal open', () => {
    render(<UploadCVButton />)
    expect(screen.getByRole('button', { name: /upload cv/i })).toBeTruthy()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the modal on stage "reading" while the parse request is in flight', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
    render(<UploadCVButton />)
    triggerFileChange(makeFile('my-cv.pdf'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText('Reading my-cv.pdf…')).toBeTruthy()
  })

  it('moves the modal to stage "extracting" once the parse request resolves', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'cv text' }) } as Response)
      .mockImplementationOnce(() => new Promise(() => {}))
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => expect(screen.getByText('Extracting information…')).toBeTruthy())
  })

  it('redirects to the editor after the extract request resolves', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'cv text' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ resumeId: 'abc123' }) } as Response)
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/resumes/abc123'))
  })

  it('shows an error dialog when the parse API fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Could not read the file.' }),
    } as Response)
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => expect(screen.getByText('Could not read the file.')).toBeTruthy())
  })

  it('shows an error dialog with "Try another file" when the extract API fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'cv text' }) } as Response)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'AI failed.' }) } as Response)
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => expect(screen.getByRole('button', { name: /try another file/i })).toBeTruthy())
  })

  it('clicking "Try another file" after an error closes the modal, ready for another upload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Could not read the file.' }),
    } as Response)
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => screen.getByRole('button', { name: /try another file/i }))
    fireEvent.click(screen.getByRole('button', { name: /try another file/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rejects an oversized file client-side before any fetch, showing the error in the modal', async () => {
    render(<UploadCVButton />)
    triggerFileChange(makeFile('big.pdf', 'application/pdf', 5 * 1024 * 1024 + 1))
    await waitFor(() => expect(screen.getByText(/5 MB/i)).toBeTruthy())
    expect(fetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/UploadCVButton.test.tsx`
Expected: FAIL — several assertions fail because `UploadCVButton` still renders its old inline spinner instead of a `role="dialog"` modal.

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `components/UploadCVButton.tsx`:

```tsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadProgressModal, { type UploadStage } from './UploadProgressModal'

type Stage = 'idle' | UploadStage

const MAX_BYTES = 5 * 1024 * 1024
const DONE_DISPLAY_MS = 400

interface UploadCVButtonProps {
  variant?: 'navbar' | 'hero'
}

export default function UploadCVButton({ variant = 'navbar' }: UploadCVButtonProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [filename, setFilename] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  function reset() {
    setStage('idle')
    setErrorMsg('')
    setFilename('')
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return

    if (file.size > MAX_BYTES) {
      setFilename(file.name)
      setErrorMsg('File must be 5 MB or smaller.')
      setStage('error')
      return
    }

    setFilename(file.name)
    setStage('reading')
    setErrorMsg('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      const parseRes = await fetch('/api/resumes/upload/parse', { method: 'POST', body: formData })
      if (!parseRes.ok) {
        const json = await parseRes.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Could not read the file.')
      }
      const { text } = (await parseRes.json()) as { text: string }

      setStage('extracting')
      const extractRes = await fetch('/api/resumes/upload/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!extractRes.ok) {
        const json = await extractRes.json().catch(() => ({}))
        throw new Error(
          (json as { error?: string }).error ?? 'Could not extract information from this CV.'
        )
      }
      const { resumeId } = (await extractRes.json()) as { resumeId: string }

      setStage('done')
      window.setTimeout(() => router.push(`/dashboard/resumes/${resumeId}`), DONE_DISPLAY_MS)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('error')
    }
  }

  const triggerClassName =
    variant === 'hero'
      ? 'w-full rounded-lg border border-indigo-300 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-50'
      : 'rounded-lg border border-indigo-300 bg-white/80 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-50'

  return (
    <>
      <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
      <button onClick={() => inputRef.current?.click()} className={triggerClassName}>
        ⬆ Upload CV
      </button>
      <UploadProgressModal
        open={stage !== 'idle'}
        filename={filename}
        stage={stage === 'idle' ? 'reading' : stage}
        errorMessage={errorMsg}
        onRetry={reset}
        onClose={reset}
      />
    </>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/UploadCVButton.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All test files PASS; `tsc` produces no output (no errors).

- [ ] **Step 6: Commit**

```bash
git add components/UploadCVButton.tsx components/UploadCVButton.test.tsx
git commit -m "feat: drive UploadCVButton through the centralized progress modal"
```

---

### Task 5: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server** (skip if already running)

Run: `npm run dev` (background)

- [ ] **Step 2: Exercise the navbar upload flow**

Navigate to `/dashboard`, click "Upload CV" in the navbar, select a real `.pdf` or `.docx` resume file. Confirm: a centered modal appears with the filename, a message that starts at "Reading `<file>`…", a progress bar that visibly animates from 0% climbing toward 45%, then swaps to "Parsing document…" after under a second, then jumps to "Extracting information…" once the file finishes uploading, climbs toward 95%, swaps to "Finalizing…", then shows "Done — opening your CV…" at 100% briefly before navigating to `/dashboard/resumes/<id>`.

- [ ] **Step 3: Exercise the empty-state ("hero") upload flow**

If there's an account/state with zero CVs (or temporarily delete all via the dashboard), confirm `EmptyDashboardState`'s "Upload CV" button triggers the identical modal.

- [ ] **Step 4: Exercise the error path**

Upload a file over 5MB. Confirm the modal shows "Upload failed" with the size-limit message and both "Close" and "Try another file" buttons, and that clicking either dismisses the modal back to idle. Confirm clicking the backdrop while an upload is actively in progress (reading/extracting) does *not* dismiss it.

- [ ] **Step 5: Report result**

Note in the session summary whether all four flows behaved as expected, with any deviations called out explicitly (do not claim success without having actually driven the flow).

---

## Self-Review Notes

- **Spec coverage:** `lib/utils.ts` (Task 1), vendored `Progress` (Task 2), `UploadProgressModal` with the exact phase table/decay formula/snap behavior/non-dismissibility from the spec (Task 3), `UploadCVButton` rewire covering both call sites via shared component (Task 4), manual browser check (Task 5) — all spec sections have a corresponding task.
- **Placeholder scan:** no TBD/TODO; every step has full code or an exact command with expected output.
- **Type consistency:** `UploadStage` is defined once in Task 3 (`'reading' | 'extracting' | 'done' | 'error'`) and imported by name into Task 4's `Stage = 'idle' | UploadStage`; `UploadProgressModalProps` field names (`open`, `filename`, `stage`, `errorMessage`, `onRetry`, `onClose`) match exactly between Task 3's definition and Task 4's call site.
