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
  pageMargins: 1.0, sidebarRailWidth: 33,
  lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills', 'languages'],
  layout: 'two-column',
  columnAssignment: {},
  excludedAtsKeywords: [],
}

const data: ResumeData = {
  basics: { name: 'Jane Smith', label: 'Architect', email: 'jane@test.com', phone: '+1 555 0100' },
  work: [{ name: 'Acme', position: 'Dev', startDate: '2020-01' }],
  skills: [{ name: 'TypeScript', level: 'Expert', keywords: ['React'] }],
  languages: [{ language: 'English', fluency: 'Native' }],
}

describe('SidebarTemplate skills row wrapping', () => {
  it('already wraps a long skill name (stacked layout, no flex-row name/keyword squeeze)', () => {
    const longSkillData: ResumeData = {
      basics: { name: 'Jane Smith' },
      skills: [{
        name: 'AWS Certified Solutions Architect – Professional',
        level: 'Expert',
        keywords: ['AWS', 'Cloud Architecture', 'Terraform'],
      }],
    }
    const { container } = render(<SidebarTemplate data={longSkillData} meta={{ ...meta, sectionOrder: ['skills'] }} />)
    const nameCell = container.querySelector('[data-pv-section="skills"] [data-pv-entry="0"]')?.firstElementChild as HTMLElement
    expect(nameCell).toBeTruthy()
    expect(nameCell.textContent).toContain('AWS Certified Solutions Architect')
    // Unlike the other 4 templates, the name and keywords are stacked in separate
    // block-level divs (not a flex row with flexShrink:0), so there is no crowding
    // bug here: the name div has no minWidth/flexShrink and wraps by default.
    expect(nameCell.style.flexShrink).not.toBe('0')
    expect(nameCell.style.minWidth).toBe('')
  })
})

describe('SidebarTemplate rail width', () => {
  it('renders the rail at meta.sidebarRailWidth as a flex-basis percentage', () => {
    const { container } = render(<SidebarTemplate data={data} meta={{ ...meta, sidebarRailWidth: 25 }} />)
    const page = container.firstChild as HTMLElement
    const rail = page.children[0] as HTMLElement
    expect(rail.style.flex).toBe('0 0 25%')
  })

  it('renders the rail at 40% at the top of the allowed range', () => {
    const { container } = render(<SidebarTemplate data={data} meta={{ ...meta, sidebarRailWidth: 40 }} />)
    const page = container.firstChild as HTMLElement
    const rail = page.children[0] as HTMLElement
    expect(rail.style.flex).toBe('0 0 40%')
  })

  it('defaults to a 33% rail when meta.sidebarRailWidth is missing (pre-existing résumé)', () => {
    const { sidebarRailWidth: _unused, ...metaWithoutRailWidth } = meta
    void _unused
    const { container } = render(<SidebarTemplate data={data} meta={metaWithoutRailWidth as ResumeMeta} />)
    const page = container.firstChild as HTMLElement
    const rail = page.children[0] as HTMLElement
    expect(rail.style.flex).toBe('0 0 33%')
  })

  it('wraps a long unbroken email/URL in the rail contact block at the narrow 20% width, instead of clipping it', () => {
    const longContactData: ResumeData = {
      basics: {
        name: 'Jane Smith',
        email: 'jane.smith.principal.architect@a-very-long-corporate-domain-name.example.com',
        profiles: [{ id: 'p1', url: 'https://a-very-long-portfolio-domain-name.example.com/jane-smith/portfolio' }],
      },
    }
    const { container, getByText } = render(
      <SidebarTemplate data={longContactData} meta={{ ...meta, sidebarRailWidth: 20 }} />
    )
    const page = container.firstChild as HTMLElement
    const rail = page.children[0] as HTMLElement
    expect(rail.style.flex).toBe('0 0 20%')
    const contactBlock = getByText(longContactData.basics!.email!).parentElement as HTMLElement
    // Wrapping (not clipping) is what keeps a long email/URL fully visible in
    // a narrow rail: word-break must still be present, and nothing forces a
    // fixed too-small width or hides overflow.
    expect(contactBlock.style.wordBreak).toBe('break-word')
    expect(contactBlock.style.overflow).not.toBe('hidden')
    expect(contactBlock.style.whiteSpace).not.toBe('nowrap')
  })
})

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

describe('SidebarTemplate rail contact links', () => {
  it('renders each profile in the rail as a clickable link', () => {
    const dataWithProfiles: ResumeData = {
      basics: {
        name: 'Jane Smith',
        profiles: [{ id: 'p1', label: 'Portfolio', url: 'https://janesmith.dev' }],
      },
    }
    const { container } = render(<SidebarTemplate data={dataWithProfiles} meta={meta} />)
    const link = container.querySelector('a[href="https://janesmith.dev"]')
    expect(link?.textContent).toBe('Portfolio')
  })
})

describe('SidebarTemplate projects rich text', () => {
  it('renders bold markdown in project descriptions and highlights', () => {
    const dataWithRichProjects: ResumeData = {
      basics: { name: 'Jane Smith' },
      projects: [{
        name: 'CV Builder',
        description: 'Built with **React** and TypeScript',
        highlights: ['Shipped **v2** to production'],
      }],
    }
    const { container } = render(<SidebarTemplate data={dataWithRichProjects} meta={{ ...meta, sectionOrder: ['projects'] }} />)
    const strongs = Array.from(container.querySelectorAll('strong')).map(s => s.textContent)
    expect(strongs).toContain('React')
    expect(strongs).toContain('v2')
  })
})

describe('SidebarTemplate nested work roles', () => {
  it('shows each role\'s own date range, with no company-level aggregate', () => {
    const dataWithRoles: ResumeData = {
      work: [{
        name: 'Meta', position: 'Data Analyst', startDate: '2019-01', endDate: '2021-01', highlights: [],
        roles: [{ id: 'r1', position: 'Data Team Lead', startDate: '2021-01', endDate: 'Present', summary: 'Led the team.', highlights: ['Grew headcount 3x'] }],
      }],
    }
    const { container } = render(<SidebarTemplate data={dataWithRoles} meta={meta} />)
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

describe('SidebarTemplate nested education roles', () => {
  it('shows each program\'s own date range, with no institution-level aggregate', () => {
    const dataWithRoles: ResumeData = {
      education: [{
        institution: 'MIT', studyType: 'BSc', area: 'CS', startDate: '2015-09', endDate: '2019-06',
        roles: [{ id: 'r1', studyType: 'MSc', area: 'CS', startDate: '2020-09', endDate: '2022-06', score: '3.9' }],
      }],
    }
    const { container } = render(<SidebarTemplate data={dataWithRoles} meta={meta} />)
    const text = container.textContent ?? ''
    expect(text).not.toContain('09/2015 - 06/2022') // no more institution-level aggregate
    expect(text).toContain('BSc in CS')
    expect(text).toContain('09/2015 - 06/2019') // role 1's own date
    expect(text).toContain('09/2020 - 06/2022') // role 2's own date
    expect(text).toContain('MSc in CS')
    expect(text).toContain('Score: 3.9')
  })
})
