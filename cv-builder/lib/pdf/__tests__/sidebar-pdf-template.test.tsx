import React from 'react'
import { describe, it, expect } from 'vitest'
import { SidebarPdfTemplate } from '../templates/SidebarPdfTemplate'
import { ExecutivePdfTemplate } from '../templates/ExecutivePdfTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const baseMeta: ResumeMeta = {
  templateId: 'sidebar', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f', accentColor: '#0066cc',
  pageMargins: 1.0, lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills', 'languages'],
  layout: 'two-column', columnAssignment: {}, excludedAtsKeywords: [],
}

const data: ResumeData = {
  basics: {
    name: 'Jane Smith', label: 'Principal Architect',
    email: 'jane.smith@example.com', phone: '+1 555 0100',
    location: { city: 'Tel Aviv', region: 'IL' },
    summary: 'Engineer with a decade of platform experience.',
  },
  work: [{ name: 'Acme Corp', position: 'Senior Engineer', startDate: '2020-01', highlights: ['Cut infra costs 40%'] }],
  education: [{ institution: 'MIT', area: 'Computer Science', studyType: 'BSc', startDate: '2012-09', endDate: '2016-06' }],
  skills: [{ name: 'TypeScript', level: 'Expert', keywords: ['React', 'Node.js'] }],
  languages: [{ language: 'English', fluency: 'Native' }],
}

type AnyElement = { props?: { style?: unknown; children?: unknown } }

/** Flattens every style object found in an element subtree. */
function collectStyles(node: unknown, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (node == null || typeof node !== 'object') return acc
  if (Array.isArray(node)) {
    node.forEach((n) => collectStyles(n, acc))
    return acc
  }
  const el = node as AnyElement
  if (el.props) {
    const s = el.props.style
    if (Array.isArray(s)) s.forEach((x) => x && acc.push(x as Record<string, unknown>))
    else if (s && typeof s === 'object') acc.push(s as Record<string, unknown>)
    collectStyles(el.props.children, acc)
  }
  return acc
}

/** Finds the flattened style of the element whose sole child is the given text. */
function findStyleOfText(node: unknown, text: string): Record<string, unknown> | null {
  if (node == null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findStyleOfText(n, text)
      if (found) return found
    }
    return null
  }
  const el = node as AnyElement
  if (!el.props) return null
  if (el.props.children === text) {
    const s = el.props.style
    if (Array.isArray(s)) return Object.assign({}, ...s)
    return (s as Record<string, unknown>) ?? {}
  }
  return findStyleOfText(el.props.children, text)
}

function getPageColumns(meta: ResumeMeta) {
  const doc = SidebarPdfTemplate({ data, meta }) as unknown as AnyElement
  const page = doc.props!.children as AnyElement
  const children = (page.props!.children as AnyElement[]).filter(Boolean)
  const [rail, main] = children
  return { rail, main }
}

describe('SidebarPdfTemplate margin floor', () => {
  it('never pads rail or main column below 0.5in (36pt) for any pageMargins in [0.5, 1.5]', () => {
    for (const pageMargins of [0.5, 0.6, 0.75, 1.0, 1.25, 1.5]) {
      const { rail, main } = getPageColumns({ ...baseMeta, pageMargins })
      const railStyle = rail.props!.style as { padding: number }
      const mainStyle = main.props!.style as { padding: number }
      expect(railStyle.padding, `rail padding at pageMargins=${pageMargins}`).toBeGreaterThanOrEqual(36)
      expect(mainStyle.padding, `main padding at pageMargins=${pageMargins}`).toBeGreaterThanOrEqual(36)
    }
  })
})

describe('SidebarPdfTemplate rail typography bands', () => {
  it('keeps every rail font size at or above the 10pt body floor', () => {
    const { rail } = getPageColumns(baseMeta)
    const styles = collectStyles(rail)
    const sizes = styles
      .map((s) => s.fontSize)
      .filter((v): v is number => typeof v === 'number')
    expect(sizes.length).toBeGreaterThan(0)
    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(10)
    }
  })

  it('keeps rail section titles at or above the 12pt section-header floor', () => {
    const { rail } = getPageColumns(baseMeta)
    const titleStyles = collectStyles(rail).filter((s) => s.textTransform === 'uppercase')
    expect(titleStyles.length).toBeGreaterThan(0)
    for (const s of titleStyles) {
      expect(s.fontSize as number).toBeGreaterThanOrEqual(12)
    }
  })
})

describe('SidebarPdfTemplate rail section-title separator', () => {
  it('uses the accent color for the rail section-title separator', () => {
    const meta = { ...baseMeta, accentColor: '#ff00aa' }
    const { rail } = getPageColumns(meta)
    const styles = collectStyles(rail)
    const found = styles.some((s) => s.borderBottomColor === '#ff00aa')
    expect(found).toBe(true)
  })
})

describe('ExecutivePdfTemplate name band', () => {
  it('clamps the name to 22pt (top of the 18-22pt band)', () => {
    const doc = ExecutivePdfTemplate({
      data,
      meta: { ...baseMeta, templateId: 'executive', layout: 'single-column' },
    }) as unknown as AnyElement
    const nameStyle = findStyleOfText(doc, 'Jane Smith')
    expect(nameStyle).not.toBeNull()
    expect(nameStyle!.fontSize).toBe(22)
  })
})
