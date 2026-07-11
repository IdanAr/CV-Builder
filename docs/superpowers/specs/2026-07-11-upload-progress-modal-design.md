# Centralized Upload Progress Modal — Design

## Problem

CV upload/parse feedback today is a small inline indicator (spinner + two dots + a
one-line label) embedded directly in `UploadCVButton.tsx`. It's duplicated wherever
the button is rendered, gives no sense of overall progress, and only ever shows two
static messages ("Reading…" / "Extracting information…").

## Goal

Replace it with a single centralized, reusable popup that shows a 0–100% progress bar
and cycles through staged messages (Reading → Parsing → Extracting → Finalizing) for
every CV upload, in every place `UploadCVButton` is used.

## New dependencies

- `radix-ui` (npm package, unified Radix primitives export used by `Progress.Root`/`Progress.Indicator`)
- `clsx`, `tailwind-merge` — for the `cn()` helper
- `lib/utils.ts` — new file, exports `cn()`:
  ```ts
  import { clsx, type ClassValue } from 'clsx'
  import { twMerge } from 'tailwind-merge'
  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
  }
  ```

## New files

### `components/ui/progress.tsx`

The `Progress` / `ProgressCircle` / `ProgressRadial` component supplied by the user,
added verbatim (linear `Progress` is the only one used by this feature; the other two
are kept for future reuse since they're part of the same primitive).

### `components/UploadProgressModal.tsx`

Centralized popup. Props:

```ts
type UploadStage = 'reading' | 'extracting' | 'done' | 'error'

interface UploadProgressModalProps {
  open: boolean
  filename: string
  stage: UploadStage
  errorMessage?: string
  onRetry: () => void
  onClose: () => void
}
```

Renders `null` when `open` is false. Otherwise renders a `role="dialog"
aria-modal="true"` overlay matching the existing modal visual language used in
`ApplicationsView.tsx`'s column editor (`fixed inset-0 z-40 flex items-center
justify-center bg-indigo-950/30 p-4 backdrop-blur-sm`, white rounded card).

**Body content by stage:**
- `reading` / `extracting`: filename, current sub-label, `Progress` bar, `NN%` text.
- `done`: "Done — opening your CV…" at 100%, no interactive controls (redirect follows
  immediately in the parent).
- `error`: reuses existing error copy/actions — `errorMessage` text, "Try another
  file" button (calls `onRetry`) and a "Close" button (calls `onClose`).

**Non-dismissibility while active:** while `stage` is `reading` or `extracting`,
clicking the backdrop is a no-op and there is no close affordance. Only the `error`
body is dismissible.

**Progress engine (internal state, not exposed as props):**

Two phases, each owning a percent range and two sequential sub-labels:

| Stage | Range | Sub-label 1 | Swap to sub-label 2 after |
|---|---|---|---|
| `reading` | 0% → 45% | "Reading `<filename>`…" | ~900ms → "Parsing document…" |
| `extracting` | 45% → 95% | "Extracting information…" | ~1500ms → "Finalizing…" |
| `done` | → 100% | "Done — opening your CV…" | — |

Within a phase's range, percent animates toward (but never reaches) the phase's cap
using exponential decay, ticked on a 100ms interval:

```
percent(t) = cap - (cap - start) * decayRate^t   // t in seconds since phase start
```

`decayRate` tuned (~0.35) so the bar visibly moves fast at first and eases as it nears
the cap — classic "fake progress" behavior with no risk of stalling, since it
approaches asymptotically rather than hitting a hardcoded ceiling and stopping dead.

When the `stage` prop changes (i.e. the real fetch it represents resolved), the
component:
1. Clears the interval/timers for the previous phase.
2. Snaps `percent` immediately to that phase's cap (so the UI is never caught
   mid-animation below where reality actually is).
3. Starts the next phase's animation from the new cap.

This guarantees the displayed percent is always ≤ actual progress made — it never
promises something that hasn't happened, and it never visibly freezes waiting on a
slow network call.

## Changes to existing files

### `components/UploadCVButton.tsx`

- Keep the trigger `<button>` (both `navbar` and `hero` variants, unchanged styling)
  and hidden file `<input>`.
- Replace the inline `phase === 'parsing' || phase === 'extracting'` block with
  `<UploadProgressModal>`, mapping the existing `Phase` state (`parsing` → `reading`,
  `extracting` → `extracting`) plus a new `done` stage set right after the extract
  fetch resolves and before `router.push`, held for ~400ms so the 100% state is
  visible before navigation.
- Error handling unchanged in substance (same messages, same retry semantics) but
  rendered through the modal's `error` body instead of the old inline error row.

### `components/EmptyDashboardState.tsx`

No changes needed — it renders `UploadCVButton variant="hero"`, so it inherits the
modal automatically. This is how "both usages" get centralized from one change.

## Testing

- `components/UploadProgressModal.test.tsx` (new): stage → range mapping, sub-label
  swap timing, snap-to-cap on stage change, non-dismissibility during active stages,
  dismissibility during `error`, using `vi.useFakeTimers()`.
- `components/UploadCVButton.test.tsx` (updated): existing test expectations move from
  inline text assertions to dialog-scoped queries (`getByRole('dialog')`), plus new
  assertions that percent reaches 45% when the parse fetch resolves and 95% when the
  extract fetch resolves, and that redirect fires after the `done` stage.

## Out of scope

- Real byte-level upload progress (would require XHR `upload.onprogress` or a
  streaming backend; parse/extract are single JSON fetches, not chunked).
- Reusing `UploadProgressModal` for any flow other than CV upload (e.g. bulk import)
  — not requested, no second caller exists yet.
