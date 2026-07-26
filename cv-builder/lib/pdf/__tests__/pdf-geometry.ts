// Reads glyph geometry out of a rendered PDF so tests can assert on layout
// rather than on extracted text alone. pdfjs-dist is already present
// transitively via pdf-parse, so this adds no dependency.
import { renderToBuffer } from '@react-pdf/renderer'
import type React from 'react'

export interface GlyphRun {
  str: string
  x: number
  /** Baseline in PDF user space. Origin is bottom-left: larger y is higher. */
  y: number
  height: number
  fontName: string
  /** 1-based page number. */
  page: number
}

export async function glyphRunsFromBuffer(buffer: Buffer): Promise<GlyphRun[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: false,
    isEvalSupported: false,
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
 * Two runs on *different* lines must be separated by at least
 * `ratio × the taller run's height`. A 22pt name above an 11pt label needs
 * ~19.8pt of separation at the default ratio; the pre-fix templates produce
 * 4.45pt, which is the D1 collision.
 */
export function findBaselineCollisions(
  runs: GlyphRun[],
  ratio = 0.65
): Array<{ a: GlyphRun; b: GlyphRun }> {
  const byPage = new Map<number, GlyphRun[]>()
  for (const run of runs) {
    const list = byPage.get(run.page)
    if (list) list.push(run)
    else byPage.set(run.page, [run])
  }

  const collisions: Array<{ a: GlyphRun; b: GlyphRun }> = []
  for (const pageRuns of byPage.values()) {
    // Descending y == top of page first.
    const sorted = [...pageRuns].sort((l, r) => r.y - l.y)
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      const gap = a.y - b.y
      if (gap <= SAME_LINE_TOLERANCE) continue // same visual line
      if (gap < Math.max(a.height, b.height) * ratio) collisions.push({ a, b })
    }
  }
  return collisions
}

/**
 * Font health, read from the raw PDF bytes. `/FontFile2` marks an embedded
 * TrueType program; base-14 names appear only when nothing was embedded.
 */
export function fontDiagnostics(buffer: Buffer): {
  embedded: boolean
  hasToUnicode: boolean
  usesBase14: boolean
} {
  const raw = buffer.toString('latin1')
  return {
    embedded: /\/FontFile2[\s/>]/.test(raw),
    hasToUnicode: /\/ToUnicode[\s/>]/.test(raw),
    usesBase14: /\/BaseFont\s*\/(?:[A-Z]{6}\+)?(Helvetica|Times-Roman|Courier)[\s/>-]/.test(raw),
  }
}
