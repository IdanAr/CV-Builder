import { describe, it, expect } from 'vitest'
import { px, pt, MINIMAL_TOKENS } from '../tokens'

describe('design tokens', () => {
  it('converts points to CSS pixels at 96/72', () => {
    expect(px(7.5)).toBe('10px')
    expect(px(15)).toBe('20px')
    expect(px(12)).toBe('16px')
  })

  it('round-trips', () => {
    expect(pt(10)).toBeCloseTo(7.5, 5)
    expect(px(pt(18))).toBe('18px')
  })

  it('carries the Minimal template spacing used by both renderers', () => {
    expect(MINIMAL_TOKENS.headerMarginBottom).toBe(15)
    expect(MINIMAL_TOKENS.summaryMarginBottom).toBe(12)
    expect(MINIMAL_TOKENS.entryMarginBottom).toBe(7.5)
    expect(MINIMAL_TOKENS.bulletIndent).toBe(13.5)
  })
})

import { renderToGlyphRuns } from '@/lib/pdf/__tests__/pdf-geometry'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

// Snapshot every glyph position before and after the refactor. A pure refactor
// moves nothing; any diff here means a token value was transcribed wrong.
const TEMPLATE_IDS = ['classic', 'modern', 'minimal', 'executive', 'sidebar'] as const

const data: ResumeData = {
  basics: { name: 'Idan Arbel', label: 'Architect', email: 'idan@example.com',
            summary: 'Data Solutions Architect and GenAI platform developer.' },
  work: [{ name: 'SAS Israel', position: 'Data Solutions Architect', startDate: '2022-07',
           highlights: ['Prevented fraud', 'Cut false positives 20%'] }],
  education: [{ institution: 'Technion', area: 'Generative AI', studyType: 'Certificate', endDate: '2025-12' }],
  skills: [{ name: 'Data', keywords: ['SQL', 'MongoDB'] }],
}

describe('token refactor moves nothing', () => {
  for (const templateId of TEMPLATE_IDS) {
    it(`${templateId} glyph positions are unchanged`, async () => {
      const meta = {
        templateId, fontFamily: 'Calibri', headerFontFamily: 'Calibri',
        primaryColor: '#1e3a5f', accentColor: '#0066cc',
        pageMargins: 0.5, lineSpacing: 1.15,
        sectionOrder: ['work', 'education', 'skills'],
        layout: 'single-column', columnAssignment: {}, excludedAtsKeywords: [],
      } as ResumeMeta
      const runs = await renderToGlyphRuns(selectPdfTemplate(data, meta, 'designed', 'CV'))
      expect(runs.map(r => `${r.str}@${r.x.toFixed(1)},${r.y.toFixed(1)}`)).toMatchSnapshot()
    })
  }
})
