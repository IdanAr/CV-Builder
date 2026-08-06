// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SidebarTemplate } from './SidebarTemplate'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'
import type { ResumeData } from '@/lib/schemas/resume.zod'

const meta = ResumeMetaSchema.parse({})

const data: ResumeData = {
  basics: { name: 'Jane Doe' },
  work: [{ name: 'Acme' }, { name: 'Globex' }],
  skills: [{ name: 'TypeScript' }],
  languages: [{ language: 'English' }],
  certificates: [{ name: 'AWS' }],
}

describe('SidebarTemplate data-pv-* attributes', () => {
  it('tags a main-column section (work) with data-pv-section and its entries with data-pv-entry', () => {
    const { container } = render(
      <SidebarTemplate data={data} meta={{ ...meta, sectionOrder: ['work'] }} />
    )
    const workSection = container.querySelector('[data-pv-section="work"]')!
    expect(workSection).toBeTruthy()
    const entries = workSection.querySelectorAll('[data-pv-entry]')
    expect(entries.length).toBe(2)
  })

  it('tags rail-only sections (skills, languages) with data-pv-section', () => {
    const { container } = render(
      <SidebarTemplate data={data} meta={{ ...meta, sectionOrder: ['skills', 'languages'] }} />
    )
    expect(container.querySelector('[data-pv-section="skills"]')).toBeTruthy()
    expect(container.querySelector('[data-pv-section="languages"]')).toBeTruthy()
  })

  it('tags certificates in the main column by default (SIDEBAR_COLUMN_DEFAULTS only defaults skills/languages to the rail)', () => {
    const { container } = render(
      <SidebarTemplate data={data} meta={{ ...meta, sectionOrder: ['certificates'] }} />
    )
    const certSection = container.querySelector('[data-pv-section="certificates"]')!
    expect(certSection).toBeTruthy()
    expect(certSection.querySelector('[data-pv-entry="0"]')).toBeTruthy()
  })

  it('tags certificates in the rail when explicitly column-assigned there', () => {
    const { container } = render(
      <SidebarTemplate
        data={data}
        meta={{ ...meta, sectionOrder: ['certificates'], columnAssignment: { certificates: 'left' } }}
      />
    )
    const certSection = container.querySelector('[data-pv-section="certificates"]')!
    expect(certSection).toBeTruthy()
    expect(certSection.querySelector('[data-pv-entry="0"]')).toBeTruthy()
  })
})
