// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModernTemplate } from './ModernTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const meta: ResumeMeta = {
  templateId: 'modern',
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

describe('ModernTemplate new sections', () => {
  it('renders certificates, awards, publications, interests, and projects', () => {
    const { container } = render(<ModernTemplate data={data} meta={meta} />)
    const text = container.textContent ?? ''
    expect(text).toContain('AWS Certified Architect')
    expect(text).toContain('Employee of the Year')
    expect(text).toContain('Scaling Microservices')
    expect(text).toContain('Chess')
    expect(text).toContain('Open Source CLI')
  })
})

describe('ModernTemplate single-column contact row', () => {
  it('renders profile links in single-column layout', () => {
    const dataWithProfiles: ResumeData = {
      basics: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        profiles: [{ id: 'p1', network: 'LinkedIn', label: 'LinkedIn', url: 'https://linkedin.com/in/jane' }],
      },
    }
    render(<ModernTemplate data={dataWithProfiles} meta={{ ...meta, layout: 'single-column' }} />)
    expect(screen.getByRole('link', { name: /linkedin/i })).toHaveAttribute(
      'href',
      'https://linkedin.com/in/jane'
    )
  })

  it('renders plain email/phone/location text with no profiles, without broken markup', () => {
    const dataNoProfiles: ResumeData = {
      basics: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '555-1234',
        location: { city: 'Springfield', region: 'IL' },
        profiles: [],
      },
    }
    const { container } = render(<ModernTemplate data={dataNoProfiles} meta={{ ...meta, layout: 'single-column' }} />)
    expect(screen.getByRole('link', { name: 'jane@example.com' })).toHaveAttribute('href', 'mailto:jane@example.com')
    const text = container.textContent ?? ''
    expect(text).toContain('555-1234')
    expect(text).toContain('Springfield, IL')
  })
})

describe('ModernTemplate multi-URL contact row', () => {
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
    const { container } = render(<ModernTemplate data={dataWithProfiles} meta={{ ...meta, layout: 'two-column' }} />)
    const links = Array.from(container.querySelectorAll('a')).filter(a => a.href.includes('janesmith'))
    expect(links).toHaveLength(2)
    expect(links.find(a => a.href === 'https://janesmith.dev/')?.textContent).toBe('Portfolio')
    expect(links.find(a => a.href === 'https://github.com/janesmith')?.textContent).toBe('https://github.com/janesmith')
  })
})

describe('ModernTemplate projects rich text', () => {
  it('renders bold markdown in project descriptions and highlights', () => {
    const dataWithRichProjects: ResumeData = {
      basics: { name: 'Jane Smith' },
      projects: [{
        name: 'CV Builder',
        description: 'Built with **React** and TypeScript',
        highlights: ['Shipped **v2** to production'],
      }],
    }
    const { container } = render(<ModernTemplate data={dataWithRichProjects} meta={{ ...meta, sectionOrder: ['projects'] }} />)
    const strongs = Array.from(container.querySelectorAll('strong')).map(s => s.textContent)
    expect(strongs).toContain('React')
    expect(strongs).toContain('v2')
  })
})

describe('ModernTemplate nested work roles', () => {
  it('shows each role\'s own date range, with no company-level aggregate', () => {
    const dataWithRoles: ResumeData = {
      work: [{
        name: 'Meta', position: 'Data Analyst', startDate: '2019-01', endDate: '2021-01', highlights: [],
        roles: [{ id: 'r1', position: 'Data Team Lead', startDate: '2021-01', endDate: 'Present', summary: 'Led the team.', highlights: ['Grew headcount 3x'] }],
      }],
    }
    const { container } = render(<ModernTemplate data={dataWithRoles} meta={{ ...meta, sectionOrder: ['work'] }} />)
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

describe('ModernTemplate nested education roles', () => {
  it('shows each program\'s own date range, with no institution-level aggregate', () => {
    const dataWithRoles: ResumeData = {
      education: [{
        institution: 'MIT', studyType: 'BSc', area: 'CS', startDate: '2015-09', endDate: '2019-06',
        roles: [{ id: 'r1', studyType: 'MSc', area: 'CS', startDate: '2020-09', endDate: '2022-06', score: '3.9' }],
      }],
    }
    const { container } = render(<ModernTemplate data={dataWithRoles} meta={{ ...meta, sectionOrder: ['education'] }} />)
    const text = container.textContent ?? ''
    expect(text).not.toContain('09/2015 - 06/2022') // no more institution-level aggregate
    expect(text).toContain('BSc in CS')
    expect(text).toContain('09/2015 - 06/2019') // role 1's own date
    expect(text).toContain('09/2020 - 06/2022') // role 2's own date
    expect(text).toContain('MSc in CS')
    expect(text).toContain('Score: 3.9')
  })
})
