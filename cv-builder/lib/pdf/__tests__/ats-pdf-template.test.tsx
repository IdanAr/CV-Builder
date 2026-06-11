import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFParse } from 'pdf-parse'
import { AtsPdfTemplate } from '../templates/AtsPdfTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const meta: ResumeMeta = {
  templateId: 'sidebar', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f', accentColor: '#0066cc',
  pageMargins: 0.5, lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills', 'languages'],
  layout: 'two-column', columnAssignment: {},
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
})
