import { describe, it, expect } from 'vitest'
import { buildDocx } from '../resume-docx'
import { Packer } from 'docx'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column',
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
})
