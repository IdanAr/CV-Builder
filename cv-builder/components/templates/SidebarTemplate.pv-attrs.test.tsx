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

  // `interests` is the one section whose entries were converted from a bare
  // React.Fragment into a `display: inline` <div> so they could carry the
  // measurement attributes — cover it explicitly, in both columns, since
  // Sidebar renders interests twice (main column and rail).
  it('tags interests entries with data-pv-entry in the main column (Fragment -> inline div conversion)', () => {
    const { container } = render(
      <SidebarTemplate
        data={{ ...data, interests: [{ name: 'Chess', keywords: ['openings'] }, { name: 'Cycling' }] }}
        meta={{ ...meta, sectionOrder: ['interests'] }}
      />
    )
    expect(container.querySelectorAll('[data-pv-section="interests"]').length).toBe(1)
    const section = container.querySelector('[data-pv-section="interests"]')!
    const entries = section.querySelectorAll<HTMLElement>('[data-pv-entry]')
    expect(entries.length).toBe(2)
    expect(entries[0].style.display).toBe('inline')
    expect(entries[0].getAttribute('data-pv-entry')).toBe('0')
    expect(entries[1].getAttribute('data-pv-entry')).toBe('1')
    expect(entries[0].textContent).toContain('Chess')
    expect(entries[1].textContent).toContain('Cycling')
  })

  it('tags interests entries with data-pv-entry in the rail when column-assigned there', () => {
    const { container } = render(
      <SidebarTemplate
        data={{ ...data, interests: [{ name: 'Chess' }, { name: 'Cycling' }] }}
        meta={{ ...meta, sectionOrder: ['interests'], columnAssignment: { interests: 'left' } }}
      />
    )
    // Exactly one interests section renders — the rail one, not the main
    // column's (whose entries carry the `display: inline` style instead).
    expect(container.querySelectorAll('[data-pv-section="interests"]').length).toBe(1)
    const section = container.querySelector('[data-pv-section="interests"]')!
    const entries = section.querySelectorAll<HTMLElement>('[data-pv-entry]')
    expect(entries.length).toBe(2)
    expect(entries[0].style.display).toBe('')
    expect(entries[0].getAttribute('data-pv-entry')).toBe('0')
    expect(entries[1].getAttribute('data-pv-entry')).toBe('1')
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
