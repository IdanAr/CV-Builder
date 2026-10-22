import React from 'react'
import { describe, it, expect } from 'vitest'
import { CoverLetterPdfTemplate } from '../CoverLetterPdfTemplate'
import type { CoverLetterRenderInput } from '@/lib/coverletter/render-input'
import { renderToBufferAndRuns, fontDiagnostics, lineTexts, lineHasWord, type GlyphRun } from '@/lib/pdf/__tests__/pdf-geometry'

const BASE: CoverLetterRenderInput = {
  content: 'Dear Hiring Manager,\n\nThank you for reading.\n\nSincerely,\nJane Smith',
  design: 'classic',
  language: 'en',
  recipient: [],
  subject: null,
  title: 'Cover Letter',
}

const render = (props: Partial<CoverLetterRenderInput>) =>
  renderToBufferAndRuns(React.createElement(CoverLetterPdfTemplate, { ...BASE, ...props }))

interface Edge { x: number; y: number; w: number; h: number; color: string }

/**
 * The boxes react-pdf strokes a View border into, with their stroke colour, in PDF
 * user space (y up). react-pdf clips to the border box and then strokes a doubled
 * line inside it, so the clip box is the border's real thickness and extent.
 */
async function borderBoxes(buffer: Buffer): Promise<Edge[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise
  const { fnArray, argsArray } = await (await doc.getPage(1)).getOperatorList()
  const OPS = pdfjs.OPS
  const out: Edge[] = []
  let ctm = [1, 0, 0, 1, 0, 0]
  const stack: number[][] = []
  let box: number[] | null = null
  let stroke: string | null = null
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i]
    const args = argsArray[i]
    if (fn === OPS.save) stack.push(ctm)
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm
    else if (fn === OPS.transform) {
      const [a, b, c, d, e, f] = args as number[]
      const [A, B, C, D, E, F] = ctm
      ctm = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F]
    } else if (fn === OPS.setStrokeRGBColor) stroke = String(args[0]).toLowerCase()
    else if (fn === OPS.constructPath) {
      const bbox = args[2] as Record<string, number>
      const [x0, y0, x1, y1] = [bbox[0], bbox[1], bbox[2], bbox[3]]
      if (stroke && box) {
        const ys = [box[1] * ctm[3] + ctm[5], box[3] * ctm[3] + ctm[5]]
        out.push({ x: box[0] + ctm[4], y: Math.min(...ys), w: box[2] - box[0], h: Math.abs(ys[1] - ys[0]), color: stroke })
        stroke = null
      }
      if (x1 > x0 && y1 > y0) box = [x0, y0, x1, y1]
    }
  }
  await doc.destroy()
  return out
}

const rowsOf = (runs: GlyphRun[]) => [...runs].sort((a, b) => b.y - a.y || a.x - b.x)
const joined = (runs: GlyphRun[]) => rowsOf(runs).map((r) => r.str).join(' ')

