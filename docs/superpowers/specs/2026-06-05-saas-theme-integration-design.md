# Design Spec: Full SaaS Theme Integration

**Date:** 2026-06-05  
**Status:** Approved  

---

## Overview

Apply the indigo/purple light SaaS visual theme — sourced from `components/ui/light-saas-hero-section.tsx` — to every surface of the CV Builder application. This includes the sign-in page, dashboard, and the full editor interior (shell, form panels, accordion sections, design panel, ATS panel, AI button).

---

## Visual Language

All UI surfaces adopt the following consistent token set:

| Token | Value |
|---|---|
| Page background | Plasma WebGL animation (`Plasma` component, `color="#4f46e5"`, `opacity=0.15`) + static `bg-gradient-to-br from-indigo-50 via-purple-50 to-white` fallback |
| Glass panels / cards | `bg-white/60 backdrop-blur-xl border border-white/30 shadow-lg rounded-xl` |
| Primary button | `bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium` |
| Secondary / ghost button | `border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg font-medium` |
| Destructive button | `border border-red-300 text-red-600 hover:bg-red-50 rounded-lg` (unchanged) |
| Text inputs | `bg-white/70 border border-indigo-200 focus:ring-2 focus:ring-indigo-500 rounded-lg` |
| Section headings | `text-indigo-900 font-bold` |
| Secondary labels | `text-indigo-600` |
| Accent dividers | `border-indigo-100` |

The CV preview canvas (the paper mock rendered inside the editor) stays white — it is a document surface, not a UI surface.

---

## New Shared Components

### `components/ui/PlasmaBackground.tsx`
- Extracted from `light-saas-hero-section.tsx`
- Client component (`"use client"`)
- Renders `<Plasma>` full-bleed behind `children` with a gradient overlay (`bg-gradient-to-b from-white/30 to-white/60`) for text readability
- Props: optional `opacity` override (default `0.15`), `children: React.ReactNode`
- Used by every page layout

### `components/ui/AppNavbar.tsx`
- Client component (`"use client"`) to support sign-out action
- Full-width frosted glass bar: `bg-white/55 backdrop-blur-xl border-b border-white/30`
- Left slot: logo mark + "CV Builder" gradient wordmark
- Right slot: accepts `actions` prop (`React.ReactNode`) — callers pass their own buttons (e.g. "+ New CV" on dashboard, "← Back + Export PDF" on editor)
- No mobile hamburger needed for the editor; dashboard inherits the existing responsive pattern

---

## Modified Files

### 1. `app/globals.css`
- Remove the `prefers-color-scheme: dark` block — the theme is light-only
- Set `font-family` to `Inter, system-ui, sans-serif` (ATS-safe, closest to Lato/Calibri)

### 2. `app/layout.tsx`
- Remove `bg-white text-gray-900` from `<body>` — background is now owned per-layout via `PlasmaBackground`

### 3. `app/(auth)/signin/page.tsx`
- Wrap content in `<PlasmaBackground>`
- Replace the plain gray card with a frosted glass card (`bg-white/70 backdrop-blur-xl border border-white/30 shadow-xl rounded-2xl`)
- Add logo mark above the title
- Style Google/GitHub buttons: Google keeps its border style, GitHub gets `bg-gray-900`; both get `rounded-lg` and match padding

### 4. `app/(dashboard)/layout.tsx`
- Wrap the full layout in `<PlasmaBackground>`
- Remove the plain `<nav>` entirely — each child page/component renders its own `<AppNavbar>` with the correct actions for that context
- Remove `bg-gray-50` from the layout wrapper — plasma provides the background
- Keep `max-w-4xl` content constraint on the `<main>` wrapper

### 5. `app/(dashboard)/dashboard/page.tsx`
- Add `<AppNavbar>` at the top with Upload CV + New CV buttons as `actions`
- Move the Upload CV / New CV buttons out of the inline header and into `AppNavbar actions`

