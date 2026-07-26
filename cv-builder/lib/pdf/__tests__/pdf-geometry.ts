// Reads glyph geometry out of a rendered PDF so tests can assert on layout
// rather than on extracted text alone. pdfjs-dist is already present
// transitively via pdf-parse, so this adds no dependency.
import { renderToBuffer } from '@react-pdf/renderer'
import path from 'node:path'
import type React from 'react'

export interface GlyphRun {
  str: string
  x: number
  /** Baseline in PDF user space. Origin is bottom-left: larger y is higher. */
  y: number
  width: number
  height: number
  fontName: string
  /** 1-based page number. */
  page: number
}

/**
 * pdfjs needs the base-14 metrics on disk to parse PDFs that reference them
 * without embedding. Without this it logs `Ensure that the standardFontDataUrl
 * API parameter is provided` for every such document — noise that would repeat
 * across every test built on this harness.
 */
function standardFontDataUrl(): string {
  return `${path.dirname(require.resolve('pdfjs-dist/package.json'))}/standard_fonts/`
}

export async function glyphRunsFromBuffer(buffer: Buffer): Promise<GlyphRun[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: false,
    isEvalSupported: false,
    standardFontDataUrl: standardFontDataUrl(),
  }).promise

  const out: GlyphRun[] = []
  for (let page = 1; page <= doc.numPages; page++) {
    const content = await (await doc.getPage(page)).getTextContent()
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') continue
      out.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
        fontName: item.fontName,
        page,
      })
    }
  }
  await doc.destroy()
  return out
}

export async function renderToBufferAndRuns(
  element: React.ReactElement
): Promise<{ buffer: Buffer; runs: GlyphRun[] }> {
  const buffer = await renderToBuffer(element as React.ReactElement<never>)
  return { buffer, runs: await glyphRunsFromBuffer(buffer) }
}

export async function renderToGlyphRuns(element: React.ReactElement): Promise<GlyphRun[]> {
  return (await renderToBufferAndRuns(element)).runs
}

/** Runs whose baselines differ by less than this are treated as one line. */
const SAME_LINE_TOLERANCE = 0.5

/**
 * Approximate ink extent either side of the baseline, as a fraction of the
 * run's height. Latin faces put roughly three quarters of the em above the
 * baseline (ascenders) and a quarter below (descenders).
 */
const ASCENT_RATIO = 0.75
const DESCENT_RATIO = 0.25

/** Two runs share horizontal space — a precondition for colliding at all. */
function overlapsHorizontally(a: GlyphRun, b: GlyphRun): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
}

/**
 * Two runs on different lines collide when their ink boxes overlap: the lower
 * run's ascenders reach above the upper run's descenders.
 *
 * A ratio-of-font-size heuristic does not work here and was measured to be
 * wrong. For a 22pt name above an 11pt label, @react-pdf produces 2.75pt of
 * baseline separation when broken and 15.40pt when correct — i.e. the *correct*
 * layout reaches only 0.70 of the larger height, so any threshold near 0.9
 * flags good code, and any threshold that clears 0.70 sits a hair above the
 * 0.55 produced by a genuinely overlapping `lineHeight: 1.0`. The ink model
 * separates all three cases with physical meaning and nothing to tune:
 * broken +11.00pt overlap, correct -1.65pt, `lineHeight: 1.0` +1.65pt.
 */
export function findBaselineCollisions(
  runs: GlyphRun[]
): Array<{ a: GlyphRun; b: GlyphRun }> {
  const byPage = new Map<number, GlyphRun[]>()
  for (const run of runs) {
    const list = byPage.get(run.page)
    if (list) list.push(run)
    else byPage.set(run.page, [run])
  }

  const collisions: Array<{ a: GlyphRun; b: GlyphRun }> = []
  for (const pageRuns of byPage.values()) {
    for (const a of pageRuns) {
      // The run directly beneath `a` *in a's own column*. Do not reach for
      // this by sorting the whole page by y and pairing neighbours: in a
      // multi-column template an unrelated run from another column can sort
      // between two genuinely colliding runs, and the real pair then never
      // gets compared. Ask the question per run instead.
      let below: GlyphRun | null = null
      for (const candidate of pageRuns) {
        if (a.y - candidate.y <= SAME_LINE_TOLERANCE) continue // same line or above
        if (!overlapsHorizontally(a, candidate)) continue      // different column
        if (below === null || candidate.y > below.y) below = candidate
      }
      if (below === null) continue

      const upperInkBottom = a.y - a.height * DESCENT_RATIO
      const lowerInkTop = below.y + below.height * ASCENT_RATIO
      if (lowerInkTop > upperInkBottom) collisions.push({ a, b: below })
    }
  }
  return collisions
}

/**
 * Font health, read from the raw PDF bytes.
 *
 * `embedded` accepts any of the three embedded-font-program keys, not just
 * FontFile2: `/FontFile` is Type 1, `/FontFile2` TrueType, `/FontFile3`
 * CFF/OpenType. react-pdf emits FontFile2 today, but a diagnostic that reports
 * "not embedded" for a correctly embedded CFF font is worse than useless.
 *
 * `usesBase14` matches on the *family stem* followed by a word boundary, so it
 * catches every one of the 14 standard faces — Times-Bold, Times-Italic,
 * Times-BoldItalic, Helvetica-Oblique, Courier-BoldOblique, Symbol and
 * ZapfDingbats included. Matching only the literal `Times-Roman` would let a
 * bold serif template that failed to embed slip through as healthy, which is
 * exactly the regression Task 3 uses this to catch. The `\b` also keeps real
 * font names like `TimesNewRomanPSMT` from matching.
 */
export function fontDiagnostics(buffer: Buffer): {
  embedded: boolean
  hasToUnicode: boolean
  usesBase14: boolean
} {
  const raw = buffer.toString('latin1')
  return {
    embedded: /\/FontFile[23]?[\s/>]/.test(raw),
    hasToUnicode: /\/ToUnicode[\s/>]/.test(raw),
    usesBase14:
      /\/BaseFont\s*\/(?:[A-Z]{6}\+)?(?:Helvetica|Times|Courier|Symbol|ZapfDingbats)\b/.test(raw),
  }
}
