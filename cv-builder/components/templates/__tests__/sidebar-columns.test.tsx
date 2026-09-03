// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { SidebarTemplate } from '../SidebarTemplate'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'

const ROOT = join(__dirname, '..', '..', '..')

/**
 * The Sidebar template splits `sectionOrder` into a rail and a main column by
 * `meta.columnAssignment`. Before these tests, each column silently dropped any
 * section it had no `case` for: the preview rail could not draw work, education,
 * volunteer or custom sections, and neither main column could draw skills or
 * languages. Assigning one of those to the wrong side did not move it — it
 * deleted it from the document. Skills or Languages sent to the main column
 * vanished from the exported PDF, so the loss reached the employer.
 */
const SECTIONS = [
  'work', 'education', 'skills', 'certificates', 'awards',
  'publications', 'volunteer', 'languages', 'interests', 'projects',
] as const

const MARKER: Record<string, string> = {
  work: 'AcmeCo', education: 'UniX', skills: 'SkillZ', certificates: 'CertC',
  awards: 'AwardW', publications: 'PubP', volunteer: 'VolOrg', languages: 'LangQ',
  interests: 'IntI', projects: 'ProjJ', 'custom:c1': 'CustomT',
}

const DATA = {
  basics: { name: 'Jane Doe', summary: 'Summary' },
  work: [{ name: 'AcmeCo', position: 'Eng', startDate: '2020' }],
  education: [{ institution: 'UniX', area: 'CS' }],
  skills: [{ name: 'SkillZ' }],
  certificates: [{ name: 'CertC' }],
  awards: [{ title: 'AwardW' }],
  publications: [{ name: 'PubP' }],
  volunteer: [{ organization: 'VolOrg', position: 'Helper' }],
  languages: [{ language: 'LangQ' }],
  interests: [{ name: 'IntI' }],
  projects: [{ name: 'ProjJ' }],
  customSections: [
    { id: 'c1', name: 'Custom', enabledFields: ['summary'], items: [{ id: 'i1', title: 'CustomT', summary: 'body' }] },
  ],
} as never

const ALL = [...SECTIONS, 'custom:c1']

describe('Sidebar template — no section can be assigned into nonexistence', () => {
  it.each(ALL)('renders %s in the rail when assigned left', (section) => {
    const meta = ResumeMetaSchema.parse({
      templateId: 'sidebar', sectionOrder: ALL, columnAssignment: { [section]: 'left' },
    })
    const { container } = render(<SidebarTemplate data={DATA} meta={meta} />)
    expect(container.textContent).toContain(MARKER[section])
  })

  it.each(ALL)('renders %s in the main column when assigned right', (section) => {
    const meta = ResumeMetaSchema.parse({
      templateId: 'sidebar', sectionOrder: ALL, columnAssignment: { [section]: 'right' },
    })
    const { container } = render(<SidebarTemplate data={DATA} meta={meta} />)
    expect(container.textContent).toContain(MARKER[section])
  })

  // The rail used to be a fixed run of `railSections.includes('x') && ...`
  // blocks, so it drew in source order no matter how the user had dragged the
  // section list — while the PDF's rail mapped over sectionOrder and obeyed it.
  it('draws rail sections in sectionOrder, not source order', () => {
    const order = ['projects', 'skills', 'awards']
    const meta = ResumeMetaSchema.parse({
      templateId: 'sidebar',
      sectionOrder: order,
      columnAssignment: Object.fromEntries(order.map((s) => [s, 'left'])),
    })
    const { container } = render(<SidebarTemplate data={DATA} meta={meta} />)
    const drawn = [...container.querySelectorAll('[data-pv-section]')].map((e) => e.getAttribute('data-pv-section'))
    expect(drawn).toEqual(order)
  })
})

/**
 * Structural guard over both renderers in both files. A jsdom matrix cannot
 * cover the PDF (it renders through @react-pdf/renderer), and rendering 22 real
 * PDFs would be far too slow, so this asserts the far cheaper property that
 * actually failed: every column knows every section.
 */
describe('Sidebar renderers are exhaustive over sectionOrder', () => {
  const FILES = {
    'components/templates/SidebarTemplate.tsx': 'live preview',
    'lib/pdf/templates/SidebarPdfTemplate.tsx': 'PDF export',
  }

  /** The body of one renderer: from its declaration to the next one, or EOF. */
  function rendererBody(source: string, fn: 'renderRailSection' | 'renderMainSection'): string {
    const start = source.indexOf(`function ${fn}(`)
    if (start === -1) return ''
    const others = ['function renderRailSection(', 'function renderMainSection(']
      .map((o) => source.indexOf(o, start + 1))
      .filter((i) => i !== -1)
    return source.slice(start, others.length ? Math.min(...others) : source.length)
  }

  for (const [file, label] of Object.entries(FILES)) {
    for (const fn of ['renderRailSection', 'renderMainSection'] as const) {
      const column = fn === 'renderRailSection' ? 'left rail' : 'main column'

      it(`${label}: the ${column} handles every section`, () => {
        const body = rendererBody(readFileSync(join(ROOT, file), 'utf8'), fn)
        expect(body, `${file} has no ${fn}`).not.toBe('')

        const missing = SECTIONS.filter((s) => !body.includes(`case '${s}'`))
        expect(missing, `${file} → ${fn} cannot draw these, so assigning one there deletes it`).toEqual([])
        expect(body.includes("startsWith('custom:')"), `${file} → ${fn} drops custom sections`).toBe(true)
      })
    }
  }
})
