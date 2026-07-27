// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ClassicTemplate } from './ClassicTemplate'
import { ExecutiveTemplate } from './ExecutiveTemplate'
import { MinimalTemplate } from './MinimalTemplate'
import { ModernTemplate } from './ModernTemplate'
import { SidebarTemplate } from './SidebarTemplate'
import { FONT_SUBSTITUTES, fontFaceCss } from '@/lib/fonts/families'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

/**
 * The end-to-end check that the preview asks for fonts the app actually
 * serves. `web-font-family.test.ts` proves `webFontFamily` returns the right
 * string; this proves the templates call it. Before Task 4 every template
 * emitted `font-family: Calibri, Arial, sans-serif` — a name no `@font-face`
 * rule declares — so the browser silently drew a system font while the PDF
 * embedded Carlito. That divergence is invisible to a text-content parity
 * test, which is why it is asserted on the rendered DOM here.
 */

/** Families the app genuinely serves, parsed from the emitted @font-face CSS. */
const registeredFamilies = new Set(
  [...fontFaceCss().matchAll(/font-family:'([^']+)'/g)].map(m => m[1])
)

/** Picker names with no `@font-face` rule of their own — emitting one is the bug. */
const unservedPickerNames = Object.keys(FONT_SUBSTITUTES).filter(
  name => !registeredFamilies.has(name)
)

const TEMPLATES = [
  ['Classic', ClassicTemplate],
  ['Executive', ExecutiveTemplate],
  ['Minimal', MinimalTemplate],
  ['Modern', ModernTemplate],
  ['Sidebar', SidebarTemplate],
] as const

function metaFor(fontFamily: string, templateId: string): ResumeMeta {
  return {
    templateId,
    fontFamily,
    headerFontFamily: fontFamily,
    primaryColor: '#000000',
    accentColor: '#0066cc',
    pageMargins: 1.0,
    lineSpacing: 1.15,
    sectionOrder: ['work', 'education', 'skills'],
    layout: 'single-column',
    columnAssignment: {},
    excludedAtsKeywords: [],
  }
}

const data: ResumeData = {
  basics: { name: 'Jane Smith', label: 'Engineer', summary: 'A summary.' },
  work: [{ name: 'Acme', position: 'Engineer', startDate: '2020', highlights: ['Shipped things'] }],
  education: [{ institution: 'MIT', area: 'CS', studyType: 'BSc' }],
  skills: [{ name: 'Backend', keywords: ['Node.js'] }],
}

/** Every distinct `font-family` value the rendered tree actually sets. */
function emittedFontFamilies(container: HTMLElement): string[] {
  const values = new Set<string>()
  for (const el of container.querySelectorAll<HTMLElement>('*')) {
    const value = el.style.fontFamily
    if (value) values.add(value)
  }
  return [...values]
}

describe('preview templates request served fonts', () => {
  it.each(TEMPLATES)('%s emits only registered families', (name, Template) => {
    for (const picker of Object.keys(FONT_SUBSTITUTES)) {
      const { container, unmount } = render(
        <Template data={data} meta={metaFor(picker, name.toLowerCase())} />
      )
      const emitted = emittedFontFamilies(container)
      expect(emitted.length, `${name}/${picker} sets no font-family at all`).toBeGreaterThan(0)

      const expected = FONT_SUBSTITUTES[picker].family
      for (const value of emitted) {
        const first = value.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
        expect(first, `${name}/${picker} emitted "${value}"`).toBe(expected)
        expect(registeredFamilies.has(first), `${name}/${picker} emitted "${value}"`).toBe(true)
      }
      unmount()
    }
  })

  it.each(TEMPLATES)('%s never emits an unserved picker name', (name, Template) => {
    for (const picker of Object.keys(FONT_SUBSTITUTES)) {
      const { container, unmount } = render(
        <Template data={data} meta={metaFor(picker, name.toLowerCase())} />
      )
      for (const value of emittedFontFamilies(container)) {
        // Tokenize: 'Garamond' is a substring of the legitimate 'EBGaramond',
        // so only a whole family name in the stack counts as a hit.
        const families = value.split(',').map(f => f.trim().replace(/^['"]|['"]$/g, ''))
        for (const unserved of unservedPickerNames) {
          expect(families, `${name}/${picker} emitted "${value}"`).not.toContain(unserved)
        }
      }
      unmount()
    }
  })
})
