# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Next.js 14 + TypeScript** AI-driven CV Builder and ATS Optimization Platform. The full product specification lives in `AI CV Builder PRD & Plan.md`. The codebase does not exist yet — this CLAUDE.md documents the architectural decisions made in the PRD so they are followed consistently during implementation.

## Planned Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| State Management | Zustand (debounced, real-time sync between editor and preview) |
| Schema Validation | Zod (wrapping the JSON Resume v1.0.0 standard) |
| PDF Export | `@react-pdf/renderer` |
| DOCX Export | `docx` npm package |
| AI APIs | Anthropic (Claude), OpenAI/GPT-4o, Groq (fast inference) |
| Database | MongoDB or PostgreSQL (TBD at implementation time) |

## Core Architecture Decisions

### Data Model
The **JSON Resume schema v1.0.0** is the single source of truth for all CV data. The application state has two parallel trees:
- **Document Data Tree** — the JSON Resume payload (basics, work, education, skills, etc.)
- **Document Design Tree** — metadata: template ID, font family, colors, margins, spacing

These two trees are strictly decoupled. Visual template switching must never lose or corrupt career data.

The schema is extended with a `meta` wrapper object on top of the JSON Resume standard to persist design state alongside career data.

### State and Live Preview
- Every editor keystroke updates the Data Tree immediately.
- A **debounced** re-render fires for the live preview (HTML/CSS mirror of the PDF — not an actual PDF render).
- The real PDF binary is only compiled on explicit user export/print. Do not trigger `@react-pdf/renderer` on every keystroke.

### PDF Export Rules (`@react-pdf/renderer`)
- Use semantic tags (`<H1>`, `<H2>`, `<P>`) for every text block — no raw unstyled text nodes.
- For multi-column layouts: render column 1 completely top-to-bottom, then column 2. Never render horizontally across columns.
- Decorative elements (dividers, background shapes, icons) must be tagged as PDF "Artifacts" so parsers and screen readers skip them.
- Never use `window.print()` for PDF generation.

### DOCX Export Rules (`docx` npm package)
- Use only native paragraph styling, line spacing, and document margins.
- **Never** use Word text boxes, floating objects, or nested layout tables — ATS parsers cannot read them.
- Map custom web fonts to the nearest system font (e.g., Lato → Arial/Calibri).

### AI Agent Architecture ("Teacher-Student Council")
Three-agent pipeline for all AI content generation:
1. **Generation Agent** (Student) — drafts content from terse user input.
2. **Critique Agent** (Teacher) — validates: metrics present, active tone, ATS vocabulary, no hallucinations.
3. **Refinement Agent** — applies corrections and produces the final output.

Route fast/cheap tasks (grammar check, real-time suggestions) to Groq. Route complex tasks (full document tailoring, tone matching) to Claude or GPT-4o.

**Hallucination guard:** Any AI-generated metric or skill not present in the user's original input must be highlighted in the UI for explicit user approval before being committed to the JSON schema.

### ATS Scoring Engine
Scores 0–100 across four vectors:
1. Format & Structure Integrity
2. Keyword Density & Exact Match (literal string matching, not semantic)
3. Strategic Keyword Placement (summary and recent job titles weighted higher)
4. Metric & Outcome Presence (penalize duty-based bullets without numbers)

### Typography Constraints (enforced in UI, not just recommended)
- Name headers: 18–22pt
- Section headers: 12–14pt
- Body text: 10–12pt
- Minimum page margins: 0.5 inches (hard constraint — never allow lower)
- Line spacing: 1.0–1.15 range only
- Only offer ATS-safe fonts: Tier 1 (Calibri, Arial, Helvetica, Garamond, Cambria, Georgia) and Tier 2 (Lato, Roboto, IBM Plex Sans)

## Implementation Phases

| Phase | Focus |
|-------|-------|
| 1 | Foundation: DB setup, Zod schemas, JSON Resume types, auth, CRUD |
| 2 | Layout engine: drag-and-drop editor, typography/margin controls, PDF + DOCX pipelines |
| 3 | AI integration: multi-model agent chain, ATS scoring engine |
| 4 | QA, accessibility audits, PDF tag verification, load testing, beta |

## Key Constraints to Enforce in Every Phase

- The visual layer is a **consumer** of JSON data — it never owns or transforms the schema.
- ATS compliance is a hard requirement, not an afterthought. Multi-column visual layouts must not break linear reading order in exported files.
- The platform must decouple "pretty" (visual) from "parseable" (structural) — this is the core value proposition.
