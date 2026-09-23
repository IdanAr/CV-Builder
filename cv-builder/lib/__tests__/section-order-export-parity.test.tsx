import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFParse } from 'pdf-parse'
import { Packer } from 'docx'
import JSZip from 'jszip'

import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import type { ExportMode } from '@/lib/export-mode'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { buildDocx } from '@/lib/docx/resume-docx'
import { ClassicTemplate } from '@/components/templates/ClassicTemplate'
import { ModernTemplate } from '@/components/templates/ModernTemplate'
import { MinimalTemplate } from '@/components/templates/MinimalTemplate'
import { ExecutiveTemplate } from '@/components/templates/ExecutiveTemplate'
import { SidebarTemplate } from '@/components/templates/SidebarTemplate'

vi.setConfig({ testTimeout: 30_000 })

const WEB_TEMPLATES = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  executive: ExecutiveTemplate,
  sidebar: SidebarTemplate,
} as const

/**
 * The five sections the exporters' stale fallback used to omit. Single-word
 * markers on purpose: PDF text extraction and DOCX run-splitting can both
 * break a multi-word string across nodes.
 */
const DROPPED = {
  certificates: 'Certmarker',
  awards: 'Awardmarker',
  publications: 'Pubmarker',
  interests: 'Interestmarker',
  projects: 'Projectmarker',
} as const

const fixture: ResumeData = {
  basics: { name: 'Ada Lovelace', email: 'ada@example.com' },
  work: [{ name: 'Analytical Engines', position: 'Engineer', startDate: '2020-01' }],
  education: [{ institution: 'Cambridge', area: 'Mathematics', studyType: 'BSc' }],
  skills: [{ name: 'Algorithms' }],
  volunteer: [{ organization: 'Royal Society', position: 'Fellow' }],
  languages: [{ language: 'English', fluency: 'Native' }],
  certificates: [{ name: DROPPED.certificates, issuer: 'Issuer' }],
  awards: [{ title: DROPPED.awards, awarder: 'Awarder' }],
  publications: [{ name: DROPPED.publications, publisher: 'Publisher' }],
  interests: [{ name: DROPPED.interests }],
  projects: [{ name: DROPPED.projects, description: 'A project.' }],
}

/**
 * A resume whose meta carries no usable section order — the case the shared
 * fallback exists for. Reachable today: the upload/extract route writes an
 * empty sectionOrder when the parser finds no built-in section with entries,
 * removing every section in the editor leaves one behind, and any document
 * written before sectionOrder existed has no key at all.
 */
function metaWithoutOrder(templateId: string, overrides: Partial<ResumeMeta> = {}): ResumeMeta {
  return { ...ResumeMetaSchema.parse({}), templateId, sectionOrder: [], ...overrides }
}

async function pdfText(meta: ResumeMeta, mode: ExportMode): Promise<string> {
  const element = selectPdfTemplate(fixture, meta, mode, 'Parity Resume')
  const buffer = await renderToBuffer(element as React.ReactElement<never>)
  const parsed = await new PDFParse({ data: buffer }).getText()
  return parsed.text.replace(/\s+/g, ' ')
}

async function docxXml(meta: ResumeMeta, mode: ExportMode): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(buildDocx(fixture, meta, mode)))
  const file = zip.file('word/document.xml')
  expect(file, 'word/document.xml missing from DOCX zip').not.toBeNull()
  return file!.async('string')
}

describe('a resume with no section order renders the same sections everywhere', () => {
  for (const [templateId, Template] of Object.entries(WEB_TEMPLATES)) {
    it(`${templateId}: web preview shows all ten built-in sections`, () => {
      const html = renderToStaticMarkup(
        <Template data={fixture} meta={metaWithoutOrder(templateId)} />
      )
      for (const key of Object.keys(DROPPED)) {
        expect(html, `${templateId} preview dropped ${key}`).toContain(`data-pv-section="${key}"`)
      }
    })

    it(`${templateId}: designed PDF carries the same sections the preview showed`, async () => {
      const text = await pdfText(metaWithoutOrder(templateId), 'designed')
      for (const [key, marker] of Object.entries(DROPPED)) {
        expect(text, `${templateId} PDF dropped ${key}`).toContain(marker)
      }
    })
  }

  it('ATS PDF carries them too', async () => {
    const text = await pdfText(metaWithoutOrder('classic'), 'ats')
    for (const [key, marker] of Object.entries(DROPPED)) {
      expect(text, `ATS PDF dropped ${key}`).toContain(marker)
    }
  })

  for (const mode of ['designed', 'ats'] as const) {
    it(`${mode} DOCX carries them too`, async () => {
      const xml = await docxXml(metaWithoutOrder('classic'), mode)
      for (const [key, marker] of Object.entries(DROPPED)) {
        expect(xml, `${mode} DOCX dropped ${key}`).toContain(marker)
      }
    })
  }

  it('an explicit section order still wins over the fallback in every format', async () => {
    const meta = metaWithoutOrder('classic', { sectionOrder: ['work', 'projects'] })
    const html = renderToStaticMarkup(<ClassicTemplate data={fixture} meta={meta} />)
    expect(html).toContain('data-pv-section="projects"')
    expect(html).not.toContain('data-pv-section="certificates"')

    const text = await pdfText(meta, 'designed')
    expect(text).toContain(DROPPED.projects)
    expect(text).not.toContain(DROPPED.certificates)

    const xml = await docxXml(meta, 'designed')
    expect(xml).toContain(DROPPED.projects)
    expect(xml).not.toContain(DROPPED.certificates)
  })
})
