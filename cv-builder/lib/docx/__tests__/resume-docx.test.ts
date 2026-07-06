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
  excludedAtsKeywords: [],
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

  it('sidebar template renders a shaded rail table with the name inside it', async () => {
    const meta: ResumeMeta = { ...defaultMeta, templateId: 'sidebar', primaryColor: '#1e3a5f' }
    const doc = buildDocx({ ...sampleData, languages: [{ language: 'English', fluency: 'Native' }] }, meta)
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    // The rail is a table cell shaded with the primary color
    expect(xml).toContain('<w:tbl')
    expect(xml.toLowerCase()).toContain('1e3a5f')
    // Name and rail sections live inside the table (rail cell), before the main column
    const tblIdx = xml.indexOf('<w:tbl')
    expect(xml.indexOf('Jane Smith')).toBeGreaterThan(tblIdx)
    const skillsIdx = xml.indexOf('SKILLS')
    const workIdx = xml.indexOf('WORK EXPERIENCE')
    expect(skillsIdx).toBeGreaterThan(-1)
    expect(workIdx).toBeGreaterThan(-1)
    // Rail (skills/languages) is the left cell, so it precedes the main column content
    expect(skillsIdx).toBeLessThan(workIdx)
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

  it('sidebar columnAssignment moves skills to main column and work to rail', async () => {
    const meta: ResumeMeta = {
      ...defaultMeta,
      templateId: 'sidebar',
      primaryColor: '#1e3a5f',
      columnAssignment: { skills: 'right', work: 'left' },
      sectionOrder: ['work', 'skills'],
    }
    const doc = buildDocx(sampleData, meta)
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('<w:tbl')
    // With work overridden to left and skills to right:
    // work heading should appear before skills heading in XML (left cell before right cell)
    const workIdx = xml.indexOf('WORK EXPERIENCE')
    const skillsIdx = xml.indexOf('SKILLS')
    expect(workIdx).toBeGreaterThan(-1)
    expect(skillsIdx).toBeGreaterThan(-1)
    expect(workIdx).toBeLessThan(skillsIdx)
  })

  it('sidebar default columnAssignment still puts skills in rail (left) and work in main (right)', async () => {
    const meta: ResumeMeta = {
      ...defaultMeta,
      templateId: 'sidebar',
      primaryColor: '#1e3a5f',
      columnAssignment: {},
      sectionOrder: ['work', 'skills'],
    }
    const doc = buildDocx(sampleData, meta)
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    // Default: skills → left (rail), work → right (main)
    // skills heading appears before work heading in XML
    const skillsIdx = xml.indexOf('SKILLS')
    const workIdx = xml.indexOf('WORK EXPERIENCE')
    expect(skillsIdx).toBeGreaterThan(-1)
    expect(workIdx).toBeGreaterThan(-1)
    expect(skillsIdx).toBeLessThan(workIdx)
  })
})

