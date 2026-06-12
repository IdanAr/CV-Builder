import type React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFParse } from 'pdf-parse'
import { Packer } from 'docx'
import JSZip from 'jszip'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { buildDocx } from '@/lib/docx/resume-docx'
import type { ExportMode } from '@/lib/export-mode'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const TEMPLATES = ['classic', 'modern', 'minimal', 'executive', 'sidebar'] as const

function makeMeta(overrides: Partial<ResumeMeta> = {}): ResumeMeta {
  return {
    templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
    primaryColor: '#1e3a5f', accentColor: '#0066cc',
    pageMargins: 0.75, lineSpacing: 1.1,
    sectionOrder: ['work', 'education', 'skills', 'languages', 'custom:extra1'],
    layout: 'single-column', columnAssignment: {},
    ...overrides,
  }
}

const fixture: ResumeData = {
  basics: {
    name: 'Jane Smith', label: 'Principal Architect',
    email: 'jane.smith@example.com', phone: '+1 555 0100', url: 'janesmith.dev',
    location: { city: 'Tel Aviv', region: 'IL' },
    summary: 'Engineer with a decade of platform experience.',
  },
  work: [{
    name: 'Acme Corp', position: 'Senior Engineer', startDate: '2020-01',
    summary: 'Led the platform team.',
    highlights: ['Cut infra costs 40%', 'Shipped v2 to 1M users'],
  }],
  education: [{ institution: 'MIT', area: 'Computer Science', studyType: 'BSc', startDate: '2012-09', endDate: '2016-06', score: '3.9' }],
  skills: [{ name: 'TypeScript', level: 'Expert', keywords: ['React', 'Node.js'] }],
  languages: [{ language: 'English', fluency: 'Native' }],
  customSections: [{
    id: 'extra1', name: 'Patents', enabledFields: ['summary'],
    items: [{ id: 'p1', title: 'Distributed Cache Patent', summary: 'Granted 2023.' }],
  }],
}

// Every key fact that must survive export in any mode
const KEY_FACTS = [
  'Jane Smith', 'jane.smith@example.com', '+1 555 0100', 'janesmith.dev',
  'Acme Corp', 'Senior Engineer', 'Cut infra costs 40%',
  'MIT', 'TypeScript', 'English', 'Distributed Cache Patent',
]

// Strict linear reading order required in ats mode (headings are uppercased)
const ATS_ORDER = [
  'Jane Smith', 'Principal Architect', 'jane.smith@example.com',
  'WORK EXPERIENCE', 'Acme Corp', 'Senior Engineer', 'Cut infra costs 40%',
  'EDUCATION', 'MIT',
  'SKILLS', 'TypeScript',
  'LANGUAGES', 'English',
  'PATENTS', 'Distributed Cache Patent',
]

async function pdfText(data: ResumeData, meta: ResumeMeta, mode: ExportMode): Promise<string> {
  const element = selectPdfTemplate(data, meta, mode, 'Harness Resume')
  const buffer = await renderToBuffer(element as React.ReactElement<never>)
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return result.text.replace(/\s+/g, ' ')
}

async function docxXml(data: ResumeData, meta: ResumeMeta, mode: ExportMode): Promise<string> {
  const buffer = await Packer.toBuffer(buildDocx(data, meta, mode))
  const zip = await JSZip.loadAsync(buffer)
  const file = zip.file('word/document.xml')
  expect(file, 'word/document.xml missing from DOCX zip').not.toBeNull()
  return file!.async('string')
}

function assertOrdered(text: string, parts: string[]) {
  let last = -1
  for (const part of parts) {
    const idx = text.indexOf(part)
    expect(idx, `"${part}" missing or out of order`).toBeGreaterThan(last)
    last = idx
  }
}

describe('ATS export harness (5 templates x 2 modes x 2 formats)', () => {
  for (const templateId of TEMPLATES) {
    describe(`template: ${templateId}`, () => {
      it('ats PDF is strictly linear', async () => {
        const text = await pdfText(fixture, makeMeta({ templateId: templateId as string }), 'ats')
        assertOrdered(text, ATS_ORDER)
      })

      it('ats PDF stays linear even with two-column meta', async () => {
        const meta = makeMeta({
          templateId: templateId as string, layout: 'two-column',
          columnAssignment: { education: 'right', skills: 'right' },
        })
        const text = await pdfText(fixture, meta, 'ats')
        assertOrdered(text, ATS_ORDER)
      })

      it('designed PDF contains every key fact', async () => {
        const text = await pdfText(fixture, makeMeta({ templateId: templateId as string }), 'designed')
        for (const fact of KEY_FACTS) expect(text).toContain(fact)
      })

      it('ats DOCX has no tables and is strictly ordered', async () => {
        const meta = makeMeta({ templateId: templateId as string, layout: 'two-column' })
        const xml = await docxXml(fixture, meta, 'ats')
        expect(xml).not.toContain('<w:tbl')
        assertOrdered(xml, [
          'Jane Smith', 'WORK EXPERIENCE', 'Acme Corp',
          'EDUCATION', 'MIT', 'SKILLS', 'TypeScript',
          'LANGUAGES', 'English', 'PATENTS', 'Distributed Cache Patent',
        ])
      })

      it('designed DOCX still serializes', async () => {
        const meta = makeMeta({ templateId: templateId as string, layout: 'two-column' })
        const buffer = await Packer.toBuffer(buildDocx(fixture, meta, 'designed'))
        expect(buffer.byteLength).toBeGreaterThan(1000)
      })
    })
  }

  it('designed and ats PDFs carry document metadata', async () => {
    for (const mode of ['designed', 'ats'] as const) {
      const element = selectPdfTemplate(fixture, makeMeta({ templateId: 'classic' }), mode, 'Harness Resume')
      const buffer = await renderToBuffer(element as React.ReactElement<never>)
      const raw = buffer.toString('latin1')
      expect(raw, `${mode} PDF missing /Title`).toContain('/Title')
      expect(raw, `${mode} PDF missing /Author`).toContain('/Author')
    }
  })
})
