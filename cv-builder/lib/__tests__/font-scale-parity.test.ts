import type React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFParse } from 'pdf-parse'
import { Packer } from 'docx'
import JSZip from 'jszip'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { buildDocx } from '@/lib/docx/resume-docx'
import { applyFontScaleToDocx } from '@/lib/docx/scale-docx'
import type { ExportMode } from '@/lib/export-mode'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

vi.setConfig({ testTimeout: 60_000 })

const TEMPLATES = ['classic', 'modern', 'minimal', 'executive', 'sidebar'] as const
const SCALES = [0.95, 1, 1.05] as const
const SPACINGS = [1.0, 1.08, 1.2] as const
const MODES: ExportMode[] = ['designed', 'ats']

const fixture: ResumeData = {
  basics: {
    name: 'Jane Smith', label: 'Principal Architect', email: 'jane.smith@example.com',
    summary: 'Engineer with a decade of platform experience.',
  },
  work: [{
    name: 'Acme Corp', position: 'Senior Engineer', startDate: '2020-01',
    highlights: ['Cut infra costs 40%', 'Shipped v2 to 1M users'],
  }],
  education: [{ institution: 'MIT', area: 'Computer Science', studyType: 'BSc', endDate: '2016-06' }],
  skills: [{ name: 'TypeScript', keywords: ['React', 'Node.js'] }],
  languages: [{ language: 'English', fluency: 'Native' }],
}

function meta(templateId: string, fontScale: number, lineSpacing: number): ResumeMeta {
  return {
    templateId, fontFamily: 'Calibri', headerFontFamily: 'Calibri',
    primaryColor: '#1e3a5f', accentColor: '#0066cc',
    pageMargins: 0.75, sidebarRailWidth: 33, lineSpacing, fontScale,
    sectionOrder: ['work', 'education', 'skills', 'languages'],
    layout: 'single-column', columnAssignment: {}, excludedAtsKeywords: [],
  } as ResumeMeta
}

/** Words only: the engines differ in whitespace and wrapping hyphens, not in content. */
function words(text: string): string {
  return text.replace(/[-\s·|•]/g, '').toLowerCase()
}

async function pdf(m: ResumeMeta, mode: ExportMode): Promise<{ text: string; pages: number }> {
  const buffer = await renderToBuffer(selectPdfTemplate(fixture, m, mode, 'Parity') as React.ReactElement<never>)
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return { text: words(result.text), pages: result.pages.length }
}

async function docxText(m: ResumeMeta, mode: ExportMode): Promise<string> {
  const buf = await applyFontScaleToDocx(await Packer.toBuffer(buildDocx(fixture, m, mode)), m.fontScale)
  const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string')
  return words([...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((x) => x[1]).join(''))
}

describe.each(TEMPLATES)('font scale / line spacing parity: %s', (templateId) => {
  it.each(MODES)('%s PDF keeps identical content and order at every scale and spacing', async (mode) => {
    const reference = (await pdf(meta(templateId, 1, 1.15), mode)).text
    expect(reference.length).toBeGreaterThan(100)
    for (const scale of SCALES) {
      for (const spacing of SPACINGS) {
        const got = await pdf(meta(templateId, scale, spacing), mode)
        expect(got.text, `${mode} scale ${scale} spacing ${spacing}`).toBe(reference)
      }
    }
  })

  it('page count never decreases as the text gets larger', async () => {
    const counts: number[] = []
    for (const scale of SCALES) counts.push((await pdf(meta(templateId, scale, 1.2), 'designed')).pages)
    expect(counts[0]).toBeLessThanOrEqual(counts[1])
    expect(counts[1]).toBeLessThanOrEqual(counts[2])
  })

  it.each(MODES)('%s DOCX keeps identical text at every scale and spacing', async (mode) => {
    const reference = await docxText(meta(templateId, 1, 1.15), mode)
    expect(reference.length).toBeGreaterThan(100)
    for (const scale of SCALES) {
      for (const spacing of SPACINGS) {
        expect(await docxText(meta(templateId, scale, spacing), mode), `${mode} scale ${scale} spacing ${spacing}`).toBe(reference)
      }
    }
  })
})

describe('ats mode stays strictly linear at the largest scale and spacing', () => {
  it.each(TEMPLATES)('%s', async (templateId) => {
    const { text } = await pdf({ ...meta(templateId, 1.05, 1.2), layout: 'two-column', columnAssignment: { education: 'right', skills: 'right' } }, 'ats')
    let last = -1
    for (const part of ['janesmith', 'workexperience', 'acmecorp', 'education', 'mit', 'skills', 'typescript', 'languages', 'english']) {
      // Search forward from the previous hit: 'mit' also occurs inside 'smith'.
      const idx = text.indexOf(part, last + 1)
      expect(idx, `"${part}" missing or out of order`).toBeGreaterThan(-1)
      last = idx
    }
  })
})
