# Sprint 7 — Editor UI/UX "Charm" Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the CV Builder editor (`cv-builder/components/editor/`) from functional-but-rigid to a premium, Vercel-like SaaS aesthetic — glassmorphism, micro-interactions, framer-motion animations — without changing any state management, props contracts, or behavior.

**Architecture:** Presentation-only overhaul, outside-in: shell chrome first, then tabs/accordions, then design controls, then form fields, then the preview pane. A shared motion primitive (`Collapsible`) and a shared section-icon module are built first so every later task consumes them. All existing localStorage keys, `data-testid`s, ARIA attributes, and Zustand wiring are preserved verbatim.

**Tech Stack:** Next.js 14.2, React 18, Tailwind CSS 3.4, Zustand, dnd-kit (existing) + **framer-motion** and **lucide-react** (new, added in Task 1). Tests: Vitest + React Testing Library.

**21st.dev research (spec Step 0, completed during planning):** Catalog searched for resizable panels, animated accordions, floating-label inputs, toggle groups, and floating toolbars. Design references: shadcn `Resizable` (21st.dev/@shadcn/components/resizable), motion-primitives `Accordion` (21st.dev/@ibelick/components/accordion), originui `Input` (21st.dev/@originui/components/input), ruixen `Action Toolbar`. **Note:** fetching component *code* from 21st via `get_component` is a paid API call; the patterns below re-implement the same interactions with free open-source primitives (framer-motion) directly, keeping our existing hand-rolled resize logic (which already has keyboard + pointer support and passing tests). If the human partner wants verbatim 21st code instead, fetch before Task 2.

## Global Constraints

