# Sprint 5b — Editor UX Polish (Mobile, Zoom, Punch List)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Follow the same task-by-task, TDD-first, fresh-subagent-per-task pattern used for Sprint 5a.

**Goal:** the UI/UX polish half of the original Sprint 5 scope, deferred while Sprint 5a shipped the feature half (application tracking fields/API + cover letter — the dashboard-card status UI from that sprint was separately reverted per product decision; application tracking now awaits its own dedicated future sprint, see `docs/superpowers/plans/2026-07-07-application-tracking-supertable.md`). Dark mode, originally scoped as a third category here, was dropped per product decision (not useful for a CV-building tool). Three categories of work remain:
1. **Mobile-responsive editor** — `components/editor/EditorShell.tsx` is a fixed-width, JS-driven side-by-side two-panel layout with no responsive breakpoints at all; `components/ui/AppNavbar.tsx` has some (`sm:`/`lg:` padding) but its action row (many buttons) has no collapse behavior for narrow viewports.
2. **Preview zoom** — `components/editor/PreviewTab.tsx`'s `fitScale` is 100% auto-computed from container width via `ResizeObserver`; there is no user-facing zoom control of any kind.
3. **8-item UX punch list** — smaller, concrete gaps found during a direct read of `ResumeCard.tsx`, `PreviewTab.tsx`, `EditorShell.tsx`, `Toaster.tsx`, and `DesignPanel.tsx` (see Tasks 3–5 below for the itemized list with file/line grounding).

