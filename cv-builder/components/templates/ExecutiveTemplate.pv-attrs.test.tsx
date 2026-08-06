// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ExecutiveTemplate } from './ExecutiveTemplate'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'
import type { ResumeData } from '@/lib/schemas/resume.zod'

const meta = ResumeMetaSchema.parse({})

const data: ResumeData = {
  basics: { name: 'Jane Doe' },
  work: [{ name: 'Acme' }, { name: 'Globex' }],
  education: [{ institution: 'State U' }],
  skills: [{ name: 'TypeScript' }],
  customSections: [{ id: 'abc', name: 'Custom', enabledFields: [], items: [{ id: 'i1', title: 'One' }] }],
}

describe('ExecutiveTemplate data-pv-* attributes', () => {
  it('tags each rendered section with data-pv-section', () => {
    const { container } = render(
      <ExecutiveTemplate data={data} meta={{ ...meta, sectionOrder: ['work', 'education', 'skills', 'custom:abc'] }} />
    )
    expect(container.querySelector('[data-pv-section="work"]')).toBeTruthy()
    expect(container.querySelector('[data-pv-section="education"]')).toBeTruthy()
    expect(container.querySelector('[data-pv-section="skills"]')).toBeTruthy()
    expect(container.querySelector('[data-pv-section="custom:abc"]')).toBeTruthy()
  })

  it('tags each entry within a section with data-pv-entry, indexed within its own section', () => {
    const { container } = render(<ExecutiveTemplate data={data} meta={{ ...meta, sectionOrder: ['work'] }} />)
    const workSection = container.querySelector('[data-pv-section="work"]')!
    const entries = workSection.querySelectorAll('[data-pv-entry]')
    expect(entries.length).toBe(2)
    expect(entries[0].getAttribute('data-pv-entry')).toBe('0')
    expect(entries[1].getAttribute('data-pv-entry')).toBe('1')
  })

  it('tags custom section entries too', () => {
    const { container } = render(
      <ExecutiveTemplate data={data} meta={{ ...meta, sectionOrder: ['custom:abc'] }} />
    )
    const customSection = container.querySelector('[data-pv-section="custom:abc"]')!
    expect(customSection.querySelector('[data-pv-entry="0"]')).toBeTruthy()
  })

  it('does not tag a section with zero entries (it does not render at all)', () => {
    const { container } = render(
      <ExecutiveTemplate data={{}} meta={{ ...meta, sectionOrder: ['work'] }} />
    )
    expect(container.querySelector('[data-pv-section="work"]')).toBeNull()
  })
})
