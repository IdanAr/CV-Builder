import { describe, it, expect, vi } from 'vitest'
import { MinimalPdfTemplate } from '../templates/MinimalPdfTemplate'
import { AtsPdfTemplate } from '../templates/AtsPdfTemplate'
import { renderToGlyphRuns } from './pdf-geometry'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

vi.setConfig({ testTimeout: 30_000 })

const meta = {
  templateId: 'minimal', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f', accentColor: '#0066cc',
  pageMargins: 0.5, sidebarRailWidth: 33, lineSpacing: 1.15,
  sectionOrder: ['work'], layout: 'single-column',
  columnAssignment: {}, excludedAtsKeywords: [],
} as ResumeMeta

const data: ResumeData = {
  basics: { name: 'Idan Arbel' },
  work: [{
    name: 'SAS Israel', position: 'Data Solutions Architect',
    startDate: '2022-07',
    highlights: [
      'Engineered and executed data integration solutions across cloud platforms utilizing SQL and SAS Data Integration Studio, elevating data quality and achieving 97% system uptime',
    ],
  }],
}

describe('minimal entry layout', () => {
  it('right-aligns the role dates against the role position — dates now live at role level, not on the company line', async () => {
    const runs = await renderToGlyphRuns(MinimalPdfTemplate({ data, meta, title: 'CV' }))
    const company = runs.find(r => r.str.includes('SAS Israel'))!
    const position = runs.find(r => r.str.includes('Data Solutions Architect'))!
    const dates = runs.find(r => r.str.includes('2022'))!
    expect(company).toBeDefined()
    expect(position).toBeDefined()
    expect(dates).toBeDefined()
    // The company name carries no date of its own anymore.
    expect(Math.abs(company.y - dates.y)).toBeGreaterThan(1)
    // The role's own line does, on the same visual line as its position…
    expect(Math.abs(position.y - dates.y)).toBeLessThan(1)
    // …right-aligned in the right half of the text column.
    expect(dates.x).toBeGreaterThan(300)
  })

  it('hangs wrapped bullet lines to the text column, not under the marker', async () => {
    const runs = await renderToGlyphRuns(MinimalPdfTemplate({ data, meta, title: 'CV' }))
    const bulletLines = runs.filter(r => r.y < runs.find(b => b.str.includes('Engineered'))!.y + 1
                                      && r.str.length > 20)
    expect(bulletLines.length).toBeGreaterThan(1)
    const xs = bulletLines.map(r => Math.round(r.x))
    // Every wrapped line starts at the same x as the first text line.
    expect(new Set(xs).size).toBe(1)
  })
})

describe('ats reading order', () => {
  it('emits text in strictly descending y within each page', async () => {
    const runs = await renderToGlyphRuns(AtsPdfTemplate({ data, meta, title: 'CV' }))
    const byPage = new Map<number, typeof runs>()
    for (const run of runs) {
      const list = byPage.get(run.page)
      if (list) list.push(run)
      else byPage.set(run.page, [run])
    }
    for (const [page, pageRuns] of byPage) {
      for (let i = 1; i < pageRuns.length; i++) {
        // Content-stream order must not jump back up the page. Same-line runs
        // (|Δy| < 1) are fine; a later run sitting materially higher is not.
        expect(
          pageRuns[i].y, `page ${page}: run "${pageRuns[i].str}" jumps back up the page`
        ).toBeLessThan(pageRuns[i - 1].y + 1)
      }
    }
  })
})