**Architecture:** No new dependencies. Zoom preference persists to `localStorage`, following the exact pattern already used for panel width (`EditorShell.tsx`'s `PANEL_WIDTH_KEY`).

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Zustand, Vitest, Testing Library.

## Global Constraints

- All work happens inside `cv-builder/`. All paths below are relative to `cv-builder/`.
- Work on a new branch created from `main` (branch name TBD at scheduling time, e.g. `feat/sprint5b-editor-ux-polish`). This sprint has no code dependency on Sprint 5a's schema/API/cover-letter work, so it does not need to wait for that branch to merge.
- Run tests with `npx vitest run <path>` from `cv-builder/`. Full suite: `npx vitest run`. Type check: `npx tsc --noEmit`. Production build gate at the end: `npm run build`.
- No new npm dependencies.
- No dark mode work of any kind in this sprint — dropped from scope.
- Commit after every task with a conventional-commit message ending in:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Mobile-responsive editor + navbar

**Files:**
- Modify: `components/editor/EditorShell.tsx`
- Modify: `components/editor/EditorShell.test.tsx` (or create if it doesn't exist — check first)
- Modify: `components/ui/AppNavbar.tsx`
- Modify: `components/ui/AppNavbar.test.tsx` (create if it doesn't exist)

**Changes:**
1. `EditorShell.tsx` currently renders the edit panel and preview panel side-by-side unconditionally (`<div className="flex flex-1 overflow-hidden">` wrapping both, `EditorShellProps` line ~152–307). Below a breakpoint (e.g. `md`, 768px), replace the resizable side-by-side layout with a single-panel view plus a switcher: a small segmented control ("Edit" / "Preview") that shows one panel at a time, full-width. Above the breakpoint, current behavior (resizable divider, both panels visible) is unchanged — use a `useMediaQuery`-style hook (check if one already exists in `lib/hooks/`; if not, add a small one) rather than only CSS, since the resize-divider pointer handlers and `panelWidth` state need to be disabled outright on mobile, not just visually hidden.
2. Hide/disable the resize divider (`onPointerDown`/`Move`/`Up` handlers) entirely below the breakpoint — there's nothing to drag between when only one panel shows at a time.
3. `AppNavbar.tsx`: the `actions` row can contain many buttons (see `EditorShell.tsx`'s navbar `actions` prop: back link, save status, JSON export, Export menu, undo/redo is separate but profile button too). Below a breakpoint, either allow the actions row to wrap (`flex-wrap`) or collapse overflow items into a menu — pick the simpler option (wrap) for v1 given this is a personal tool, not a design-critical marketing page. Also hide the centered wordmark text (keep just the logo mark) below a narrow breakpoint so it doesn't visually collide with a wrapped/widened actions row.
4. Ensure primary tap targets (tab buttons, the Export trigger, profile button) meet a reasonable minimum touch-target size (∼40-44px) at the mobile breakpoint — check computed sizes, adjust padding where needed.

**TDD steps:**
- [ ] **Step 1: Write failing tests.** Mock a narrow viewport (mirror however this codebase's existing tests simulate viewport width, or add a small test util if none exists) and assert: below the breakpoint, only one of edit/preview panel is visible at a time and a switcher control is rendered; the resize divider is not rendered/not interactive below the breakpoint; above the breakpoint, existing side-by-side behavior is unchanged (regression guard). For `AppNavbar`: actions wrap instead of overflowing below the breakpoint (assert on a class or layout property, whatever's feasible in jsdom — a DOM-structure assertion is fine if pixel layout isn't testable in this environment).
- [ ] **Step 2: Run tests, confirm they fail.**
- [ ] **Step 3: Implement responsive behavior above.**
- [ ] **Step 4: Run tests, confirm they pass, including full existing `EditorShell.test.tsx` suite (no regressions to desktop behavior).** Also run `npx tsc --noEmit`.
- [ ] **Step 5: Commit.**

---

### Task 2: Preview zoom controls

**Files:**
- Modify: `components/editor/PreviewTab.tsx`
- Modify: `components/editor/PreviewTab.test.tsx` (or create if it doesn't exist)

**Changes:**
1. Add explicit zoom state: `zoomOverride: number | null` (`null` = current auto-fit behavior via the existing `ResizeObserver`-driven `fitScale`; a number = user-set override, e.g. `0.5`–`2.0`).
2. Add a small zoom control cluster next to the existing "Live Preview" header / expand-toggle button (same header row, `components/editor/PreviewTab.tsx` line ~100): `−` button, a percentage readout (click to open a small dropdown with preset levels: 50/75/100/125/150/Fit), `+` button. Step size e.g. 10%, clamped to a sane range (e.g. 25%–200%).
3. Selecting "Fit" clears `zoomOverride` back to `null`, restoring the existing auto-fit behavior exactly as it works today.
4. Persist the last-used zoom level to `localStorage` (mirror `EditorShell.tsx`'s `PANEL_WIDTH_KEY` pattern) — but persist as "Fit" by default for first-time users (don't force a fixed zoom on someone who's never touched the control).
5. The effective scale used in rendering (`transform: scale(...)` on the inner template div, and the page-break divider math that currently multiplies by `fitScale`) must use `zoomOverride ?? fitScale` everywhere `fitScale` is currently referenced — check all of them (there are at least 3: the wrapper's `width`/`height`, the inner div's `transform`, and the page-break `top` calculations).

**TDD steps:**
- [ ] **Step 1: Write failing tests.** Renders zoom controls; clicking `+`/`−` changes the displayed percentage and the rendered scale transform; selecting "Fit" from the dropdown clears back to auto-fit behavior; zoom is clamped at the min/max bounds; a previously-persisted zoom level is restored on mount.
- [ ] **Step 2: Run tests, confirm they fail.**
- [ ] **Step 3: Implement the zoom controls above**, updating all `fitScale` reference sites to use the effective scale.
- [ ] **Step 4: Run tests, confirm they pass.** Also run `npx tsc --noEmit`.
- [ ] **Step 5: Commit.**

---

### Task 3: Accessibility punch items (keyboard + screen reader)

**Files:**
- Modify: `components/ResumeCard.tsx`, `components/ResumeCard.test.tsx`
- Modify: `components/editor/PreviewTab.tsx`, `components/editor/PreviewTab.test.tsx`
- Modify: `components/editor/EditorShell.tsx`, `components/editor/EditorShell.test.tsx`
- Modify: `components/ui/Toaster.tsx`, `components/ui/Toaster.test.tsx`

**Punch-list items in this task (grounded in the current code):**
1. `ResumeCard.tsx`'s Download (`↓ JSON`, line ~153) and Duplicate (`⧉`, line ~160) buttons only have `title`, not `aria-label` — inconsistent with the Delete button three lines below it, which already does `aria-label={\`Delete ${resume.title}\`}`. Add matching `aria-label`s to the other two.
2. `PreviewTab.tsx`'s expand/collapse toggle (`⛶`, in `EditorShell.tsx` line ~291) has `title` only, same gap — add `aria-label` reflecting current state ("Expand preview" / "Collapse preview", matching the existing `title` text so at least the wording is already decided).
3. `EditorShell.tsx`'s resize divider (line ~276) is pointer-only: `onPointerDown`/`Move`/`Up`/`Cancel` handlers with no keyboard path, and the div isn't even focusable. Add `role="separator"`, `aria-orientation="vertical"`, `tabIndex={0}`, `aria-valuenow`/`aria-valuemin`/`aria-valuemax` reflecting `panelWidth`'s current/clamped range, and an `onKeyDown` handler: Left/Right arrow keys adjust `panelWidth` by a fixed step (e.g. 16px per press, Shift+arrow for a larger step), reusing the existing `clampPanelWidth` function so keyboard resizing respects the same bounds as pointer dragging.
4. `Toaster.tsx`'s toasts auto-dismiss on a fixed timer (`toast.store.ts`'s `duration`, default 5000ms/6000ms) with no pause on hover or focus. This matters most for the 6-second "Undo delete" toast (`ResumeCard.tsx`'s `handleDelete`) — a user reading it, or whose mouse happens to be elsewhere, can lose the undo window. Add pause-on-hover/focus to the toast's dismiss timer, resuming (with the remaining time, not a full reset) when the pointer/focus leaves.

**TDD steps:**
- [ ] **Step 1: Write failing tests.** `ResumeCard.test.tsx`: Download and Duplicate buttons have the expected `aria-label`. `PreviewTab.test.tsx`/`EditorShell.test.tsx`: the expand toggle has an `aria-label` that changes with state. `EditorShell.test.tsx`: the divider has `role="separator"` and correct `aria-value*`; pressing arrow keys while it's focused changes the rendered panel width within `clampPanelWidth`'s bounds. `Toaster.test.tsx`: hovering/focusing a toast prevents its dismiss timer from firing; leaving resumes the countdown (use fake timers, matching however this codebase's existing timer-based tests — e.g. `ResumeCard.test.tsx`'s undo-toast tests — already mock `window.setTimeout`/`vi.useFakeTimers`).
- [ ] **Step 2: Run tests, confirm they fail.**
- [ ] **Step 3: Implement the four fixes above.**
- [ ] **Step 4: Run tests, confirm they pass.** Also run `npx tsc --noEmit`.
- [ ] **Step 5: Commit.**

---

### Task 4: Dashboard card mobile/UX fixes

**Files:**
- Modify: `components/ResumeCard.tsx`
- Modify: `components/ResumeCard.test.tsx`

**Punch-list items in this task:**
5. `ResumeCard.tsx`'s action-button row (`Open`/`↓ JSON`/`⧉`/`✕`, the `<div className="relative z-10 flex shrink-0 gap-2">` around line ~145) doesn't wrap and isn't sized with mobile in mind — on a narrow viewport this row can crowd against the truncated title/role text on its left. Add `flex-wrap` (or a responsive stacking rule) so the buttons wrap onto a second line rather than compressing/overflowing.
6. `handleDownload` (line ~110) has no loading/disabled guard, unlike `handleDuplicate`'s `duplicating` state three functions above it — a user can double/triple-click it and fire multiple concurrent download fetches. Add a `downloading` state mirroring `duplicating`'s exact shape (disable the button, swap its label/icon to an in-progress indicator while the fetch is in flight).

**TDD steps:**
- [ ] **Step 1: Write failing tests.** Renders the button row with wrap behavior at a narrow viewport (DOM/class assertion, matching whatever's feasible in this test environment). Clicking Download disables the button and shows a loading indicator until the fetch resolves; a second click while loading does not fire a second fetch.
- [ ] **Step 2: Run tests, confirm they fail.**
- [ ] **Step 3: Implement the two fixes above.**
- [ ] **Step 4: Run tests, confirm they pass.** Also run `npx tsc --noEmit`.
- [ ] **Step 5: Commit.**

---

### Task 5: Design panel color input validation

**Files:**
- Modify: `components/editor/DesignPanel.tsx`
- Modify: `components/editor/DesignPanel.test.tsx` (or create if it doesn't exist)

**Punch-list item in this task:**
7. `DesignPanel.tsx`'s primary/accent color hex text inputs (lines ~248 and ~259) accept any string and pass it straight to `setMeta` on every keystroke, with no format validation — an invalid value (e.g. `"purple"`, a truncated hex, stray characters) is silently written into `meta.primaryColor`/`accentColor`, which then likely breaks or produces unexpected results in the PDF/DOCX export color handling downstream. Add hex-format validation (`/^#([0-9a-fA-F]{3}){1,2}$/`) on the text input: keep a local draft value so the user can type freely, only call `setMeta` when the draft matches valid hex, and show a small inline error (matching this codebase's existing inline-error convention, e.g. `AtsScorePanel.tsx`'s `<p className="text-sm text-red-500">`) when the current draft doesn't parse, reverting to the last valid value on blur if still invalid.

**TDD steps:**
- [ ] **Step 1: Write failing tests.** Typing a valid hex value updates `meta.primaryColor`/`accentColor`; typing an invalid value shows an inline error and does not call `setMeta`; blurring with an invalid draft reverts the input to the last valid value.
- [ ] **Step 2: Run tests, confirm they fail.**
- [ ] **Step 3: Implement the validation above** for both color fields.
- [ ] **Step 4: Run tests, confirm they pass.** Also run `npx tsc --noEmit`.
- [ ] **Step 5: Commit.**

---

### Task 6: Final verification gate

- [ ] Run `npx vitest run` from `cv-builder/` — full suite must be green. Report the actual starting test count for this branch (off current `main` — report the real number, don't assume).
- [ ] Run `npx tsc --noEmit` — must be clean.
- [ ] Run `npm run build` — must succeed.
- [ ] Manually sanity-check (or describe how a human should sanity-check) at least: editor at a phone-width viewport; preview zoom persists across a reload; the resize divider's keyboard control.
- [ ] Write a task-by-task report: commit hashes, test counts before/after per task, any deviations from this plan, open decisions for the human (e.g. which mobile breakpoint felt right in practice).
- [ ] **No push, merge, or PR** — stop here and report, exactly as in Sprint 5a.

## Open questions (proceeding with reasonable defaults unless corrected)

1. **Scope check on "8 items"** — the 8 items in Tasks 3–5 were found by reading through a handful of key files (`ResumeCard.tsx`, `PreviewTab.tsx`, `EditorShell.tsx`, `Toaster.tsx`, `DesignPanel.tsx`), not an exhaustive UI audit. Proceeding with this list as scoped; flag anything else you spot along the way and it can be folded in.
2. **Mobile breakpoint for the editor** — proceeding with a single edit/preview switcher (one panel at a time, full-width) below `md` (768px) as the default pattern, per Task 1. Easy to revisit once it's actually running on a phone-width viewport.
