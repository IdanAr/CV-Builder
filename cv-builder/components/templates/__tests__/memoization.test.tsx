// @vitest-environment jsdom
//
// Guards the memoization of the five preview templates.
//
// PreviewTab subscribes to the raw editor store, so its body re-runs on every
// keystroke; it passes *debounced* (referentially stable) props down. A plain
// function component re-executes whenever its parent renders regardless of
// prop identity, so before React.memo the 300ms debounce delayed only what
// was displayed and skipped none of the work — rich-text parsing, date
// formatting, role/profile resolution and section ordering across the whole
// résumé, then a full JSX build and diff, per keypress.
//
// Render work is counted by spying on webFontFamily, which every template
// calls while rendering. Counting calls is a proxy for "the body ran", which
// is exactly what memo is supposed to prevent.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const webFontFamilySpy = vi.fn<(f: string) => string>()

vi.mock('@/lib/fonts/families', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/fonts/families')>()
  return {
    ...actual,
    webFontFamily: (family: string) => {
      webFontFamilySpy(family)
      return actual.webFontFamily(family)
    },
  }
})

import { ClassicTemplate } from '../ClassicTemplate'
import { ModernTemplate } from '../ModernTemplate'
import { MinimalTemplate } from '../MinimalTemplate'
import { ExecutiveTemplate } from '../ExecutiveTemplate'
import { SidebarTemplate } from '../SidebarTemplate'

const meta: ResumeMeta = {
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0,
  sidebarRailWidth: 33,
  lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column',
  columnAssignment: {},
  excludedAtsKeywords: [],
}

const data: ResumeData = {
  basics: { name: 'Jane Smith', label: 'Engineer' },
  work: [{ name: 'Acme', position: 'Engineer', startDate: '2020-01', highlights: ['Shipped things'] }],
  education: [{ institution: 'State University', area: 'CS', studyType: 'BSc' }],
  skills: [{ name: 'Languages', keywords: ['TypeScript'] }],
}

const TEMPLATES = [
  ['ClassicTemplate', ClassicTemplate],
  ['ModernTemplate', ModernTemplate],
  ['MinimalTemplate', MinimalTemplate],
  ['ExecutiveTemplate', ExecutiveTemplate],
  ['SidebarTemplate', SidebarTemplate],
] as const

/**
 * Stands in for PreviewTab: re-renders on its own state while handing the
 * template the same prop references, the way a debounced value behaves
 * between ticks.
 */
function Harness({
  Template,
  resumeData,
}: {
  Template: React.ComponentType<{ data: ResumeData; meta: ResumeMeta }>
  resumeData: ResumeData
}) {
  const [tick, setTick] = useState(0)
  return (
    <div>
      <button onClick={() => setTick((t) => t + 1)}>parent render {tick}</button>
      <Template data={resumeData} meta={meta} />
    </div>
  )
}

beforeEach(() => {
  webFontFamilySpy.mockClear()
})

describe.each(TEMPLATES)('%s', (name, Template) => {
  it('does not re-run its body when the parent re-renders with unchanged props', async () => {
    const user = userEvent.setup()
    render(<Harness Template={Template} resumeData={data} />)

    const afterFirstRender = webFontFamilySpy.mock.calls.length
    expect(afterFirstRender).toBeGreaterThan(0)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button'))

    // The assertion that encodes the fix: two parent re-renders, zero extra
    // template work. Without React.memo this grows with every click.
    expect(webFontFamilySpy.mock.calls.length).toBe(afterFirstRender)
  })

  it('still re-renders when the résumé data actually changes', async () => {
    const { rerender } = render(<Harness Template={Template} resumeData={data} />)
    const afterFirstRender = webFontFamilySpy.mock.calls.length

    // A new object, the way the debounce hook produces one on each tick.
    rerender(<Harness Template={Template} resumeData={{ ...data, basics: { name: 'Someone Else' } }} />)

    expect(webFontFamilySpy.mock.calls.length).toBeGreaterThan(afterFirstRender)
    expect(screen.getByText('Someone Else')).toBeTruthy()
  })
})
