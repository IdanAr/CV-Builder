import { describe, it, expect } from 'vitest'
import { reconstructPageText, type PositionedTextItem } from '../pdf-layout-text'

describe('reconstructPageText', () => {
  it('returns empty string for no items', () => {
    expect(reconstructPageText([], 600)).toBe('')
  })

  it('reads a single-column page top-to-bottom in stream order regardless of item order', () => {
    // Deliberately shuffled — stream order must not matter, only position.
    const items: PositionedTextItem[] = [
      { str: 'Line three', x: 40, y: 700, w: 60 },
      { str: 'Line one', x: 40, y: 740, w: 50 },
      { str: 'Line two', x: 40, y: 720, w: 50 },
    ]
    expect(reconstructPageText(items, 600)).toBe('Line one\nLine two\nLine three')
  })

  it('joins items on the same line with a space for a normal word gap', () => {
    const items: PositionedTextItem[] = [
      { str: 'Hello', x: 40, y: 700, w: 30 },
      { str: 'world', x: 74, y: 700, w: 30 }, // gap = 74 - 70 = 4pt, a normal word gap
    ]
    expect(reconstructPageText(items, 600)).toBe('Hello world')
  })

  it('does not insert a separator for a near-zero gap (split glyph run)', () => {
    const items: PositionedTextItem[] = [
      { str: 'Appli', x: 40, y: 700, w: 20 },
      { str: 'ed', x: 60.5, y: 700, w: 10 }, // gap = 0.5pt
    ]
    expect(reconstructPageText(items, 600)).toBe('Applied')
  })

  it('joins a title and its right-aligned date on the same line with a tab, not a space', () => {
    const items: PositionedTextItem[] = [
      { str: 'Acme Corp', x: 40, y: 700, w: 60 },
      { str: '2020-2022', x: 480, y: 700, w: 50 }, // gap = 480 - 100 = 380pt, way past CELL_GAP
      // A wide-spanning line elsewhere in the same column so the gap above
      // reads as an intra-row date alignment, not a persistent column gutter.
      { str: 'A bullet line spanning most of the column width right here', x: 40, y: 680, w: 500 },
    ]
    expect(reconstructPageText(items, 600)).toBe(
      'Acme Corp\t2020-2022\nA bullet line spanning most of the column width right here'
    )
  })

  it('reads a two-column layout column-by-column, not interleaved by absolute y', () => {
    // A sidebar (x ~ 20-90) and a main column (x ~ 200-560), with a
    // persistent gutter between them across the whole page height — the
    // items are given in an order that would produce garbage if sorted by
    // y alone (sidebar and main content interleaved line-by-line).
    const items: PositionedTextItem[] = [
      { str: 'CONTACT', x: 20, y: 780, w: 50 },
      { str: 'Main Heading', x: 200, y: 700, w: 80 },
      { str: 'phone@example.com', x: 20, y: 760, w: 100 },
      { str: 'Body line one', x: 200, y: 680, w: 80 },
      { str: 'SKILLS', x: 20, y: 600, w: 50 },
      { str: 'Body line two', x: 200, y: 660, w: 80 },
    ]
    const text = reconstructPageText(items, 600)
    // Both columns present, each internally top-to-bottom, not interleaved.
    const sidebarIdx = text.indexOf('CONTACT')
    const phoneIdx = text.indexOf('phone@example.com')
    const skillsIdx = text.indexOf('SKILLS')
    const headingIdx = text.indexOf('Main Heading')
    const line1Idx = text.indexOf('Body line one')
    const line2Idx = text.indexOf('Body line two')
    expect(sidebarIdx).toBeGreaterThanOrEqual(0)
    expect(phoneIdx).toBeGreaterThan(sidebarIdx)
    expect(skillsIdx).toBeGreaterThan(phoneIdx)
    expect(headingIdx).toBeGreaterThan(-1)
    expect(line1Idx).toBeGreaterThan(headingIdx)
    expect(line2Idx).toBeGreaterThan(line1Idx)
  })

  it('does not split columns on the gap between a title and its own right-aligned date within one row', () => {
    // A single main column where every row leaves a visual gap before its
    // right-aligned date — that gap must NOT be mistaken for a persistent
    // column gutter, since other rows' body text crosses through it.
    const items: PositionedTextItem[] = [
      { str: 'Company A', x: 40, y: 700, w: 60 },
      { str: '2020-2022', x: 480, y: 700, w: 50 },
      { str: 'This bullet line runs all the way across the full column width here', x: 40, y: 680, w: 500 },
    ]
    const text = reconstructPageText(items, 600)
    expect(text).toBe(
      'Company A\t2020-2022\nThis bullet line runs all the way across the full column width here'
    )
  })

  it('regression: a role title separated from its company in stream order by unrelated content still lands between the company and the next role, by position', () => {
    // Mirrors the real-world bug this module fixes: "GIS Developer" and its
    // bullet are emitted last in the PDF's content stream (after unrelated
    // Education content that sits lower on the page), even though visually
    // it sits between "Via Transportation" and "Routing Maps Specialist".
    const items: PositionedTextItem[] = [
      { str: 'Via Transportation', x: 236, y: 557, w: 100 },
      { str: '2021-PRESENT', x: 497, y: 555, w: 60 },
      { str: 'Routing Maps Specialist', x: 237, y: 493, w: 120 },
      { str: 'Applied advanced mapping techniques', x: 253, y: 478, w: 200 },
      { str: 'Education', x: 235, y: 166, w: 60 }, // unrelated, lower on the page
      { str: 'MIT', x: 237, y: 132, w: 30 }, // unrelated, lower on the page
      // Emitted last in the stream, but positioned between the two roles above.
      { str: 'GIS Developer', x: 237, y: 544, w: 90 },
      { str: 'Developed automation and testing flows', x: 251, y: 530, w: 200 },
    ]
    const text = reconstructPageText(items, 600)
    const viaIdx = text.indexOf('Via Transportation')
    const gisIdx = text.indexOf('GIS Developer')
    const routingIdx = text.indexOf('Routing Maps Specialist')
    expect(viaIdx).toBeGreaterThanOrEqual(0)
    expect(gisIdx).toBeGreaterThan(viaIdx)
    expect(routingIdx).toBeGreaterThan(gisIdx)
  })
})