describe('CoverLetterPdfTemplate', () => {
  it('renders real Hebrew glyphs, not blank/missing characters', async () => {
    const { buffer, runs } = await render({ content: 'שלום עולם', name: 'ישראל ישראלי' })
    const diag = fontDiagnostics(buffer)
    expect(diag.embedded).toBe(true)
    expect(diag.usesBase14).toBe(false)
    const extracted = runs.map((r) => r.str).join('')
    expect(extracted).toContain('שלום')
    expect(extracted).toContain('עולם')
    expect(extracted).toContain('ישראל')
  })

  it('still renders Latin content correctly', async () => {
    const { runs } = await render({ content: 'Dear Hiring Manager, thank you.', name: 'Jane Smith' })
    const text = runs.map((r) => r.str).join(' ')
    expect(text).toContain('Dear Hiring Manager')
    expect(text).toContain('Jane Smith')
  })

  /**
   * The realistic Hebrew letter: Hebrew name and body, a Latin email, a digit
   * date. Hebrew and Latin text get different embedded fonts, and the old
   * @react-pdf/textkit (before 7.x) reordered glyphs across font runs in a
   * right-to-left line, so Hebrew letters were drawn with the Latin font's
   * glyphs (extracted as stray 'a' and 'x'), and digits drew as accent marks.
   * pdfjs reads back the character each glyph was drawn as, so a word that is
   * scrambled on the page is scrambled here too.
   */
  it('keeps every Hebrew word intact next to a Latin email and a digit date', async () => {
    const { buffer, runs } = await render({
      content: 'שלום רב, אני כותבת בנוגע למשרה ב-Acme Corp.',
      name: 'דנה לוי',
      contact: 'חיפה · dana@example.com · 050-0000000',
      date: '21 באוקטובר 2026',
      language: 'he',
    })
    const diag = fontDiagnostics(buffer)
    expect(diag.embedded).toBe(true)
    expect(diag.usesBase14).toBe(false)
    const lineText = lineTexts(runs)
    for (const word of ['באוקטובר', 'שלום', 'כותבת', 'בנוגע', 'למשרה', 'חיפה', 'dana@example.com', 'AcmeCorp']) {
      expect(lineHasWord(lineText, word), `"${word}" is intact in: ${JSON.stringify(lineText)}`).toBe(true)
    }
    expect(lineText.join('')).not.toMatch(/[֐-׿][a-z][֐-׿]/)
  })

  describe.each(['classic', 'accent-edge'] as const)('%s design', (design) => {
    it('reads name, contact, date, recipient, subject, greeting, body, sign-off in order', async () => {
      const { runs } = await render({
        design,
        name: 'Jane Smith',
        contact: 'jane@example.com',
        date: '21 October 2026',
        recipient: ['Pat Doe', 'Acme Corp'],
        subject: 'Re: Engineer, Acme Corp',
        content: 'Dear Pat,\n\nThe body paragraph.\n\nSincerely,\nJane',
      })
      const text = joined(runs)
      const order = ['Jane Smith', 'jane@example.com', '21 October 2026', 'Pat Doe', 'Acme Corp', 'Re: Engineer', 'Dear Pat', 'The body paragraph', 'Sincerely']
      const at = order.map((s) => text.indexOf(s))
      expect(at.every((i) => i >= 0), JSON.stringify(text)).toBe(true)
      expect([...at].sort((a, b) => a - b)).toEqual(at)
    })

    it('renders a "- " block as bullet rows in order with no literal "- "', async () => {
      const { runs } = await render({
        design,
        content: 'Dear Pat,\n\n- First item\n- Second item\n- Third item\n\nSincerely,\nJane',
      })
      const rows = rowsOf(runs)
      const bullets = rows.filter((r) => r.str.includes('•'))
      expect(bullets).toHaveLength(3)
      const items = ['First item', 'Second item', 'Third item'].map((s) => rows.find((r) => r.str.includes(s)))
      expect(items.every(Boolean)).toBe(true)
      const ys = items.map((r) => r!.y)
      expect(ys[0]).toBeGreaterThan(ys[1])
      expect(ys[1]).toBeGreaterThan(ys[2])
      // Same row as its bullet, and the text is indented past the bullet.
      items.forEach((item, i) => {
        expect(Math.abs(item!.y - bullets[i].y)).toBeLessThan(1)
        expect(item!.x).toBeGreaterThan(bullets[i].x + bullets[i].width)
      })
      expect(joined(runs)).not.toMatch(/(^|\s)- /)
    })

    it('renders no "Re:" for a null subject and no extra line for an empty recipient', async () => {
      const withNone = await render({ design, name: 'Jane Smith', date: '21 October 2026' })
      expect(joined(withNone.runs)).not.toContain('Re:')
      const withBoth = await render({
        design,
        name: 'Jane Smith',
        date: '21 October 2026',
        recipient: ['Acme Corp'],
        subject: 'Re: Engineer, Acme Corp',
      })
      const lines = (r: GlyphRun[]) => new Set(r.map((x) => Math.round(x.y))).size
      expect(lines(withBoth.runs)).toBe(lines(withNone.runs) + 2)
    })

    it('makes the name larger at fontScale 1.1 than at 1', async () => {
      const heightOf = async (fontScale: number) => {
        const { runs } = await render({ design, name: 'Jane Smith', fontScale })
        return runs.find((r) => r.str.includes('Jane Smith'))!.height
      }
      expect(await heightOf(1.1)).toBeGreaterThan(await heightOf(1))
    })

    it('still renders with an unregistered header font and an invalid accent colour', async () => {
      const { buffer, runs } = await render({ design, name: 'Jane Smith', headerFont: 'No Such Font', accentColor: 'not-a-colour' })
      expect(buffer.byteLength).toBeGreaterThan(0)
      expect(runs.some((r) => r.str.includes('Jane Smith'))).toBe(true)
    })

    it('uses the title prop as the document title', async () => {
      const { buffer } = await render({ design, title: 'Cover Letter - Engineer - Acme' })
      expect(buffer.toString('latin1')).toContain('/Title')
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise
      const meta = (await doc.getMetadata()).info as { Title?: string }
      await doc.destroy()
      expect(meta.Title).toBe('Cover Letter - Engineer - Acme')
    })
  })

  it('accent edge draws a vertical bar in the accent colour at the header block\'s left edge', async () => {
    const { buffer, runs } = await render({ design: 'accent-edge', name: 'Jane Smith', contact: 'jane@example.com', accentColor: '#c0392b' })
    const bars = (await borderBoxes(buffer)).filter((r) => r.color === '#c0392b' && r.h > r.w)
    expect(bars.length).toBeGreaterThan(0)
    const bar = bars[0]
    expect(bar.w).toBeCloseTo(4, 0)
    const name = runs.find((r) => r.str.includes('Jane Smith'))!
    const contact = runs.find((r) => r.str.includes('jane@example.com'))!
    expect(name.x).toBeGreaterThan(bar.x + bar.w - 0.5)
    // The bar spans both header lines.
    expect(bar.y).toBeLessThanOrEqual(contact.y)
    expect(bar.y + bar.h).toBeGreaterThanOrEqual(name.y)
  })

  it('classic draws a thin horizontal rule in the accent colour under the centred header', async () => {
    const { buffer, runs } = await render({ design: 'classic', name: 'Jane Smith', contact: 'jane@example.com', accentColor: '#c0392b' })
    const rules = (await borderBoxes(buffer)).filter((r) => r.color === '#c0392b' && r.w > r.h)
    expect(rules.length).toBeGreaterThan(0)
    const rule = rules[0]
    expect(rule.h).toBeCloseTo(1, 0)
    const contact = runs.find((r) => r.str.includes('jane@example.com'))!
    expect(rule.y + rule.h).toBeLessThan(contact.y)
    // Centred: the name sits near the middle of the A4 page (595pt).
    const name = runs.find((r) => r.str.includes('Jane Smith'))!
    expect(name.x + name.width / 2).toBeGreaterThan(595 / 2 - 5)
    expect(name.x + name.width / 2).toBeLessThan(595 / 2 + 5)
  })
})
