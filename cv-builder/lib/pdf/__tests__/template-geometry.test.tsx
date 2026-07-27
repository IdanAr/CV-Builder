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
}

function metaFor(templateId: string): ResumeMeta {
  return {
    templateId, fontFamily: 'Calibri', headerFontFamily: 'Calibri',
    primaryColor: '#1e3a5f', accentColor: '#0066cc',
    pageMargins: 0.5, lineSpacing: 1.15,
    sectionOrder: ['work', 'education', 'skills', 'languages'],
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
