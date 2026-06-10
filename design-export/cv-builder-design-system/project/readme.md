# CV Builder — Design System

A design system for **CV Builder**, an AI-driven résumé builder and ATS-optimization
platform. The product lets job-seekers compose a CV from structured JSON-Resume data,
preview it live across multiple document templates, tune typography/color/spacing, score
it against a pasted job description (ATS), and export to PDF / DOCX / JSON.

This system captures **two distinct visual worlds** and the bridge between them:

1. **The product UI** — an indigo/purple, glassmorphic web app (the dashboard, the
   split-pane editor, sign-in). Built on **Inter**.
2. **The CV documents it produces** — neutral, print-true, ATS-safe résumé layouts on a
   fixed A4 canvas. Five templates ship: **Classic, Modern, Minimal, Executive, Sidebar.**

> **The core deliverable is the CV templates.** They exist both as runtime React
> components (`components/resume/`) and as copy-ready starter artifacts (`templates/`).

---

## Sources

This system was reverse-engineered from the product's own codebase and PRD. If you have
access, explore them to build even more faithfully:

- **GitHub:** [`IdanAr/CV-Builder`](https://github.com/IdanAr/CV-Builder) — the Next.js 14
  app. Key files: `components/templates/{Classic,Modern,Minimal}Template.tsx`,
  `components/editor/DesignPanel.tsx`, `components/editor/EditorShell.tsx`,
  `components/ats/AtsScorePanel.tsx`, `lib/schemas/resume.zod.ts`, `app/globals.css`.
- **Local codebase:** `CV Builder/cv-builder/` (mounted) — same project.
- **PRD:** `CV Builder/AI CV Builder PRD & Plan.md` — vision, ATS rules, font tiers,
  export pipeline, JSON-Resume schema.

Fonts shipped in-repo: `GeistMonoVF.woff` (mono). Everything else loads from Google Fonts.

---

## Content Fundamentals

How CV Builder writes, in two registers:

**Product UI copy** — plain, calm, second person, sentence case. Labels are short nouns
or verbs: *"My CVs", "New CV", "Upload CV", "Live Preview", "Analyze", "Saved", "Page
margins", "Section columns"*. Status is terse and literal: *"Saving…", "● Unsaved",
"Saved"*. Helper text is a quiet aside in muted indigo: *"Paste the full job description
here to see how well your CV matches…"*, *"⠿ drag to reorder · click badge to switch
column"*. Empty states are gentle and instructive: *"No CVs yet." / "Click "+ New CV" to
get started."* AI is signposted, never hyped — a small *"✨ AI"* affordance, and any
AI-invented metric is flagged for the user to verify (hallucination guard). No marketing
voice inside the app; no exclamation points; **no emoji** beyond the occasional functional
glyph (✓ ✕ ↩ ↪ ⛶ ⧉ ⠿ ↓ ↑).

**CV document content** — impact-first résumé prose. Bullets open with a strong past-tense
verb and carry a metric: *"Drove a 34% increase in onboarding completion by redesigning
the account-funding flow."* Dates render as `Mon YYYY – Mon YYYY` (en-dash), with
`Present` for current roles. The tone is confident, specific, quantified — the ATS scorer
actively penalizes vague duty-based phrasing.

Casing: UI uses Sentence case; section titles inside CVs vary by template (Title Case,
UPPERCASE tracked, or small-caps). Voice is **you** in the app, **implied first person**
(no pronouns) in the résumé.

---

## Visual Foundations

**Color.** The app hue is **indigo** (`--indigo-600 #4f46e5` is the action color),
partnered with **purple** (`--purple-600`) for the signature `indigo→purple` gradient on
logos, wordmarks, and avatars. Backgrounds are a faint violet wash (`--app-bg #f5f3ff`),
sometimes with soft radial color blooms. CV documents drop all of this for **black ink on
white paper** with one user-chosen accent (default `#2563eb`), because color must survive
ATS parsing and B&W printing.

**Typography.** App = **Inter** (12→60px). CVs = ATS-safe families exposed in the Design
panel, in two tiers: Tier 1 system faces (Calibri, Arial, Helvetica, Garamond, Cambria,
Georgia) and Tier 2 webfonts (Lato, Roboto, IBM Plex Sans). Document type is constrained
to professional ranges — name 18–22pt, section headers 12–14pt, body 10–12pt, line height
1.0–1.15 — enforced as hard limits in the real app. Mono is **Geist Mono** (hex fields,
metadata).

**Surfaces & glass.** The app's signature is **glassmorphism**: `rgba(255,255,255,0.55–
0.70)` fills, `backdrop-filter: blur(20px)`, hairline white borders
(`rgba(255,255,255,0.30)`), and soft **indigo-tinted shadows** (never neutral grey). Cards
are `radius-xl (12px)`, modals/hero `radius-2xl (16px)`, pills/avatars `radius-full`. The
nav is a frosted bar with the logo absolutely centered.

**Depth.** Shadows are cool and diffuse (`0 10px 25px rgba(49,46,129,.10)`), plus a
`--shadow-glow` indigo halo for emphasis. No hard borders where a soft shadow will do.

**Spacing.** 4px base scale. Generous panel padding (20–24px), 16px gaps between cards.
The editor is a resizable split: frosted control panel (Edit/Design/ATS tabs) + a live A4
preview that letterboxes and scales to fit, with dashed page-break indicators.

**Motion & states.** Restrained. `transition` on color/background/shadow at 150–200ms,
`--ease-out` curve. Hover = a step lighter/darker (primary → `indigo-700`; secondary →
`indigo-50` tint). Active controls gain an `indigo-50` fill + colored border or an
underline. Disabled = 50% opacity. No bounces, no decorative looping animation. The only
ambient motion is the optional WebGL "plasma" field behind the marketing/sign-in
backdrop, at ~15% opacity.

**Imagery.** There is essentially no photography. The brand is built from the logo glyph,
the gradient, glass, and the résumé documents themselves. Avatars fall back to gradient
initials.

---

## Iconography

CV Builder has **no icon font and no icon library**. Icons are **inline SVG**, drawn ad
hoc in components at `stroke-width: 2`, `viewBox 0 0 24 24`, no fill (Feather/Lucide-like
outline style) — e.g. the gear, document, and sign-out glyphs in the profile menu, and the
chevron on dropdowns. Brand OAuth marks (Google, GitHub) are inline multi-path SVGs.

For everything else the app uses **Unicode glyphs as icons**, which you should reuse for
fidelity rather than importing an icon set:

| Glyph | Meaning | Glyph | Meaning |
|------|---------|------|---------|
| `⠿` | drag handle | `⛶` | expand preview |
| `⧉` | duplicate | `✕` | delete / close |
| `↩ ↪` | undo / redo | `✓` | matched / done |
| `↓ ↑` | download / upload | `▾` | dropdown |
| `●` | section / unsaved | `✨` | AI affordance |

**Emoji are not used** as decoration. If you need an outline icon the app doesn't already
draw, substitute **Lucide** (same 2px outline style) via CDN and keep it monochrome —
flagged as a substitution. Never hand-draw decorative illustrations; the brand is
deliberately spare.

**Logo.** The mark is a violet hexagon "network node" with a small white star at its
centre and six light-violet satellite dots connected by faint links — see
`assets/logo.svg` and the `Logo` component. Always on the `indigo→purple` gradient; the
wordmark "CV Builder" uses the same gradient as clipped text.

---

## Index / Manifest

**Root**
- `styles.css` — the single entry point consumers link (`@import` manifest only).
- `tokens/` — `colors.css`, `typography.css`, `spacing.css` (CSS custom properties).
- `fonts/fonts.css` — Google Fonts import + Geist Mono `@font-face`.
- `assets/` — `logo.svg`, `favicon.ico`, `fonts/GeistMonoVF.woff`.
- `SKILL.md` — Agent Skill manifest (for use in Claude Code).

**Components** (`components/`, namespace `window.CVBuilderDesignSystem_1d5ed3`)
- `resume/` — **the CV templates**: `ClassicResume`, `ModernResume`, `MinimalResume`,
  `ExecutiveResume`, `SidebarResume` (+ `resumeShared` helpers, `SampleResume` /
  `SampleMeta` data). Each takes `{ data, meta }`.
- `core/` — `Button`, `Badge`, `Input`, `Select`, `GlassCard`, `Tabs`, `RangeSlider`,
  `ScoreBar`, `Avatar`.
- `brand/` — `Logo`.
- `effects/` — `PlasmaBackground` (the animated WebGL sign-in / hero backdrop).

**UI kit** (`ui_kits/cv-builder/`) — interactive click-through of the product:
sign-in → dashboard (My CVs) → editor (Edit / Design / ATS + live preview). `index.html`
plus `kit-screens.jsx`, `kit-editor.jsx`.

**Templates** (`templates/`) — copy-ready résumé starter folders, one per CV design:
`classic-cv`, `modern-cv`, `minimal-cv`, `executive-cv`, `sidebar-cv`. Each is a
print-ready A4 page loading the bundle via `ds-base.js`, with **native export to both PDF
and DOCX** via `ds-export.js`: PDF uses an A4 print pipeline (`@page size:A4`,
color-accurate banners via `print-color-adjust`), and DOCX builds a real Word document
with the `docx` library — native paragraphs, headings, bullets and tab-aligned dates, no
text boxes or layout tables, so it stays ATS-readable. Swap the inline `resume-data` JSON
and export.

**Specimen cards** (`guidelines/`) — the Design System tab gallery: color ramps, type
specimens, spacing/radii/shadows, glass.

**Starting points** — the five CV templates are registered seeds (section "CV Templates").

---

### Font substitution note
`Calibri` and `Cambria` are Microsoft system fonts with no free webfont. On machines
without Office installed they fall back to **Carlito** (a Calibri metric clone) → Inter,
and **Source Serif 4** respectively. If you need exact Office fidelity in exports, upload
the licensed font files. All other families load from Google Fonts.
