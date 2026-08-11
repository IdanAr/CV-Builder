// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ExecutiveTemplate } from './ExecutiveTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const meta: ResumeMeta = {
  templateId: 'executive',
  fontFamily: 'Georgia',
  headerFontFamily: 'Georgia',
  primaryColor: '#1a1a2e',
  accentColor: '#b8860b',
  pageMargins: 1.0,
  lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column',
  columnAssignment: {},
  excludedAtsKeywords: [],
}

const data: ResumeData = {
  basics: { name: 'Jane Smith', label: 'CTO' },
  work: [{ name: 'Acme', position: 'VP Engineering', startDate: '2020-01' }],
  skills: [{ name: 'Leadership' }],
}

const newSectionsData: ResumeData = {
  basics: { name: 'Jane Smith', label: 'CTO' },
  certificates: [{ name: 'AWS Certified Architect', issuer: 'Amazon', date: '2022' }],
  awards: [{ title: 'Employee of the Year', date: '2021', awarder: 'Acme Corp', summary: 'Recognized for leadership.' }],
  publications: [{ name: 'Scaling Microservices', publisher: 'O\'Reilly', releaseDate: '2020', summary: 'A deep dive.' }],
  interests: [{ name: 'Chess', keywords: ['Strategy', 'Puzzles'] }],
  projects: [{ name: 'Open Source CLI', description: 'A CLI tool.', highlights: ['10k downloads'], keywords: ['Node.js'] }],
}

const newSectionsMeta: ResumeMeta = {
  ...meta,
  sectionOrder: ['certificates', 'awards', 'publications', 'interests', 'projects'],
}

describe('ExecutiveTemplate new sections', () => {
  it('renders certificates, awards, publications, interests, and projects', () => {
    const { container } = render(<ExecutiveTemplate data={newSectionsData} meta={newSectionsMeta} />)
    const text = container.textContent ?? ''
    expect(text).toContain('AWS Certified Architect')
    expect(text).toContain('Employee of the Year')
    expect(text).toContain('Scaling Microservices')
    expect(text).toContain('Chess')
    expect(text).toContain('Open Source CLI')
  })
})

describe('ExecutiveTemplate multi-URL contact row', () => {
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
    const { container } = render(<ExecutiveTemplate data={dataWithProfiles} meta={meta} />)
    const links = Array.from(container.querySelectorAll('a')).filter(a => a.href.includes('janesmith'))
    expect(links).toHaveLength(2)
    expect(links.find(a => a.href === 'https://janesmith.dev/')?.textContent).toBe('Portfolio')
    expect(links.find(a => a.href === 'https://github.com/janesmith')?.textContent).toBe('https://github.com/janesmith')
  })
})

describe('ExecutiveTemplate layout', () => {
  it('renders a single column by default', () => {
    const { container } = render(<ExecutiveTemplate data={data} meta={meta} />)
    expect(container.querySelector('div[style*="58%"]')).toBeNull()
  })

  it('renders two flex columns when layout is two-column', () => {
    const { container } = render(
      <ExecutiveTemplate data={data} meta={{ ...meta, layout: 'two-column', columnAssignment: { skills: 'right' } }} />
    )
    // Same 58% / 42% split the other two-column templates use
    const leftCol = container.querySelector('div[style*="58%"]')
    expect(leftCol).not.toBeNull()
    expect(leftCol!.textContent).toContain('Acme')
    expect(leftCol!.textContent).not.toContain('Leadership')
  })

  it('places sections assigned to the right column in the right column', () => {
    const { container } = render(
      <ExecutiveTemplate data={data} meta={{ ...meta, layout: 'two-column', columnAssignment: { skills: 'right' } }} />
    )
    const leftCol = container.querySelector('div[style*="58%"]')
    const row = leftCol!.parentElement!
    const rightCol = row.children[1] as HTMLElement
    expect(rightCol.textContent).toContain('Leadership')
  })
})

describe('ExecutiveTemplate nested work roles', () => {
  it('shows the aggregate date range in the header and each role\'s own range beneath it', () => {
    const dataWithRoles: ResumeData = {
      work: [{
        name: 'Meta', position: 'Data Analyst', startDate: '2019-01', endDate: '2021-01', highlights: [],
        roles: [{ id: 'r1', position: 'Data Team Lead', startDate: '2021-01', endDate: undefined, summary: 'Led the team.', highlights: ['Grew headcount 3x'] }],
      }],
    }
    const { container } = render(<ExecutiveTemplate data={dataWithRoles} meta={meta} />)
    const text = container.textContent ?? ''
    expect(text).toContain('01/2019 - Present') // aggregate header range
    expect(text).toContain('Data Analyst')
    expect(text).toContain('Data Team Lead')
    expect(text).toContain('Led the team.')
    expect(text).toContain('Grew headcount 3x')
  })
})

describe('ExecutiveTemplate nested education roles', () => {
  it('shows the aggregate date range in the header and each program\'s own range beneath it', () => {
    const dataWithRoles: ResumeData = {
      education: [{
        institution: 'MIT', studyType: 'BSc', area: 'CS', startDate: '2015-09', endDate: '2019-06',
        roles: [{ id: 'r1', studyType: 'MSc', area: 'CS', startDate: '2020-09', endDate: '2022-06', score: '3.9' }],
      }],
    }
    const { container } = render(<ExecutiveTemplate data={dataWithRoles} meta={meta} />)
    const text = container.textContent ?? ''
    expect(text).toContain('09/2015 - 06/2022') // aggregate header range
    expect(text).toContain('BSc in CS')
    expect(text).toContain('MSc in CS')
    expect(text).toContain('Score: 3.9')
  })
})
