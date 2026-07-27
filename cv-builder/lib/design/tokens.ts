/**
 * Single source for the spacing and size values the web preview and the PDF
 * export must agree on. Declared in points because that is the PDF's native
 * unit; the web consumes them through px().
 *
 * Previously these lived twice — '10px' in the web template and 7.5 in the PDF
 * template — and agreed only by hand-conversion.
 */

const PX_PER_PT = 96 / 72

export function px(value: number): string {
  return `${Math.round(value * PX_PER_PT)}px`
}

export function pt(value: number): number {
  return value / PX_PER_PT
}

export const MINIMAL_TOKENS = {
  headerMarginBottom: 15,   // web 20px
  summaryMarginBottom: 12,  // web 16px
  entryMarginBottom: 7.5,   // web 10px
  eduMarginBottom: 6,       // web 8px
  projectMarginBottom: 8,   // web ~11px
  sectionTitleMarginTop: 15,
  sectionTitleMarginBottom: 6,
  bulletIndent: 13.5,       // web ul padding-left 18px
  bulletGap: 4.5,           // gap between marker and text
  nameSize: 22,
  labelSize: 11,
  contactSize: 10,
  bodySize: 10,
  sectionTitleSize: 10,
} as const

// Extract the same shape for the remaining four pairs from their existing
// literals, per the invariant in this task's header. Keys that do not apply to
// a template are simply omitted; do not invent values to fill the shape.

export const CLASSIC_TOKENS = {
  headerMarginBottom: 12,       // web 16px
  summaryMarginBottom: 9,       // web 12px (two-column summary only; single-column has no margin here)
  entryMarginBottom: 7.5,       // web 10px
  eduMarginBottom: 6,           // web 8px
  projectMarginBottom: 8,       // web 10px — pre-existing drift, see task-5-report.md
  sectionTitleMarginTop: 13.5,  // web 18px
  sectionTitleMarginBottom: 6,  // web 8px
  bulletIndent: 13.5,           // web ul padding-left 18px
  nameSize: 20,
  labelSize: 12,
  contactSize: 10,
  bodySize: 10,
  sectionTitleSize: 13,
} as const

export const MODERN_TOKENS = {
  // No headerMarginBottom: the header block uses padding, not a trailing margin.
  summaryMarginBottom: 9,        // web 12px
  entryMarginBottom: 7.5,        // web 10px
  eduMarginBottom: 6,            // web 8px
  projectMarginBottom: 8,        // web 10px — pre-existing drift, see task-5-report.md
  sectionTitleMarginTop: 12,     // web 16px
  sectionTitleMarginBottom: 6,   // web 8px
  bulletIndent: 13.5,            // web ul padding-left 18px
  nameSize: 22,
  labelSize: 12,
  contactSize: 10,
  bodySize: 10,
  sectionTitleSize: 12,
} as const

export const EXECUTIVE_TOKENS = {
  headerMarginBottom: 3,         // web 4px
  // Applied as marginTop (not marginBottom) in this template — the summary
  // sits below the double rule/contact block rather than above a following
  // section — but the shared value and correspondence rule are identical.
  summaryMarginBottom: 9,        // web 12px
  entryMarginBottom: 7.5,        // web 10px
  eduMarginBottom: 6,            // web 8px
  projectMarginBottom: 8,        // web 10px — pre-existing drift, see task-5-report.md
  sectionTitleMarginTop: 13.5,   // web 18px
  sectionTitleMarginBottom: 5.25, // web 7px
  bulletIndent: 13.5,            // web ul padding-left 18px
  nameSize: 22,
  labelSize: 12,
  contactSize: 10,
  bodySize: 10,
  sectionTitleSize: 11.5,
} as const

export const SIDEBAR_TOKENS = {
  // No headerMarginBottom: rail name/label/contact flow directly into rail
  // sections with no separate trailing margin.
  summaryMarginBottom: 4.5,      // web 6px (main-column summary)
  entryMarginBottom: 7.5,        // web 10px
  eduMarginBottom: 6,            // web 8px
  projectMarginBottom: 8,        // web 10px — pre-existing drift, see task-5-report.md
  // Main-column section title only. The rail has a second, differently-sized
  // section title (marginTop 13.5/marginBottom 5.25, fontSize 12) that the
  // shared shape has no second slot for; left as template-local literals.
  sectionTitleMarginTop: 12,      // web 16px
  sectionTitleMarginBottom: 6,    // web 8px
  bulletIndent: 13.5,             // web ul padding-left 18px
  nameSize: 18,                   // rail name
  labelSize: 10.5,                // rail label
  contactSize: 10,
  bodySize: 10,
  sectionTitleSize: 12,           // main-column section title
} as const