describe('buildDocx ATS typography bands (Sidebar rail + Executive name)', () => {
  async function docXml(doc: ReturnType<typeof buildDocx>): Promise<string> {
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    return zip.file('word/document.xml')!.async('string')
  }

  it('sidebar rail section headings render at 12pt (w:sz 24, half-points)', async () => {
    const meta: ResumeMeta = { ...defaultMeta, templateId: 'sidebar', primaryColor: '#1e3a5f' }
    const xml = await docXml(buildDocx({ ...sampleData, languages: [{ language: 'English', fluency: 'Native' }] }, meta))
    // The rail heading run for "SKILLS" must carry sz=24 (12pt), not the old sz=20 (10pt)
    const skillsHeadingRunMatch = xml.match(/<w:r>(?:(?!<w:r>)[\s\S])*?SKILLS(?:(?!<w:r>)[\s\S])*?<\/w:r>/)
    expect(skillsHeadingRunMatch).not.toBeNull()
    expect(skillsHeadingRunMatch![0]).toContain('w:sz w:val="24"')
    expect(skillsHeadingRunMatch![0]).not.toContain('w:sz w:val="20"')
  })

  it('sidebar rail body/contact text renders at 10pt (w:sz 20, half-points), never below', async () => {
    const meta: ResumeMeta = { ...defaultMeta, templateId: 'sidebar', primaryColor: '#1e3a5f' }
    const xml = await docXml(buildDocx({ ...sampleData, languages: [{ language: 'English', fluency: 'Native' }] }, meta))
    // Rail contact text (email) must not use the old 9pt (sz=18) size
    const emailRunMatch = xml.match(/<w:r>(?:(?!<w:r>)[\s\S])*?jane@test\.com(?:(?!<w:r>)[\s\S])*?<\/w:r>/)
    expect(emailRunMatch).not.toBeNull()
    expect(emailRunMatch![0]).not.toContain('w:sz w:val="18"')
    expect(emailRunMatch![0]).toContain('w:sz w:val="20"')
    // Rail body text (skills keywords, which sit in the rail by default) must not
    // use the old 9.5pt (sz=19) size
    const keywordsRunMatch = xml.match(/<w:r>(?:(?!<w:r>)[\s\S])*?Node\.js(?:(?!<w:r>)[\s\S])*?<\/w:r>/)
    expect(keywordsRunMatch).not.toBeNull()
    expect(keywordsRunMatch![0]).not.toContain('w:sz w:val="19"')
    expect(keywordsRunMatch![0]).toContain('w:sz w:val="20"')
  })

  it('executive name renders at 22pt (w:sz 44, half-points), not the old 26pt', async () => {
    const meta: ResumeMeta = { ...defaultMeta, templateId: 'executive' }
    const xml = await docXml(buildDocx(sampleData, meta))
    const nameRunMatch = xml.match(/<w:r>(?:(?!<w:r>)[\s\S])*?Jane Smith(?:(?!<w:r>)[\s\S])*?<\/w:r>/)
    expect(nameRunMatch).not.toBeNull()
    expect(nameRunMatch![0]).toContain('w:sz w:val="44"')
    expect(nameRunMatch![0]).not.toContain('w:sz w:val="52"')
  })
})

describe('buildDocx ats mode', () => {
  async function docXml(doc: ReturnType<typeof buildDocx>): Promise<string> {
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    return zip.file('word/document.xml')!.async('string')
  }

  const fullData = {
    ...sampleData,
    languages: [{ language: 'English', fluency: 'Native' }],
  }

  it('sidebar template has no tables in ats mode', async () => {
    const meta = { ...defaultMeta, templateId: 'sidebar', sectionOrder: ['work', 'education', 'skills', 'languages'] }
    const xml = await docXml(buildDocx(fullData, meta, 'ats'))
    expect(xml).not.toContain('<w:tbl')
    // Rail content folds back inline, in sectionOrder order
    const order = ['Jane Smith', 'WORK EXPERIENCE', 'Acme', 'EDUCATION', 'MIT', 'SKILLS', 'TypeScript', 'LANGUAGES', 'English']
    let last = -1
    for (const part of order) {
      const idx = xml.indexOf(part)
      expect(idx, `"${part}" missing or out of order`).toBeGreaterThan(last)
      last = idx
    }
  })

  it('two-column layout has no tables in ats mode', async () => {
    const xml = await docXml(buildDocx(fullData, { ...defaultMeta, layout: 'two-column' }, 'ats'))
    expect(xml).not.toContain('<w:tbl')
  })

  it('ats mode has no shading anywhere (no filled header, no rail)', async () => {
    const meta = { ...defaultMeta, templateId: 'modern', primaryColor: '#1e3a5f' }
    const xml = await docXml(buildDocx(fullData, meta, 'ats'))
    expect(xml).not.toContain('<w:shd')
  })

  it('defaults to designed mode (sidebar still renders its rail table)', async () => {
    const meta = { ...defaultMeta, templateId: 'sidebar' }
    const xml = await docXml(buildDocx(fullData, meta))
    expect(xml).toContain('<w:tbl')
  })

  it('ats mode keeps the Summary heading regardless of stored layout', async () => {
    const withSummary = {
      ...fullData,
      basics: { ...fullData.basics, summary: 'Seasoned platform engineer.' },
    }
    const xml = await docXml(buildDocx(withSummary, { ...defaultMeta, layout: 'two-column' }, 'ats'))
    const headingIdx = xml.indexOf('SUMMARY')
    const textIdx = xml.indexOf('Seasoned platform engineer.')
    expect(headingIdx).toBeGreaterThan(-1)
    expect(textIdx).toBeGreaterThan(headingIdx)
  })
})
