import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFParse } from 'pdf-parse'
import { AtsPdfTemplate } from '../templates/AtsPdfTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

vi.setConfig({ testTimeout: 20_000 })

const meta: ResumeMeta = {
  templateId: 'sidebar', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f', accentColor: '#0066cc',
  pageMargins: 0.5, lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills', 'languages'],
  layout: 'two-column', columnAssignment: {}, excludedAtsKeywords: [],
}

const data: ResumeData = {
  basics: {
    name: 'Jane Smith', label: 'Principal Architect',
    email: 'jane.smith@example.com', phone: '+1 555 0100',
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
}

async function extractText(element: React.ReactElement): Promise<string> {
  const buffer = await renderToBuffer(element as React.ReactElement<never>)
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return result.text.replace(/\s+/g, ' ')
}

function assertOrdered(text: string, parts: string[]) {
  let last = -1
  for (const part of parts) {
    const idx = text.indexOf(part)
    expect(idx, `"${part}" missing or out of order`).toBeGreaterThan(last)
    last = idx
  }
}

describe('AtsPdfTemplate', () => {
  it('renders strictly linear content regardless of template/layout meta', async () => {
    const text = await extractText(<AtsPdfTemplate data={data} meta={meta} title="My Resume" />)
    assertOrdered(text, [
      'Jane Smith', 'Principal Architect', 'jane.smith@example.com',
      'WORK EXPERIENCE', 'Acme Corp', '01/2020 - Present', 'Senior Engineer',
      'Cut infra costs 40%',
      'EDUCATION', 'MIT', 'BSc in Computer Science',
      'SKILLS', 'TypeScript',
      'LANGUAGES', 'English',
    ])
  })

  it('embeds document metadata', async () => {
    const buffer = await renderToBuffer(
      (<AtsPdfTemplate data={data} meta={meta} title="My Resume" />) as React.ReactElement<never>
    )
    const raw = buffer.toString('latin1')
    expect(raw).toContain('/Title')
    expect(raw).toContain('/Author')
  })

  it('renders without error on empty data', async () => {
    const buffer = await renderToBuffer(
      (<AtsPdfTemplate data={{}} meta={meta} />) as React.ReactElement<never>
    )
    expect(buffer.byteLength).toBeGreaterThan(500)
  })

  it('uppercases custom section headings to match built-in sections', async () => {
    const withCustom: ResumeData = {
      ...data,
      customSections: [{
        id: 'x1', name: 'Patents', enabledFields: ['summary'],
        items: [{ id: 'i1', title: 'Distributed Cache Patent', summary: 'Granted 2023.' }],
      }],
    }
    const customMeta = { ...meta, sectionOrder: [...meta.sectionOrder, 'custom:x1'] }
    const text = await extractText(<AtsPdfTemplate data={withCustom} meta={customMeta} />)
    expect(text).toContain('PATENTS')
    expect(text).toContain('Distributed Cache Patent')
  })

  it('extracts custom section url, keywords and level fields', async () => {
    const withCustom: ResumeData = {
      ...data,
      customSections: [{
        id: 'x2', name: 'Courses', enabledFields: ['url', 'keywords', 'level'],
        items: [{ id: 'i2', title: 'Distributed Systems', url: 'example.com/course', keywords: ['Consensus', 'Raft'], level: 'Advanced' }],
      }],
    }
    const customMeta = { ...meta, sectionOrder: [...meta.sectionOrder, 'custom:x2'] }
    const text = await extractText(<AtsPdfTemplate data={withCustom} meta={customMeta} />)
    expect(text).toContain('COURSES')
    expect(text).toContain('example.com/course')
    expect(text).toContain('Consensus · Raft')
    expect(text).toContain('Level: Advanced')
  })

  it('renders nested work roles in strict linear order (company, role 1, role 2)', async () => {
    const withRoles: ResumeData = {
      ...data,
      work: [{
        name: 'Meta', position: 'Data Analyst', startDate: '2019-01', endDate: '2021-01', highlights: [],
        roles: [{ id: 'r1', position: 'Data Team Lead', startDate: '2021-01', endDate: undefined, highlights: [] }],
      }],
    }
    const text = await extractText(<AtsPdfTemplate data={withRoles} meta={meta} />)
    assertOrdered(text, ['Meta', 'Data Analyst', 'Data Team Lead'])
  })

  it('renders nested education roles in strict linear order (institution, role 1, role 2)', async () => {
    const withRoles: ResumeData = {
      ...data,
      education: [{
        institution: 'MIT', area: 'Computer Science', studyType: 'BSc', startDate: '2012-09', endDate: '2016-06',
        roles: [{ id: 'r1', area: 'Data Science', studyType: 'MSc', startDate: '2016-09', endDate: '2018-06' }],
      }],
    }
    const text = await extractText(<AtsPdfTemplate data={withRoles} meta={meta} />)
    assertOrdered(text, ['MIT', 'BSc in Computer Science', 'MSc in Data Science'])
  })

  it('preserves linear reading order across page breaks', async () => {
    const manyJobs: ResumeData = {
      ...data,
      work: Array.from({ length: 12 }, (_, i) => ({
        name: `Company ${i + 1}`, position: `Role ${i + 1}`, startDate: '2010-01', endDate: '2012-01',
        summary: 'Did substantial work on large systems for several years running.',
        highlights: ['Improved throughput 25%', 'Mentored four engineers', 'Owned the on-call rotation'],
      })),
    }
    const text = await extractText(<AtsPdfTemplate data={manyJobs} meta={meta} />)
    assertOrdered(text, [
      'Company 1', 'Company 5', 'Company 9', 'Company 12',
      'EDUCATION', 'MIT', 'SKILLS', 'LANGUAGES',
    ])
  })
})
