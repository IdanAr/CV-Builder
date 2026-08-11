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

describe('ClassicTemplate nested work roles', () => {
  it('shows each role\'s own date range, with no company-level aggregate', () => {
    const dataWithRoles: ResumeData = {
      work: [{
        name: 'Meta', position: 'Data Analyst', startDate: '2019-01', endDate: '2021-01', highlights: [],
        roles: [{ id: 'r1', position: 'Data Team Lead', startDate: '2021-01', endDate: 'Present', summary: 'Led the team.', highlights: ['Grew headcount 3x'] }],
      }],
    }
    const { container } = render(<ClassicTemplate data={dataWithRoles} meta={{ ...meta, sectionOrder: ['work'] }} />)
    const text = container.textContent ?? ''
    expect(text).not.toContain('01/2019 - Present') // no more company-level aggregate
    expect(text).toContain('Data Analyst')
    expect(text).toContain('01/2019') // role 1's own date
    expect(text).toContain('01/2021 - Present') // role 2's own date
    expect(text).toContain('Data Team Lead')
    expect(text).toContain('Led the team.')
    expect(text).toContain('Grew headcount 3x')
  })
})

describe('ClassicTemplate nested education roles', () => {
  it('shows each program\'s own date range, with no institution-level aggregate', () => {
    const dataWithRoles: ResumeData = {
      education: [{
        institution: 'MIT', studyType: 'BSc', area: 'CS', startDate: '2015-09', endDate: '2019-06',
        roles: [{ id: 'r1', studyType: 'MSc', area: 'CS', startDate: '2020-09', endDate: '2022-06', score: '3.9' }],
      }],
    }
    const { container } = render(<ClassicTemplate data={dataWithRoles} meta={{ ...meta, sectionOrder: ['education'] }} />)
    const text = container.textContent ?? ''
    expect(text).not.toContain('09/2015 - 06/2022') // no more institution-level aggregate
    expect(text).toContain('BSc in CS')
    expect(text).toContain('09/2015 - 06/2019') // role 1's own date
    expect(text).toContain('09/2020 - 06/2022') // role 2's own date
    expect(text).toContain('MSc in CS')
    expect(text).toContain('Score: 3.9')
  })
})

describe('ClassicTemplate legacy basics.url fallback', () => {
  it('renders the legacy basics.url as a link when profiles is empty', () => {
    const legacyData: ResumeData = { basics: { name: 'Jane', url: 'https://janelegacy.dev' } }
    const { container } = render(<ClassicTemplate data={legacyData} meta={meta} />)
    const link = container.querySelector('a[href="https://janelegacy.dev"]')
    expect(link).toBeTruthy()
  })
})