- App root is `cv-builder/` — run ALL npm/test commands from `C:\Users\idan\Desktop\Idan\Personal\Claude\Code\CV Builder\cv-builder`.
- Presentation-only: do NOT change Zustand selectors/actions, props interfaces, handler logic, localStorage keys (`cv-builder:panel-width`, `cv-builder:preview-zoom`), `data-testid` values, or ARIA attributes. Spec: "maintain all existing state management and props passing; ONLY mutate the UI/UX presentation and animations."
- New dependencies allowed: `framer-motion`, `lucide-react` only.
- Every animation must respect `prefers-reduced-motion` (use framer-motion's `useReducedMotion`).
- Keep the indigo palette; focus rings: `focus:ring-2 focus:ring-indigo-500/50` with smooth transition.
- Full suite must stay green: `npm run test:run` (387+ tests) and `npx tsc --noEmit` after every task.
- Commit after every task on branch `feat/sprint7-ui-charm`.

---

### Task 1: Motion foundation — dependencies, `Collapsible` primitive, section icons

**Files:**
- Modify: `cv-builder/package.json` (via npm install)
- Create: `cv-builder/components/ui/motion/Collapsible.tsx`
- Create: `cv-builder/components/ui/SectionIcon.tsx`
- Test: `cv-builder/components/ui/motion/Collapsible.test.tsx`

**Interfaces:**
- Consumes: nothing (foundation task)
- Produces: `Collapsible({ open: boolean, children: ReactNode })` — animated mount/unmount wrapper. `SectionIcon({ section: string, className?: string })` — renders a lucide icon for a section key (`basics|work|education|skills|languages|volunteer|certificates|awards|publications|interests|projects|custom:*`).

- [ ] **Step 1: Create branch and install dependencies**

```bash
cd cv-builder
git checkout -b feat/sprint7-ui-charm
npm install framer-motion lucide-react
```

Expected: both packages appear in `cv-builder/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

```tsx
// cv-builder/components/ui/motion/Collapsible.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Collapsible } from './Collapsible'

describe('Collapsible', () => {
  it('renders children when open', () => {
    render(<Collapsible open><p>Body content</p></Collapsible>)
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('does not render children when closed', () => {
    render(<Collapsible open={false}><p>Body content</p></Collapsible>)
    expect(screen.queryByText('Body content')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run components/ui/motion/Collapsible.test.tsx`
Expected: FAIL — cannot resolve `./Collapsible`

- [ ] **Step 4: Implement `Collapsible`**

```tsx
// cv-builder/components/ui/motion/Collapsible.tsx
'use client'

import type { ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface CollapsibleProps {
  open: boolean
  children: ReactNode
}

/** Animated mount/unmount wrapper: slides open/closed with a height+opacity
 *  transition. Content is unmounted when closed (matches the previous
 *  `{isOpen && ...}` conditional-render behavior exactly). */
export function Collapsible({ open, children }: CollapsibleProps) {
  const reduceMotion = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 5: Implement `SectionIcon`**

```tsx
// cv-builder/components/ui/SectionIcon.tsx
'use client'

import type { LucideIcon } from 'lucide-react'
import {
  User, Briefcase, GraduationCap, Wrench, Languages, HandHeart,
  BadgeCheck, Award, BookOpen, Sparkles, FolderKanban, Puzzle,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  basics: User,
  work: Briefcase,
  education: GraduationCap,
  skills: Wrench,
  languages: Languages,
  volunteer: HandHeart,
  certificates: BadgeCheck,
  awards: Award,
  publications: BookOpen,
  interests: Sparkles,
  projects: FolderKanban,
}

/** Icon for a section key; custom sections (`custom:*`) and unknown keys
 *  fall back to a puzzle piece. */
export function SectionIcon({ section, className }: { section: string; className?: string }) {
  const Icon = ICONS[section] ?? Puzzle
  return <Icon aria-hidden="true" className={className ?? 'h-4 w-4'} strokeWidth={1.75} />
}
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run components/ui/motion/Collapsible.test.tsx && npx tsc --noEmit`
Expected: PASS, no type errors

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json components/ui/motion/Collapsible.tsx components/ui/motion/Collapsible.test.tsx components/ui/SectionIcon.tsx
git commit -m "feat: add framer-motion foundation (Collapsible primitive, SectionIcon)"
```

---

### Task 2: EditorShell — workspace chrome, animated tabs, polished divider

**Files:**
- Modify: `cv-builder/components/editor/EditorShell.tsx`
- Test: `cv-builder/components/editor/EditorShell.test.tsx` (existing — must stay green unchanged)

**Interfaces:**
- Consumes: nothing new (pure restyle; framer-motion imported directly)
- Produces: no API changes — `EditorShellProps` unchanged

All changes are className/markup-level. Keep every handler, ref, state var, `data-testid="panel-resize-divider"`, and ARIA attribute exactly as-is.

- [ ] **Step 1: Add framer-motion import and gradient workspace background**

Add to imports:

```tsx
import { motion } from 'framer-motion'
```

Change the root container (line ~287) from:

```tsx
<div className="flex flex-col h-screen overflow-hidden">
```

to a subtle gradient canvas that makes the glass panels pop:

```tsx
<div className="flex flex-col h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50">
```

- [ ] **Step 2: Animated tab underline (desktop tab bar)**

Replace the tab bar `map` body (lines ~202–215) with a version where the active underline is a shared `motion.span` (`layoutId`) that glides between tabs:

```tsx
{(['edit', 'design', 'ats', 'coverLetter'] as Tab[]).map((tab) => (
  <button
    key={tab}
    type="button"
    onClick={() => setActiveTab(tab)}
    className={`relative flex items-center justify-center min-h-[44px] px-4 py-2 text-sm font-medium transition-colors ${
      activeTab === tab ? 'text-indigo-600' : 'text-indigo-400 hover:text-indigo-600'
    }`}
  >
    {TAB_LABELS[tab]}
    {activeTab === tab && (
      <motion.span
        layoutId="editor-tab-underline"
        className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-indigo-600"
        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      />
    )}
  </button>
))}
```

- [ ] **Step 3: Elevate the two panels to floating glass cards**

- Left panel (line ~387): `className="flex flex-col border-r border-white/30 bg-white/50 backdrop-blur-xl shadow-md shrink-0"` and add `rounded-r-none` (keep `style={{ width: panelWidth }}`).
- Right preview panel (line ~417): `className="flex-1 flex flex-col min-w-0 bg-white/30 backdrop-blur-sm"` → `"flex-1 flex flex-col min-w-0 bg-slate-100/60"` (distinct backdrop so the paper preview pops — completes in Task 6).
- Undo/Redo buttons (lines ~225, ~232): append `rounded-lg shadow-sm hover:shadow transition-all active:scale-95` (replace the bare `rounded`).
- Navbar `JSON` button (line ~305): `rounded` → `rounded-lg hover:shadow-sm transition-all`.

- [ ] **Step 4: Polished resize divider**

Keep all pointer/keyboard handlers and ARIA. Change only the divider className (line ~405) to a wider hit area with a centered pill that glows on hover/drag:

```tsx
className={`group/divider w-1.5 shrink-0 cursor-col-resize select-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
  dividerActive ? 'bg-indigo-400/60' : 'hover:bg-indigo-400/40 bg-indigo-200/30'
}`}
```

- [ ] **Step 5: Run existing shell tests + typecheck**

Run: `npx vitest run components/editor/EditorShell.test.tsx && npx tsc --noEmit`
Expected: PASS with zero test-file edits. If a test fails, the restyle broke a contract — fix the component, never the test.

- [ ] **Step 6: Commit**

```bash
git add components/editor/EditorShell.tsx
git commit -m "feat: EditorShell premium chrome — gradient canvas, animated tab underline, glass panels"
```

---

### Task 3: AccordionSection — framer-motion expand/collapse + section icons

**Files:**
- Modify: `cv-builder/components/editor/AccordionSection.tsx`
- Modify: `cv-builder/components/editor/EditTab.tsx` (pass `icon` per section)
- Test: `cv-builder/components/editor/AccordionSection.test.tsx`, `cv-builder/components/editor/EditTab.test.tsx` (existing — stay green)

**Interfaces:**
- Consumes: `Collapsible` from Task 1, `SectionIcon` from Task 1
- Produces: `AccordionSectionProps` gains OPTIONAL `icon?: ReactNode` (non-breaking; all other props unchanged)

- [ ] **Step 1: Write the failing test (icon rendering)**

Append to `AccordionSection.test.tsx`:

```tsx
it('renders the provided icon before the title', () => {
  render(
    <AccordionSection title="Work" isOpen={false} onToggle={() => {}} icon={<span data-testid="section-icon" />}>
      <p>body</p>
    </AccordionSection>
  )
  expect(screen.getByTestId('section-icon')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/editor/AccordionSection.test.tsx`
Expected: FAIL — `icon` prop does not exist / icon not rendered

- [ ] **Step 3: Implement — icon prop, animated body, rotating chevron, hover lift**

In `AccordionSection.tsx`:

1. Add imports:

```tsx
import { motion } from 'framer-motion'
import { Collapsible } from '@/components/ui/motion/Collapsible'
```

2. Add `icon?: ReactNode` to `AccordionSectionProps` and destructure it.

3. Root div className (line ~45): add hover elevation —

```tsx
className={`border border-indigo-100 rounded-xl overflow-hidden bg-white/60 backdrop-blur-sm shadow-sm transition-shadow duration-200 hover:shadow-md group${
  dragHandleProps?.isDragging ? ' opacity-60 border-dashed border-indigo-400' : ''
}`}
```

4. Render the icon in a tinted chip immediately before the title (inside both the `onRename` input branch's row and the plain title button, right after the drag handle):

```tsx
{icon && (
  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
    {icon}
  </span>
)}
```

(For the plain-title branch, place it as the first child inside the toggle button before the `<span>{title}</span>`; for the rename branch, place it as a sibling before the `<input>`.)

5. Replace the static chevron button content (line ~106) with a rotating chevron:

```tsx
<motion.span
  animate={{ rotate: isOpen ? 180 : 0 }}
  transition={{ duration: 0.2 }}
  className="inline-block"
>
  ▼
</motion.span>
```

(Keep the outer button, its `aria-expanded`, and `aria-label` untouched.)

6. Replace the conditional body (lines ~109–111):

```tsx
<Collapsible open={isOpen}>
  <div className="px-4 pb-4 pt-2 border-t border-indigo-100 bg-white/50">{children}</div>
</Collapsible>
```

- [ ] **Step 4: Wire icons in EditTab**

In `EditTab.tsx`: import `SectionIcon` and pass to every `AccordionSection` (both the `basics` one, the standard-section loop, and custom sections):

```tsx
import { SectionIcon } from '@/components/ui/SectionIcon'
// standard sections (inside the orderedSections map, where `section` is the key):
icon={<SectionIcon section={section} />}
// basics accordion:
icon={<SectionIcon section="basics" />}
// custom sections:
icon={<SectionIcon section="custom" />}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run components/editor/AccordionSection.test.tsx components/editor/EditTab.test.tsx && npx tsc --noEmit`
Expected: PASS (new icon test + all existing open/close, rename, delete, drag tests)

- [ ] **Step 6: Commit**

```bash
git add components/editor/AccordionSection.tsx components/editor/AccordionSection.test.tsx components/editor/EditTab.tsx
git commit -m "feat: animated accordion sections with icons and hover elevation"
```

---

### Task 4: DesignPanel — visual template/layout pickers

**Files:**
- Modify: `cv-builder/components/editor/DesignPanel.tsx`
- Test: `cv-builder/components/editor/DesignPanel.test.tsx` (existing — stay green)

**Interfaces:**
- Consumes: nothing new
- Produces: no API changes. Template buttons keep their accessible text labels (`Classic`, `Modern`, …) so existing tests keep passing.

- [ ] **Step 1: Add mini SVG template thumbnails**

Add above the `TEMPLATES` constant a thumbnail component that draws an abstract A4 preview per template id (pure SVG, `aria-hidden`):

```tsx
function TemplateThumb({ id, active }: { id: string; active: boolean }) {
  const ink = active ? '#4f46e5' : '#a5b4fc'
  const soft = active ? '#c7d2fe' : '#e0e7ff'
  return (
    <svg aria-hidden="true" viewBox="0 0 40 52" className="h-13 w-10 shrink-0 rounded-[3px] bg-white shadow-sm ring-1 ring-indigo-100">
      {id === 'classic' && (<>
        <rect x="6" y="6" width="28" height="3" rx="1" fill={ink} />
        <rect x="6" y="12" width="28" height="1" fill={soft} />
        <rect x="6" y="17" width="20" height="2" rx="1" fill={soft} />
        <rect x="6" y="22" width="24" height="2" rx="1" fill={soft} />
        <rect x="6" y="27" width="18" height="2" rx="1" fill={soft} />
      </>)}
      {id === 'modern' && (<>
        <rect x="0" y="0" width="40" height="12" fill={ink} />
        <rect x="6" y="17" width="20" height="2" rx="1" fill={soft} />
        <rect x="6" y="22" width="24" height="2" rx="1" fill={soft} />
        <rect x="6" y="27" width="18" height="2" rx="1" fill={soft} />
      </>)}
      {id === 'minimal' && (<>
        <rect x="6" y="8" width="18" height="3" rx="1" fill={ink} />
        <rect x="6" y="16" width="26" height="1.5" rx="0.75" fill={soft} />
        <rect x="6" y="20" width="22" height="1.5" rx="0.75" fill={soft} />
        <rect x="6" y="24" width="24" height="1.5" rx="0.75" fill={soft} />
      </>)}
      {id === 'executive' && (<>
        <rect x="6" y="6" width="28" height="3" rx="1" fill={ink} />
        <rect x="6" y="11" width="28" height="0.8" fill={ink} />
        <rect x="6" y="13" width="28" height="0.8" fill={ink} />
        <rect x="6" y="19" width="22" height="2" rx="1" fill={soft} />
        <rect x="6" y="24" width="26" height="2" rx="1" fill={soft} />
      </>)}
      {id === 'sidebar' && (<>
        <rect x="0" y="0" width="13" height="52" fill={ink} />
        <rect x="17" y="8" width="18" height="3" rx="1" fill={soft} />
        <rect x="17" y="15" width="16" height="2" rx="1" fill={soft} />
        <rect x="17" y="20" width="18" height="2" rx="1" fill={soft} />
      </>)}
    </svg>
  )
}
```

- [ ] **Step 2: Use thumbnails in the template selector**

Replace the template button body (lines ~243–256) with a thumbnail + text row (text labels unchanged):

```tsx
<button
  key={t.id}
  type="button"
  onClick={() => setMeta({ templateId: t.id })}
  className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border transition-all duration-200 ${
    meta.templateId === t.id
      ? 'border-indigo-500 bg-indigo-50 shadow-sm'
      : 'border-indigo-100 hover:border-indigo-300 hover:shadow-sm hover:-translate-y-px'
  }`}
>
  <TemplateThumb id={t.id} active={meta.templateId === t.id} />
  <div className="min-w-0">
    <div className="font-medium text-sm">{t.label}</div>
    <div className="text-xs text-indigo-400 mt-0.5">{t.desc}</div>
  </div>
</button>
```

- [ ] **Step 3: Visual layout toggle**

Replace the layout button body (lines ~268–280) so each option shows a mini column diagram above its label (labels unchanged):

```tsx
<button
  key={layout}
  type="button"
  onClick={() => setMeta({ layout })}
  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 text-sm rounded-xl border transition-all duration-200 ${
    meta.layout === layout
      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium shadow-sm'
      : 'border-indigo-100 text-indigo-500 hover:border-indigo-300 hover:shadow-sm'
  }`}
>
  <svg aria-hidden="true" viewBox="0 0 28 20" className="h-5 w-7">
    {layout === 'single-column' ? (
      <rect x="4" y="2" width="20" height="16" rx="2" fill="currentColor" opacity="0.35" />
    ) : (<>
      <rect x="3" y="2" width="9" height="16" rx="2" fill="currentColor" opacity="0.35" />
      <rect x="16" y="2" width="9" height="16" rx="2" fill="currentColor" opacity="0.35" />
    </>)}
  </svg>
  {layout === 'single-column' ? 'Single column' : 'Two columns'}
</button>
```

- [ ] **Step 4: Polish the section-columns drop list**

In `SortableColumnRow` (line ~89), add smooth drop styling: `className="flex items-center gap-2 px-2.5 py-1.5 border-b border-indigo-50 last:border-b-0 transition-colors hover:bg-indigo-50/50"`, and on the outer isDragging style add a shadow: extend the `style` object with `boxShadow: isDragging ? '0 4px 12px rgba(79,70,229,0.15)' : undefined`. (dnd-kit's `transition` already animates snapping — no library change needed.)

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run components/editor/DesignPanel.test.tsx && npx tsc --noEmit`
Expected: PASS — template/layout selection tests query by text labels, which are preserved.

- [ ] **Step 6: Commit**

```bash
git add components/editor/DesignPanel.tsx
git commit -m "feat: visual template thumbnails and layout diagrams in DesignPanel"
```

---

### Task 5: Form fields — shared premium field styles across all forms

**Files:**
- Create: `cv-builder/components/editor/forms/field-styles.ts`
- Modify: every form in `cv-builder/components/editor/forms/` that declares a local `inputClass`/label class: `BasicsForm.tsx`, `WorkForm.tsx`, `EducationForm.tsx`, `SkillsForm.tsx`, `LanguagesForm.tsx`, `VolunteerForm.tsx`, `CustomSectionForm.tsx`, `CertificatesForm.tsx`, `AwardsForm.tsx`, `PublicationsForm.tsx`, `InterestsForm.tsx`, `ProjectsForm.tsx`, `MonthYearPicker.tsx`, `ListFieldManager.tsx`, `RichTextField.tsx` (only where a duplicate input class string exists — check each)
- Test: existing form test files (stay green)

**Interfaces:**
- Consumes: nothing
- Produces: `export const inputClass: string`, `export const labelClass: string` from `forms/field-styles.ts`

**Design decision (locked):** we upgrade focus/hover treatment in place rather than converting to floating labels — floating labels would restructure the label/input DOM across 12 forms and risk the `getByLabelText` queries used throughout the test suite. The premium feel comes from the focus ring glow, soft transitions, and hover borders.

- [ ] **Step 1: Create the shared styles module**

```ts
// cv-builder/components/editor/forms/field-styles.ts
/** Shared premium field styling for all editor forms. DRY source of truth —
 *  do not redeclare per-form input class strings. */
export const inputClass =
  'w-full border border-indigo-200 rounded-lg px-3 py-1.5 text-sm bg-white/70 shadow-sm transition-all duration-200 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:shadow-md placeholder:text-indigo-300'

export const labelClass = 'block text-xs font-medium text-indigo-600 mb-1'
```

- [ ] **Step 2: Replace local class strings in every form**

In each form file: delete the local `const inputClass = '...'` (and inline label class strings where a shared one fits), add `import { inputClass, labelClass } from './field-styles'`, and replace inline `className="block text-xs font-medium text-indigo-600 mb-1"` with `className={labelClass}`. Example for `BasicsForm.tsx` — delete lines 24–25 and add the import; all `className={inputClass}` usages then resolve to the shared constant. Repeat mechanically for every file listed above that has its own copy (grep for `border-indigo-200 rounded-lg` to find them all).

- [ ] **Step 3: Run the full forms test suite + typecheck**

Run: `npx vitest run components/editor/forms && npx tsc --noEmit`
Expected: PASS — class changes only; all labels/placeholders untouched.

- [ ] **Step 4: Commit**

```bash
git add components/editor/forms
git commit -m "refactor: shared premium field styles across all editor forms"
```

---

### Task 6: PreviewTab — hero paper treatment + floating zoom toolbar

**Files:**
- Modify: `cv-builder/components/editor/PreviewTab.tsx`
- Test: `cv-builder/components/editor/PreviewTab.test.tsx` (existing — stay green; toolbar keeps all `data-testid`s: `zoom-in`, `zoom-out`, `zoom-percentage`, `zoom-menu`)

**Interfaces:**
- Consumes: nothing new
- Produces: no API changes

- [ ] **Step 1: Hero paper background and shadow**

- Scroll container (line ~234): `className="h-full overflow-auto bg-white/20 backdrop-blur-sm flex justify-center py-8"` → `"h-full overflow-auto bg-slate-200/60 flex justify-center py-10"`.
- Scaled inner content div (line ~247, the `style` object with `transform: scale(...)`): add a realistic paper treatment by giving the *outer wrapper* (line ~238 `wrapperRef` div) a className: `className="shadow-2xl ring-1 ring-gray-900/10 bg-white"` (keep its `style` object untouched — width/height math must not change).

- [ ] **Step 2: Convert the zoom strip into a floating pill toolbar**

Move the zoom controls block (lines ~146–208) from a bordered header strip into a floating overlay inside the `relative` container (after the pagination badge, line ~230). Replace the outer div of the zoom controls with:

```tsx
<div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 rounded-full bg-white/85 backdrop-blur-md shadow-lg ring-1 ring-indigo-100 px-2 py-1.5">
```

Inside it, keep the three controls exactly as they are (same handlers, testids, aria) but restyle: zoom in/out buttons → `className="flex items-center justify-center min-h-[28px] min-w-[28px] text-sm rounded-full text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"`; the percentage button → same but `px-2 text-xs tabular-nums`. The zoom preset menu opens UPWARD now: change its positioning classes from `top-full mt-1` to `bottom-full mb-1`.

Delete the old header strip wrapper div (`flex items-center justify-end gap-1 px-3 h-9 border-b ...`) — the toolbar now floats over the preview.

- [ ] **Step 3: Run preview tests + typecheck**

Run: `npx vitest run components/editor/PreviewTab.test.tsx && npx tsc --noEmit`
Expected: PASS — tests target testids/aria which are unchanged. If a test asserts on the removed header strip layout, fix the component to preserve the contract or flag to the human partner; do not weaken assertions.

- [ ] **Step 4: Full suite + visual verification**

```bash
npm run test:run
```

Expected: all tests pass (387+). Then start `npm run dev` and verify in the browser: gradient canvas, gliding tab underline, animated accordions with icons, template thumbnails, glowing focus rings, floating zoom pill over a paper-like preview.

- [ ] **Step 5: Commit**

```bash
git add components/editor/PreviewTab.tsx
git commit -m "feat: hero preview pane with paper shadow and floating zoom toolbar"
```

---

## Self-Review (completed)

- **Spec coverage:** Step 1 (shell/resizable) → Task 2 (existing hand-rolled resizable kept per constraint #5, polished); Step 2 (EditTab/Accordion) → Task 3; Step 3 (DesignPanel visual pickers, dnd snapping) → Task 4; Step 4 (form fields) → Task 5 (floating-label variant consciously descoped — documented rationale); Step 5 (preview hero + floating toolbar) → Task 6. 21st MCP research → done at planning time (searches free; code retrieval paid, flagged).
- **Placeholder scan:** clean — every code step shows concrete code or exact class strings and line anchors.
- **Type consistency:** `Collapsible({ open, children })` and `SectionIcon({ section, className })` used identically in Tasks 3–4; `icon?: ReactNode` optional so untouched call sites compile.
