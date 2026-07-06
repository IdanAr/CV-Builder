// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SidebarTemplate } from './SidebarTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const meta: ResumeMeta = {
  templateId: 'sidebar',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f',
  accentColor: '#0066cc',
  pageMargins: 1.0,
  lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills', 'languages'],
  layout: 'two-column',
  columnAssignment: {},
}

const data: ResumeData = {
  basics: { name: 'Jane Smith', label: 'Architect', email: 'jane@test.com', phone: '+1 555 0100' },
  work: [{ name: 'Acme', position: 'Dev', startDate: '2020-01' }],
  skills: [{ name: 'TypeScript', level: 'Expert', keywords: ['React'] }],
  languages: [{ language: 'English', fluency: 'Native' }],
}

describe('SidebarTemplate margin floor', () => {
  it('never pads rail or main column below 0.5in (48px) for any pageMargins in [0.5, 1.5]', () => {
    for (const pageMargins of [0.5, 0.6, 0.75, 1.0, 1.25, 1.5]) {
      const { container } = render(<SidebarTemplate data={data} meta={{ ...meta, pageMargins }} />)
      const page = container.firstChild as HTMLElement
      const rail = page.children[0] as HTMLElement
      const main = page.children[1] as HTMLElement
      expect(parseFloat(rail.style.padding), `rail padding at pageMargins=${pageMargins}`).toBeGreaterThanOrEqual(48)
      expect(parseFloat(main.style.padding), `main padding at pageMargins=${pageMargins}`).toBeGreaterThanOrEqual(48)
    }
  })
})

const newSectionsData: ResumeData = {
  basics: { name: 'Jane Smith', label: 'Architect' },
  certificates: [{ name: 'AWS Certified Architect', issuer: 'Amazon', date: '2022' }],
  awards: [{ title: 'Employee of the Year', date: '2021', awarder: 'Acme Corp', summary: 'Recognized for leadership.' }],
  publications: [{ name: 'Scaling Microservices', publisher: 'O\'Reilly', releaseDate: '2020', summary: 'A deep dive.' }],
  interests: [{ name: 'Chess', keywords: ['Strategy', 'Puzzles'] }],
  projects: [{ name: 'Open Source CLI', description: 'A CLI tool.', highlights: ['10k downloads'], keywords: ['Node.js'] }],
}

describe('SidebarTemplate new sections in main column', () => {
  it('renders certificates, awards, publications, interests, and projects', () => {
    const newSectionsMeta: ResumeMeta = {
      ...meta,
      sectionOrder: ['certificates', 'awards', 'publications', 'interests', 'projects'],
    }
    const { container } = render(<SidebarTemplate data={newSectionsData} meta={newSectionsMeta} />)
    const text = container.textContent ?? ''
    expect(text).toContain('AWS Certified Architect')
    expect(text).toContain('Employee of the Year')
    expect(text).toContain('Scaling Microservices')
    expect(text).toContain('Chess')
    expect(text).toContain('Open Source CLI')
  })
})

describe('SidebarTemplate new sections in rail', () => {
  it('renders certificates, awards, publications, interests, and projects when assigned to the left rail', () => {
    const newSectionsMeta: ResumeMeta = {
      ...meta,
      sectionOrder: ['certificates', 'awards', 'publications', 'interests', 'projects'],
      columnAssignment: {
        certificates: 'left',
        awards: 'left',
        publications: 'left',
        interests: 'left',
        projects: 'left',
      },
    }
    const { container } = render(<SidebarTemplate data={newSectionsData} meta={newSectionsMeta} />)
    const page = container.firstChild as HTMLElement
    const rail = page.children[0] as HTMLElement
    expect(rail.textContent).toContain('AWS Certified Architect')
    expect(rail.textContent).toContain('Employee of the Year')
    expect(rail.textContent).toContain('Scaling Microservices')
    expect(rail.textContent).toContain('Chess')
    expect(rail.textContent).toContain('Open Source CLI')
  })
})

describe('SidebarTemplate rail typography bands', () => {
  it('renders rail section titles at 12pt', () => {
    const { getByText } = render(<SidebarTemplate data={data} meta={meta} />)
    expect(getByText('Skills').style.fontSize).toBe('12pt')
    expect(getByText('Languages').style.fontSize).toBe('12pt')
  })

  it('renders the rail contact block at 10pt or above', () => {
    const { getByText } = render(<SidebarTemplate data={data} meta={meta} />)
    const contactBlock = getByText('jane@test.com').parentElement as HTMLElement
    expect(parseFloat(contactBlock.style.fontSize)).toBeGreaterThanOrEqual(10)
  })

  it('renders the rail skills and languages blocks at 10pt or above', () => {
    const { getByText } = render(<SidebarTemplate data={data} meta={meta} />)
    const skillsBlock = getByText('Skills').nextElementSibling as HTMLElement
    const langBlock = getByText('Languages').nextElementSibling as HTMLElement
    expect(parseFloat(skillsBlock.style.fontSize)).toBeGreaterThanOrEqual(10)
    expect(parseFloat(langBlock.style.fontSize)).toBeGreaterThanOrEqual(10)
  })
})
