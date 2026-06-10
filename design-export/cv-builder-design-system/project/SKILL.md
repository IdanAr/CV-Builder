---
name: cv-builder-design
description: Use this skill to generate well-branded interfaces and assets for CV Builder — an AI-driven résumé builder & ATS-optimization platform — either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, the five ATS-safe CV document templates, and UI kit components for prototyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, résumés, etc.), copy
assets out and create static HTML files for the user to view. If working on production
code, you can copy assets and read the rules here to become an expert in designing with
this brand.

Key facts to orient fast:
- **Two visual registers.** The product UI is indigo/purple **glassmorphism** on **Inter**.
  The CV documents it outputs are **black-on-white, ATS-safe, A4** with one accent color.
- **The CV templates are the point.** Five ship — Classic, Modern, Minimal, Executive,
  Sidebar — as React components in `components/resume/` and as copy-ready print pages in
  `templates/<slug>-cv/`. Each renders from JSON-Resume `{ data, meta }`.
- **Tokens** live in `tokens/` and are reachable from `styles.css`. Use them; don't invent
  colors. Indigo-600 `#4f46e5` is the action color.
- **Icons** are inline outline SVG (2px, Lucide-like) plus a set of Unicode glyphs
  (⠿ ⧉ ⛶ ✓ ✕ ↩ ↪ ✨). No icon font, no emoji decoration.
- The compiled component library is exposed at `window.CVBuilderDesignSystem_1d5ed3` once
  `_ds_bundle.js` is loaded (see any card or template for the load pattern).

If the user invokes this skill without any other guidance, ask them what they want to build
or design, ask a few focused questions (which surface? which CV template? production code
or a quick mock?), and act as an expert designer who outputs HTML artifacts **or**
production code, depending on the need.
