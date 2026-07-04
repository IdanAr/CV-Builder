import { describe, it, expect } from 'vitest'
import { computePageBreaks, A4_HEIGHT_PX, normalizeAnchorText, toMatchKey, ANCHOR_MAX_CHARS } from '@/lib/preview-pagination'

const HALF_INCH_PX = 0.5 * 96 // 48px — default pageMargins

describe('computePageBreaks', () => {
  it('returns no breaks when content fits on one page', () => {
    // Template rendered at exactly A4 height (minHeight) with 0.5in margins
    expect(computePageBreaks(A4_HEIGHT_PX, HALF_INCH_PX)).toEqual([])
  })

  it('returns no breaks for content shorter than one page', () => {
    expect(computePageBreaks(600, HALF_INCH_PX)).toEqual([])
  })

  it('accounts for per-page margins: page 1 holds only A4 height minus top+bottom margins', () => {
    const usable = A4_HEIGHT_PX - 2 * HALF_INCH_PX // 1027px of content per PDF page
    // Content slightly taller than one page of usable space → 2 pages
    const templateHeight = 2 * HALF_INCH_PX + usable + 100
    const breaks = computePageBreaks(templateHeight, HALF_INCH_PX)
    expect(breaks).toHaveLength(1)
    // Break sits after top margin + one page's worth of usable content
    expect(breaks[0]).toEqual({ page: 1, top: HALF_INCH_PX + usable })
  })

  it('accumulates margin offset across multiple pages', () => {
    const usable = A4_HEIGHT_PX - 2 * HALF_INCH_PX
    const templateHeight = 2 * HALF_INCH_PX + 3 * usable // exactly 3 pages of content
    const breaks = computePageBreaks(templateHeight, HALF_INCH_PX)
    expect(breaks).toHaveLength(2)
    expect(breaks[0].top).toBe(HALF_INCH_PX + usable)
    expect(breaks[1].top).toBe(HALF_INCH_PX + 2 * usable)
  })

  it('does not emit a break for content exactly filling N pages plus nothing', () => {
    const usable = A4_HEIGHT_PX - 2 * HALF_INCH_PX
    const templateHeight = 2 * HALF_INCH_PX + usable // exactly 1 page
    expect(computePageBreaks(templateHeight, HALF_INCH_PX)).toEqual([])
  })

  it('handles larger margins (0.75in)', () => {
    const margin = 0.75 * 96 // 72px
    const usable = A4_HEIGHT_PX - 2 * margin // 979px
    const templateHeight = 2 * margin + usable + 1
    const breaks = computePageBreaks(templateHeight, margin)
    expect(breaks).toEqual([{ page: 1, top: margin + usable }])
  })

  it('never places a break beyond the rendered content', () => {
    const breaks = computePageBreaks(5000, HALF_INCH_PX)
    for (const b of breaks) expect(b.top).toBeLessThan(5000)
  })
})

describe('normalizeAnchorText', () => {
  it('lowercases and collapses whitespace runs', () => {
    expect(normalizeAnchorText('Israeli  Navy\n Commando')).toBe('israeli navy commando')
  })

  it('strips bullets, hyphens, and soft hyphens', () => {
    expect(normalizeAnchorText('• Data-driven ­platform')).toBe('datadriven platform')
  })

  it('trims leading/trailing whitespace', () => {
    expect(normalizeAnchorText('  hello world  ')).toBe('hello world')
  })
})

describe('toMatchKey', () => {
  it('removes all spaces on top of normalization', () => {
    expect(toMatchKey('Data - Driven  Platform')).toBe('datadrivenplatform')
  })

  it('is stable for already-normalized input', () => {
    expect(toMatchKey(toMatchKey('Some Text'))).toBe(toMatchKey('Some Text'))
  })
})

describe('ANCHOR_MAX_CHARS', () => {
  it('is long enough to be unique but bounded', () => {
    expect(ANCHOR_MAX_CHARS).toBeGreaterThanOrEqual(80)
    expect(ANCHOR_MAX_CHARS).toBeLessThanOrEqual(200)
  })
})
