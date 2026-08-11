// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ClassicTemplate } from './ClassicTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const meta: ResumeMeta = {
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0,
  lineSpacing: 1.15,
  sectionOrder: ['certificates', 'awards', 'publications', 'interests', 'projects'],
  layout: 'single-column',
  columnAssignment: {},
  excludedAtsKeywords: [],
}

const data: ResumeData = {
  basics: { name: 'Jane Smith', label: 'Engineer' },
  certificates: [{ name: 'AWS Certified Architect', issuer: 'Amazon', date: '2022' }],
  awards: [{ title: 'Employee of the Year', date: '2021', awarder: 'Acme Corp', summary: 'Recognized for leadership.' }],
  publications: [{ name: 'Scaling Microservices', publisher: 'O\'Reilly', releaseDate: '2020', summary: 'A deep dive.' }],
  interests: [{ name: 'Chess', keywords: ['Strategy', 'Puzzles'] }],
  projects: [{ name: 'Open Source CLI', description: 'A CLI tool.', highlights: ['10k downloads'], keywords: ['Node.js'] }],
}

describe('ClassicTemplate new sections', () => {
  it('renders certificates, awards, publications, interests, and projects', () => {
    const { container } = render(<ClassicTemplate data={data} meta={meta} />)
    const text = container.textContent ?? ''
    expect(text).toContain('AWS Certified Architect')
    expect(text).toContain('Employee of the Year')
    expect(text).toContain('Scaling Microservices')
    expect(text).toContain('Chess')
    expect(text).toContain('Open Source CLI')
  })
})

describe('ClassicTemplate multi-URL contact row', () => {
  it('renders each profile as a clickable link, using the label when present and the raw URL when not', () => {
    const dataWithProfiles: ResumeData = {
      basics: {
        name: 'Jane Smith',
        profiles: [
          { id: 'p1', label: 'Portfolio', url: 'https://janesmith.dev' },
          { id: 'p2', url: 'https://github.com/janesmith' },
        ],
      },
    }
    const { container } = render(<ClassicTemplate data={dataWithProfiles} meta={meta} />)
    const links = Array.from(container.querySelectorAll('a')).filter(a => a.href.includes('janesmith'))
    expect(links).toHaveLength(2)
    expect(links.find(a => a.href === 'https://janesmith.dev/')?.textContent).toBe('Portfolio')
    expect(links.find(a => a.href === 'https://github.com/janesmith')?.textContent).toBe('https://github.com/janesmith')
  })
})
