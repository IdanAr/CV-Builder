import { describe, it, expect, vi } from 'vitest'
import { MinimalPdfTemplate } from '../templates/MinimalPdfTemplate'
import { ClassicPdfTemplate } from '../templates/ClassicPdfTemplate'
import { ModernPdfTemplate } from '../templates/ModernPdfTemplate'
import { ExecutivePdfTemplate } from '../templates/ExecutivePdfTemplate'
import { SidebarPdfTemplate } from '../templates/SidebarPdfTemplate'
import { AtsPdfTemplate } from '../templates/AtsPdfTemplate'
import { renderToGlyphRuns, type GlyphRun } from './pdf-geometry'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

vi.setConfig({ testTimeout: 30_000 })

const meta = {
  templateId: 'minimal', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f', accentColor: '#0066cc',
  pageMargins: 0.5, sidebarRailWidth: 33, lineSpacing: 1.15,
  sectionOrder: ['work', 'education'], layout: 'single-column',
  columnAssignment: {}, excludedAtsKeywords: [],
} as ResumeMeta

const HIGHLIGHT_A = 'Engineered and executed data integration solutions across cloud platforms utilizing SQL and SAS Data Integration Studio, elevating data quality'
const HIGHLIGHT_B = 'Architected anti-fraud systems aligned with client business logic, preventing significant losses through pattern identification'

function workEntries(count: number, lastHighlightCount: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `Company ${i + 1}`, position: 'Data Solutions Architect',
    startDate: '2020-01', endDate: '2022-01',
    highlights: [HIGHLIGHT_A, HIGHLIGHT_B].slice(0, i === count - 1 ? lastHighlightCount : 2),
  }))
}

// 9 full work entries, the last trimmed to one highlight, land the EDUCATION
// heading exactly on the last line of page 1 with nothing following it —
// measured directly against this template's own page geometry (see the
// zzdebug scan this brief's TDD process used to find the boundary), not
// guessed. One highlight fewer or more moves the heading off the foot
// entirely and makes the assertion trivially true.
const orphanHeadingData: ResumeData = {
  basics: { name: 'Idan Arbel', label: 'Architect' },
  work: workEntries(9, 1),
  education: [{ institution: 'Technion', area: 'Generative AI', studyType: 'Certificate', endDate: '2025-12' }],
}

// 10 full work entries, the last stripped of highlights entirely, land
// Company 10's head + dates on the last line of page 1 with its position
// line pushed alone to the top of page 2.
const splitEntryData: ResumeData = {
  basics: { name: 'Idan Arbel', label: 'Architect' },
  work: workEntries(10, 0),
}

// A description long enough that it cannot fit on a single page by itself
// (well over a page's worth of text), ending in a distinctive marker phrase
// so the test can assert the tail of the description actually made it into
// the rendered output rather than being silently dropped.
const LONG_DESCRIPTION =
  Array.from({ length: 220 }, (_, i) => `Sentence number ${i + 1} describing the project in exhaustive, repetitive detail so the paragraph runs long.`).join(' ')
  + ' MARKER-END-OF-DESCRIPTION'

const projectOverflowData: ResumeData = {
  basics: { name: 'Idan Arbel', label: 'Architect' },
  projects: [{ name: 'Overflow Project', startDate: '2020-01', endDate: '2021-01', description: LONG_DESCRIPTION }],
}

const projectsMeta: ResumeMeta = { ...meta, sectionOrder: ['projects'] }

/**
 * Reading-order successor lookup. `y` resets at every page boundary, so a
 * plain `r.y < target.y` filter silently mixes runs from later pages in with
 * runs from earlier ones once the numbers happen to line up — the exact
 * shape that shadowed a real defect in Task 1's geometry harness (selecting
 * the "nearest run below" by y alone). Comparing `(page, y)` as an ordered
 * pair keeps "after" meaning "after" across a break: a run on a later page
 * is always after, and only runs on the same page fall back to the `y`
 * comparison.
 */
function firstMatchAfter(
  runs: GlyphRun[], after: GlyphRun, predicate: (r: GlyphRun) => boolean
): GlyphRun | undefined {
  return runs
    .filter((r) => predicate(r) && (r.page > after.page || (r.page === after.page && r.y < after.y)))
    .sort((a, b) => a.page - b.page || b.y - a.y)[0]
}

// pdf.js reports letter-spaced headings as several runs glued together with
// spaces (e.g. "E D U C AT I O N"); strip whitespace before matching.
function textOf(run: GlyphRun): string {
  return run.str.replace(/\s+/g, '').toUpperCase()
}

describe('pagination', () => {
  it('never leaves a section heading stranded at the foot of a page', async () => {
    const runs = await renderToGlyphRuns(MinimalPdfTemplate({ data: orphanHeadingData, meta, title: 'CV' }))

    // A single-page render would make this assertion (and the one below)
    // trivially true forever — confirm the fixture actually forces a break.
    expect(new Set(runs.map((r) => r.page)).size).toBeGreaterThan(1)

    const heading = runs.find((r) => textOf(r).includes('EDUCATION'))
    expect(heading).toBeDefined()

    const followers = runs.filter((r) => r.page === heading!.page && r.y < heading!.y)
    expect(followers.length, 'EDUCATION heading is orphaned at the page foot').toBeGreaterThan(0)
  })

  it('never splits an entry head from its position line', async () => {
    const runs = await renderToGlyphRuns(MinimalPdfTemplate({ data: splitEntryData, meta, title: 'CV' }))
    expect(new Set(runs.map((r) => r.page)).size).toBeGreaterThan(1)

    for (let i = 1; i <= 10; i++) {
      const company = runs.find((r) => r.str.includes(`Company ${i}`))
      if (!company) continue
      const position = firstMatchAfter(runs, company, (r) => r.str.includes('Data Solutions Architect'))
      expect(position?.page, `Company ${i} split from its position line`).toBe(company.page)
    }
  })

  // Runs against every template, not just Minimal: the clipping bug this
  // guards existed in all six simultaneously and no test caught it in any of
  // them. A Minimal-only check would pass while five templates silently drop
  // content.
  const OVERFLOW_TEMPLATES = [
    ['minimal', MinimalPdfTemplate],
    ['classic', ClassicPdfTemplate],
    ['modern', ModernPdfTemplate],
    ['executive', ExecutivePdfTemplate],
    ['sidebar', SidebarPdfTemplate],
    ['ats', AtsPdfTemplate],
  ] as const

  it.each(OVERFLOW_TEMPLATES)('%s never drops a project description that needs a page break', async (id, Template) => {
    const runs = await renderToGlyphRuns(
      Template({ data: projectOverflowData, meta: { ...projectsMeta, templateId: id }, title: 'CV' })
    )

    // The description alone is well over a page's worth of text — confirm
    // the fixture actually forces a break rather than trivially fitting.
    expect(new Set(runs.map((r) => r.page)).size, `${id}: fixture did not paginate`).toBeGreaterThan(1)

    const tail = runs.find((r) => r.str.includes('MARKER-END-OF-DESCRIPTION'))
    expect(tail, `${id}: trailing words of the project description were dropped, not just moved`).toBeDefined()
  })
})
