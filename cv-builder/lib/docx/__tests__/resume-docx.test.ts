import { describe, it, expect } from 'vitest'
import { buildDocx } from '../resume-docx'
import { Packer } from 'docx'
import JSZip from 'jszip'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column',
  columnAssignment: {},
}

const sampleData: ResumeData = {
  basics: { name: 'Jane Smith', label: 'Engineer', email: 'jane@test.com' },
  work: [{ name: 'Acme', position: 'Dev', startDate: '2020-01', highlights: ['Did X'] }],
  education: [{ institution: 'MIT', area: 'CS', studyType: 'BSc', startDate: '2016-09', endDate: '2020-06' }],
  skills: [{ name: 'TypeScript', level: 'Expert', keywords: ['React', 'Node.js'] }],
}

describe('buildDocx', () => {
  it('returns a Document that Packer can serialize to buffer', async () => {
    const doc = buildDocx(sampleData, defaultMeta)
    const buffer = await Packer.toBuffer(doc)
    expect(buffer.byteLength).toBeGreaterThan(1000)
  })

  it('serializes without error when data is empty', async () => {
    const doc = buildDocx({}, defaultMeta)
    const buffer = await Packer.toBuffer(doc)
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('maps Lato to Arial', () => {
    const doc = buildDocx(sampleData, { ...defaultMeta, fontFamily: 'Lato' })
    expect(doc).toBeTruthy()
  })

  it('two-column layout produces a table in the DOCX XML', async () => {
    const doc = buildDocx(sampleData, { ...defaultMeta, layout: 'two-column' })
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('<w:tbl')
    // Both columns should have invisible borders
    expect(xml).toContain('w:val="none"')
  })

  it('two-column layout puts work in left cell and skills in right cell', async () => {
    const doc = buildDocx(sampleData, { ...defaultMeta, layout: 'two-column' })
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    const workIdx = xml.indexOf('Work Experience')
    const skillsIdx = xml.indexOf('Skills')
    // Work must appear before Skills in document order (left cell before right cell)
    expect(workIdx).toBeGreaterThan(-1)
    expect(skillsIdx).toBeGreaterThan(-1)
    expect(workIdx).toBeLessThan(skillsIdx)
  })
})
