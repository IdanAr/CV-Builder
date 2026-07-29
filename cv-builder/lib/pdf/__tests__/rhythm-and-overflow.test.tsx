import { describe, it, expect, vi } from 'vitest'
import { selectPdfTemplate } from '../select-template'
import { renderToGlyphRuns, findBaselineCollisions } from './pdf-geometry'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

vi.setConfig({ testTimeout: 120_000 })

/**
 * The two guards the whole-branch review said were missing.
 *
 * Both defects below shipped and were caught by review rather than by the
 * suite, because every other geometry test pins `lineSpacing: 1.15` and uses a
 * fixture name with no descenders. Reverting either fix left 939 tests green.
 */

const TEMPLATES = ['classic', 'modern', 'minimal', 'executive', 'sidebar'] as const
/** Every value the schema and the DesignPanel slider allow. */
const LINE_SPACINGS = [1.0, 1.05, 1.1, 1.15] as const
/** One metric-compatible, one with the largest descender, one serif. */
const FONTS = ['Calibri', 'IBM Plex Sans', 'Garamond'] as const

function metaFor(templateId: string, fontFamily: string, lineSpacing: number): ResumeMeta {
  return {
    templateId, fontFamily, headerFontFamily: fontFamily,
    primaryColor: '#1e3a5f', accentColor: '#0066cc',
    pageMargins: 0.5, lineSpacing,
    sectionOrder: ['work'], layout: 'single-column',
    columnAssignment: {}, excludedAtsKeywords: [],
  } as ResumeMeta
}

/**
 * Descenders in both the name and the headline. A name without them cannot
 * collide with the line beneath it no matter how tight the line box, which is
 * why the original fixture ("Idan Arbel") hid this for the whole phase.
 */
const descenderData: ResumeData = {
  basics: { name: 'Gregory Playfair', label: 'Paraguayan Typography Judge' },
  work: [{ name: 'SAS Israel', position: 'Data Solutions Architect',
           startDate: '2022-07', highlights: ['Prevented fraud'] }],
}

describe('vertical rhythm across the whole line-spacing range', () => {
  it.each(LINE_SPACINGS)('no glyphs collide at lineSpacing %s', async (lineSpacing) => {
    const failures: string[] = []
    for (const templateId of TEMPLATES) {
      for (const fontFamily of FONTS) {
        const meta = metaFor(templateId, fontFamily, lineSpacing)
        const runs = await renderToGlyphRuns(selectPdfTemplate(descenderData, meta, 'designed', 'CV'))
        const collisions = findBaselineCollisions(runs)
        if (collisions.length > 0) {
          failures.push(`${templateId}/${fontFamily}: "${collisions[0].a.str}" over "${collisions[0].b.str}"`)
        }
      }
    }
    expect(failures, `lineSpacing ${lineSpacing} produced overlapping text`).toEqual([])
  })
})

/**
 * A single highlight longer than a page. `highlights` is an unbounded
 * `z.array(z.string())`, and react-pdf silently discards whatever falls past
 * the bottom of a non-wrapping View — no error, no warning, just missing text.
 */
const LONG_HIGHLIGHT =
  Array.from({ length: 240 }, (_, i) =>
    `Point number ${i + 1} set out at length so the bullet cannot fit on one page.`
  ).join(' ') + ' TAIL-OF-HIGHLIGHT'

const overflowData: ResumeData = {
  basics: { name: 'Idan Arbel' },
  work: [{ name: 'SAS Israel', position: 'Architect', startDate: '2022-07',
           highlights: [LONG_HIGHLIGHT] }],
}

describe('a bullet longer than a page keeps all of its text', () => {
  it.each([...TEMPLATES, 'ats'])('%s', async (templateId) => {
    const mode = templateId === 'ats' ? 'ats' : 'designed'
    const meta = metaFor(templateId === 'ats' ? 'minimal' : templateId, 'Calibri', 1.15)
    const runs = await renderToGlyphRuns(selectPdfTemplate(overflowData, meta, mode, 'CV'))

    // Without pagination the assertion below could pass on a fixture that
    // simply fits, which is how this class of bug stays invisible.
    expect(new Set(runs.map(r => r.page)).size, `${templateId}: fixture did not paginate`)
      .toBeGreaterThan(1)
    expect(
      runs.some(r => r.str.includes('TAIL-OF-HIGHLIGHT')),
      `${templateId}: the end of the bullet was silently dropped`
    ).toBe(true)
  })
})