- Update the "My CVs" heading to `text-2xl font-bold text-indigo-900`
- Update the empty-state border/background: `border-indigo-100 bg-white/50 backdrop-blur-sm`
- Empty-state text: `text-indigo-400`

### 6. `components/ResumeCard.tsx`
- Restyle outer container: `bg-white/65 backdrop-blur-xl border border-white/30 shadow-lg rounded-xl`
- "Open" button: `border-indigo-300 text-indigo-700 hover:bg-indigo-50`
- Metadata divider: `border-indigo-100`
- Metadata labels: `text-indigo-400 uppercase tracking-wide text-xs`
- Metadata values: `text-indigo-900`
- Format score colours unchanged (green/yellow/red)

### 7. `components/NewResumeButton.tsx`
- Restyle: `bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium shadow-sm`

### 8. `components/UploadCVButton.tsx`
- Restyle: `border border-indigo-300 text-indigo-700 hover:bg-indigo-50 rounded-lg px-4 py-2 text-sm font-medium`

### 9. `app/(dashboard)/dashboard/resumes/[id]/page.tsx`
- No changes needed — plasma background is inherited from `(dashboard)/layout.tsx`
- `AppNavbar` with back link ("← My CVs") and Export PDF button is rendered inside `EditorShell` (see #10)

### 10. `components/editor/EditorShell.tsx`
- Add `<AppNavbar>` at the top with "← My CVs" back link and "Export PDF" button as `actions`
- Remove any plain white/gray background wrapper
- Tab bar (Edit / Preview / Design): `bg-white/60 backdrop-blur-sm border-b border-indigo-100`, active tab: `text-indigo-600 border-b-2 border-indigo-600`

### 11. `components/editor/EditTab.tsx`
- Panel wrapper: `bg-white/60 backdrop-blur-xl border border-white/30 rounded-xl`

### 12. `components/editor/AccordionSection.tsx`
- Header background: `bg-white/70 hover:bg-white/80`
- Active/open state indicator: indigo chevron
- Section card: `bg-white/60 backdrop-blur-sm border border-indigo-100 rounded-xl`

### 13. `components/editor/DesignPanel.tsx`
- Panel wrapper: `bg-white/60 backdrop-blur-xl border border-white/30 rounded-xl`
- Active template/font selector: `ring-2 ring-indigo-500`

### 14. `components/editor/PreviewTab.tsx`
- Outer frame: `bg-white/60 backdrop-blur-sm border border-white/30 rounded-xl shadow-xl p-4`
- Inner canvas: white (unchanged — paper surface)

### 15. `components/editor/forms/*.tsx` (all form files)
- All `<input>`, `<textarea>`, `<select>`: add `bg-white/70 border-indigo-200 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg`
- All primary action buttons within forms: `bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg`
- All secondary/add buttons (e.g. "+ Add entry"): `border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg`

### 16. `components/ats/AtsScorePanel.tsx`
- Panel: `bg-white/60 backdrop-blur-xl border border-white/30 rounded-xl shadow-lg`
- Score bar: indigo fill for high scores (keep green/yellow/red for actual score colours)

### 17. `components/ai/AiSuggestButton.tsx`
- Restyle: `bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium`

---

## What Is Not Changed

- All API routes (`app/api/**`)
- Auth logic (`lib/auth.ts`)
- Data layer (`lib/api/resumes.ts`, Zod schemas)
- CV template components (`components/templates/*.tsx`) — they render the paper CV
- Test files — no test updates needed for visual-only changes
- The `Plasma` component itself in `light-saas-hero-section.tsx`

---

## Constraints

- `PlasmaBackground` must be a client component; all page layouts that include it must either be client components themselves or wrap it in a client boundary
- Server components (`dashboard/page.tsx`, `signin/page.tsx`) pass children into `PlasmaBackground` — the server component renders the children, the client component wraps the canvas around them. This is the standard Next.js App Router pattern and requires no special handling.
- `AppNavbar` needs `"use client"` only if it contains interactive state (e.g. mobile menu toggle). If it's purely static markup, it can be a server component.
- No new npm packages required — `ogl` is already installed.
