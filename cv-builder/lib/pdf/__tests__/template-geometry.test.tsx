import { describe, it, expect, vi } from 'vitest'
import { selectPdfTemplate } from '../select-template'
import { renderToGlyphRuns, findBaselineCollisions } from './pdf-geometry'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

vi.setConfig({ testTimeout: 60_000 })

const TEMPLATE_IDS = ['classic', 'modern', 'minimal', 'executive', 'sidebar'] as const

const data: ResumeData = {
  basics: {
    name: 'Idan Arbel',
    label: 'Solutions Architect | Data & AI',
    email: 'idan@example.com',
    phone: '054-0000000',
    location: { city: 'Tel Aviv', region: 'IL' },
    summary: 'Data Solutions Architect and GenAI platform developer.',
  },
  work: [{
    name: 'SAS Israel', position: 'Data Solutions Architect',
    startDate: '2022-07',
    highlights: ['Prevented over 1 million in fraud', 'Cut false positives 20%'],
  }],
  education: [{ institution: 'Technion', area: 'Generative AI', studyType: 'Certificate', endDate: '2025-12' }],
  skills: [{ name: 'Data', keywords: ['SQL', 'MongoDB'] }],
  languages: [{ language: 'Hebrew', fluency: 'Native' }],
  // Task 6 also right-aligns dates on awards and publications entry heads
  // (their web counterparts already use justify-content: space-between);
  // exercised here so every template/font combination gets collision-checked.
  awards: [{ title: 'Excellence Award', date: '2023-05', awarder: 'SAS Israel' }],
  publications: [{ name: 'Streaming Fraud Detection at Scale', releaseDate: '2024-01', publisher: 'Data Eng Weekly' }],
}

function metaFor(templateId: string): ResumeMeta {
  return {
    templateId, fontFamily: 'Calibri', headerFontFamily: 'Calibri',
    primaryColor: '#1e3a5f', accentColor: '#0066cc',
    pageMargins: 0.5, sidebarRailWidth: 33, lineSpacing: 1.15,
    sectionOrder: ['work', 'education', 'skills', 'languages', 'awards', 'publications'],
    layout: 'single-column', columnAssignment: {}, excludedAtsKeywords: [],
  } as ResumeMeta
}

describe('template geometry: no overlapping text', () => {
  for (const templateId of TEMPLATE_IDS) {
    it(`${templateId} / designed has no baseline collisions`, async () => {
      const runs = await renderToGlyphRuns(
        selectPdfTemplate(data, metaFor(templateId), 'designed', 'CV')
      )
      expect(findBaselineCollisions(runs)).toEqual([])
    })

    it(`${templateId} / ats has no baseline collisions`, async () => {
      const runs = await renderToGlyphRuns(
        selectPdfTemplate(data, metaFor(templateId), 'ats', 'CV')
      )
      expect(findBaselineCollisions(runs)).toEqual([])
    })
  }
})

// One representative per risk class: metric-compatible substitute, a
// deliberately non-metric-compatible substitute, and a font that previously
// rendered as Helvetica and now renders as itself.
const FONT_RISK_CLASSES = ['Calibri', 'Garamond', 'Lato'] as const

describe('template geometry across font substitutions', () => {
  for (const templateId of TEMPLATE_IDS) {
    for (const fontFamily of FONT_RISK_CLASSES) {
      it(`${templateId} / ${fontFamily} has no baseline collisions`, async () => {
        const meta = { ...metaFor(templateId), fontFamily, headerFontFamily: fontFamily }
        const runs = await renderToGlyphRuns(selectPdfTemplate(data, meta, 'designed', 'CV'))
        expect(findBaselineCollisions(runs)).toEqual([])
      })
    }
  }
})
