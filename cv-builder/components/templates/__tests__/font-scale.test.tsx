// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ClassicTemplate } from '../ClassicTemplate'
import { ModernTemplate } from '../ModernTemplate'
import { MinimalTemplate } from '../MinimalTemplate'
import { ExecutiveTemplate } from '../ExecutiveTemplate'
import { SidebarTemplate } from '../SidebarTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const TEMPLATES = [
  ['classic', ClassicTemplate],
  ['modern', ModernTemplate],
  ['minimal', MinimalTemplate],
  ['executive', ExecutiveTemplate],
  ['sidebar', SidebarTemplate],
] as const

const data: ResumeData = {
  basics: { name: 'Jane Smith', label: 'Engineer', email: 'j@x.com', summary: 'Hello.' },
  work: [{ name: 'Acme', position: 'Dev', startDate: '2020-01', summary: 'Did things.', highlights: ['Cut costs 40%'] }],
  education: [{ institution: 'MIT', area: 'CS', studyType: 'BSc', endDate: '2016-06' }],
  skills: [{ name: 'TS', keywords: ['React'] }],
  languages: [{ language: 'English', fluency: 'Native' }],
  customSections: [{
    id: 'c1', name: 'Patents', enabledFields: ['subtitle', 'url', 'summary', 'highlights', 'keywords', 'level'],
    items: [{ id: 'i1', title: 'Cache', subtitle: 'Co-inventor', url: 'x.dev', summary: 'Granted.', highlights: ['One'], keywords: ['a'], level: 'Expert' }],
  }],
}

function metaFor(templateId: string, fontScale: number): ResumeMeta {
  return {
    templateId, fontFamily: 'Calibri', headerFontFamily: 'Calibri',
    primaryColor: '#1e3a5f', accentColor: '#0066cc',
    pageMargins: 0.75, sidebarRailWidth: 33, lineSpacing: 1.15, fontScale,
    sectionOrder: ['work', 'education', 'skills', 'languages', 'custom:c1'],
    layout: 'single-column', columnAssignment: {}, excludedAtsKeywords: [],
  }
}

/** Every font-size (in pt) set inline anywhere in the rendered tree, in document order. */
function fontSizes(container: HTMLElement): number[] {
  const out: number[] = []
  const all = [container, ...Array.from(container.querySelectorAll<HTMLElement>('*'))]
  for (const el of all) {
    const m = /^([0-9.]+)pt$/.exec(el.style?.fontSize ?? '')
    if (m) out.push(parseFloat(m[1]))
  }
  return out
}

describe.each(TEMPLATES)('%s preview font scale', (id, Template) => {
  it('scales every inline font size by the same factor', () => {
    const base = fontSizes(render(<Template data={data} meta={metaFor(id, 1)} />).container)
    const big = fontSizes(render(<Template data={data} meta={metaFor(id, 1.05)} />).container)
    expect(base.length).toBeGreaterThan(8)
    expect(big).toHaveLength(base.length)
    base.forEach((n, i) => expect(big[i]).toBeCloseTo(n * 1.05, 1))
  })

  it('renders identically at scale 1 and with the field absent', () => {
    const withField = render(<Template data={data} meta={metaFor(id, 1)} />).container.innerHTML
    const { fontScale: _omit, ...rest } = metaFor(id, 1)
    const without = render(<Template data={data} meta={rest as unknown as ResumeMeta} />).container.innerHTML
    expect(without).toBe(withField)
  })

  it('leaves no unscaled pt literal behind (everything goes through sz())', () => {
    const base = new Set(fontSizes(render(<Template data={data} meta={metaFor(id, 1)} />).container))
    const big = fontSizes(render(<Template data={data} meta={metaFor(id, 1.07)} />).container)
    for (const n of big) expect(base.has(n)).toBe(false)
  })
})
