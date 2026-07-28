// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MinimalTemplate } from '@/components/templates/MinimalTemplate'
import { MinimalPdfTemplate } from '@/lib/pdf/templates/MinimalPdfTemplate'
import { extractPagination } from '@/lib/pdf/extract-pagination'
import { buildTextIndex, findAnchorIndex, resolveAnchorTops } from '@/lib/preview-anchor'
import { fitScaleFor } from '@/components/editor/PreviewTab'
import { renderToBuffer } from '@react-pdf/renderer'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

vi.setConfig({ testTimeout: 60_000 })

/**
 * Pins where the preview's page-break divider lands.
 *
 * The reported defect was a divider sitting mid-entry instead of immediately
 * above the section heading that actually starts the next PDF page. It does
 * not reproduce on current code — these tests exist so it cannot come back
 * silently, and so the next person can see what was actually checked rather
 * than re-deriving it.
 *
 * The hard case is a page that begins with a section heading, because the PDF
 * renders CSS letter-spacing as literal spaces ("M I L I TA RY  S E RV I C E")
 * while the DOM holds "Military Service". Both sides are reduced to a
 * space-free match key, which is what makes them comparable at all.
 */

const MARGIN_PX = 48                       // 0.5in at 96dpi
const USABLE_PX = 1123 - 2 * MARGIN_PX
const MIN_ZOOM = 0.25                      // mirrors PreviewTab
const MAX_ZOOM = 2.0

const meta = {
  templateId: 'minimal', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f', accentColor: '#0066cc',
  pageMargins: 0.5, lineSpacing: 1.15,
  sectionOrder: ['work', 'volunteer'], layout: 'single-column',
  columnAssignment: {}, excludedAtsKeywords: [],
} as ResumeMeta

// Nine work entries push the VOLUNTEER heading onto page 2, so the page-2
// anchor begins with a letter-spaced section heading — the shape the original
// defect was reported against. Measured, not guessed: eight entries fit on one
// page and ten put a work entry at the top of page 2 instead.
const data: ResumeData = {
  basics: { name: 'Idan Arbel', label: 'Solutions Architect' },
  work: Array.from({ length: 9 }, (_, i) => ({
    name: `Company ${i + 1}`, position: 'Data Solutions Architect',
    startDate: '2020-01', endDate: '2022-01',
    highlights: [
      'Engineered and executed data integration solutions across cloud platforms utilizing SQL and SAS Data Integration Studio, elevating data quality',
      'Architected anti-fraud systems aligned with client business logic, preventing significant losses through pattern identification',
    ],
  })),
  volunteer: [{
    organization: 'Israeli Navy', position: 'Captain, HR Officer',
    startDate: '2012-01', endDate: '2016-01',
    highlights: ['Led a team of officers'],
  }],
}

describe('preview divider placement', () => {
  it('locates the page-2 anchor at the section heading that starts that page', async () => {
    const buffer = await renderToBuffer(MinimalPdfTemplate({ data, meta, title: 'CV' }) as never)
    const { pageCount, anchors } = await extractPagination(Buffer.from(buffer))

    // The fixture must actually paginate, or everything below is vacuous.
    expect(pageCount).toBeGreaterThan(1)
    expect(anchors).toHaveLength(pageCount - 1)

    const { container } = render(<MinimalTemplate data={data} meta={meta} />)
    const index = buildTextIndex(container as HTMLElement)

    const anchorKey = anchors[0].replace(/ /g, '')
    // Guards the premise: this is the heading-start case, not a mid-entry one.
    expect(anchorKey.startsWith('volunteer')).toBe(true)

    const at = findAnchorIndex(index, anchorKey, 0)
    expect(at, 'page-2 anchor was not found in the preview DOM').not.toBe(-1)

    // The divider must land ON the heading, not inside the preceding entry.
    expect(index.key.slice(at, at + 'volunteer'.length)).toBe('volunteer')
    // …and the text just before it is the tail of the previous section.
    expect(index.key.slice(Math.max(0, at - 20), at)).not.toContain('volunteer')
  })

  /**
   * `minGap` is a fixed 200 *visual* px, but measurements are post-scale, so
   * its meaning changes with zoom. Below roughly 0.18 an entire page is
   * shorter than the gap: the true measured position is rejected, the
   * arithmetic estimate is rejected by the same guard, and the break is
   * dropped with no divider drawn at all.
   *
   * PreviewTab clamps every user-facing zoom path through clampZoom, so this
   * is only reachable via `fitScale`, which is computed straight from the
   * container width. This test pins the whole supported zoom range.
   */
  it.each([MIN_ZOOM, 0.3, 0.5, 0.75, 1, 1.5, MAX_ZOOM])(
    'keeps every break at scale %s', (scale) => {
      const wrapper = document.createElement('div')
      const content = document.createElement('div')
      const a1 = 'militaryservicecaptainhrofficerisraelinavy'
      const a2 = 'projectscvbuilderresumetoolingshippedexports'
      content.textContent = 'x'.repeat(50) + a1 + 'y'.repeat(50) + a2
      wrapper.appendChild(content)

      const trueTops = [MARGIN_PX + USABLE_PX, MARGIN_PX + 2 * USABLE_PX].map(t => t * scale)
      let call = 0

      const breaks = resolveAnchorTops(wrapper, content, {
        anchors: [a1, a2],
        estimateTopFor: (k) => (MARGIN_PX + (k + 1) * USABLE_PX) * scale,
        maxTop: 3 * 1123 * scale,
        measureTop: () => trueTops[call++] ?? null,
      })

      expect(breaks.map(b => b.page), `a divider was dropped at scale ${scale}`).toEqual([1, 2])
      expect(breaks.every(b => b.source === 'pdf')).toBe(true)
      breaks.forEach((b, i) => expect(b.top).toBeCloseTo(trueTops[i], 5))
    }
  )

  /**
   * The auto-fit path is the only way `scale` can leave the supported range,
   * because every other entry point runs through `clampZoom`. A container
   * narrower than ~183px produced a scale low enough to drop a divider
   * outright; one narrower than 64px produced a negative scale.
   */
  it('never derives an auto-fit scale below the supported minimum', () => {
    for (const width of [0, 32, 64, 100, 183, 262, 400, 858, 2000]) {
      const s = fitScaleFor(width)
      expect(s, `width ${width} produced scale ${s}`).toBeGreaterThanOrEqual(MIN_ZOOM)
      expect(s).toBeLessThanOrEqual(MAX_ZOOM)
    }
  })

  it('still fits the page to the container at normal widths', () => {
    // 858 = A4 width + the 64px padding the fit calculation subtracts.
    expect(fitScaleFor(858)).toBe(1)
    expect(fitScaleFor(2000)).toBe(1)
    expect(fitScaleFor(461)).toBeCloseTo(0.5, 2)
  })
})
