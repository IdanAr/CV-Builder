// Position-aware PDF text reconstruction.
//
// pdf-parse (and pdfjs-dist underneath it) emits text items in whatever order
// the PDF's content stream happens to list them — for a simple single-column
// résumé that's usually top-to-bottom, but for anything laid out with a
// sidebar, cards, or absolutely-positioned blocks (common in résumé-builder
// exports), the stream order can jump all over the visual page: a bullet
// point can appear last in the extracted text even though it sits in the
// middle of the page. Feeding that scrambled text to the AI silently
// corrupts which dates/bullets belong to which role.
//
// This reconstructs reading order from each text item's actual (x, y)
// position instead of trusting stream order: split the page into vertical
// column bands wherever there's a gap in horizontal text coverage that holds
// across the *whole* page height (a real column gutter, not just the blank
// space between a job title and its right-aligned date on one line), then
// within each column read top-to-bottom, left-to-right.

export interface PositionedTextItem {
  str: string
  x: number
  y: number
  w: number
}

// Below this, two items are treated as the same word/glyph run (no
// separator inserted). Above it but below CELL_GAP, a plain space is used.
// Above CELL_GAP, the gap is wide enough to be a visually distinct cell
// (e.g. a job title vs. its right-aligned date) — an AI-parser-friendly tab.
const WORD_GAP = 1.5
const CELL_GAP = 25

// Two items are on the same line when their y differs by less than this.
const LINE_Y_THRESHOLD = 3

// A horizontal gap must span at least this many points, with no text from
// *any* row crossing it, to count as a real column boundary rather than
// incidental whitespace within one row.
const COLUMN_GAP_THRESHOLD = 20

function detectColumnBounds(items: PositionedTextItem[], pageWidth: number): number[] {
  const spans = items
    .map((it): [number, number] => [it.x, it.x + it.w])
    .sort((a, b) => a[0] - b[0])

  const merged: [number, number][] = []
  for (const [start, end] of spans) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1] + 2) {
      last[1] = Math.max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }

  const bounds = [0]
  for (let i = 1; i < merged.length; i++) {
    const gap = merged[i][0] - merged[i - 1][1]
    if (gap >= COLUMN_GAP_THRESHOLD) bounds.push((merged[i][0] + merged[i - 1][1]) / 2)
  }
  bounds.push(pageWidth)
  return bounds
}

function columnToLines(columnItems: PositionedTextItem[]): string[] {
  const sorted = [...columnItems].sort((a, b) => b.y - a.y || a.x - b.x)

  const rows: PositionedTextItem[][] = []
  for (const item of sorted) {
    const currentRow = rows[rows.length - 1]
    if (currentRow && Math.abs(currentRow[0].y - item.y) <= LINE_Y_THRESHOLD) {
      currentRow.push(item)
    } else {
      rows.push([item])
    }
  }

  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x)
    let text = ''
    let prevEnd: number | null = null
    for (const item of row) {
      if (prevEnd !== null) {
        const gap = item.x - prevEnd
        if (gap > CELL_GAP) text += '\t'
        else if (gap > WORD_GAP) text += ' '
      }
      text += item.str
      prevEnd = item.x + item.w
    }
    return text
  })
}

/**
 * Reconstructs a single page's reading-order text from its raw positioned
 * text items. Pure and synchronous so it can be unit-tested directly against
 * synthetic layouts, independent of PDF parsing.
 */
export function reconstructPageText(items: PositionedTextItem[], pageWidth: number): string {
  const nonEmpty = items.filter((it) => it.str.trim().length > 0)
  if (nonEmpty.length === 0) return ''

  const bounds = detectColumnBounds(nonEmpty, pageWidth)
  const blocks: string[] = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const [lo, hi] = [bounds[i], bounds[i + 1]]
    const columnItems = nonEmpty.filter((it) => it.x >= lo - 1 && it.x < hi + 1)
    if (columnItems.length === 0) continue
    blocks.push(columnToLines(columnItems).join('\n'))
  }
  return blocks.join('\n\n')
}

// Must import before 'pdfjs-dist': it references the browser-only DOMMatrix
// global at module-evaluation time. Importing 'pdf-parse/worker' first
// polyfills it in Node — without this, pdfjs-dist crashes on import in
// Vercel's serverless runtime (see pdf-parse's troubleshooting.md #1).
import 'pdf-parse/worker'

/**
 * Extracts a PDF's text in true visual reading order (column-aware,
 * top-to-bottom within each column) rather than the PDF's internal content
 * stream order.
 */
export async function extractLayoutAwareText(buffer: Buffer): Promise<string> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(buffer)
  const doc = await getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise
  try {
    const pages: string[] = []
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const items: PositionedTextItem[] = content.items
        .filter((it): it is Extract<typeof it, { str: string }> => 'str' in it)
        .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width }))
      pages.push(reconstructPageText(items, viewport.width))
    }
    return pages.join('\n\n')
  } finally {
    await doc.destroy()
  }
}
