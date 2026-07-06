// lib/schemas/__tests__/resume.zod.test.ts
import { describe, it, expect } from 'vitest'
import {
  CreateResumeSchema,
  PatchResumeSchema,
  ResumeMetaSchema,
  ResumeDataSchema,
  CustomSectionSchema,
} from '../resume.zod'

describe('ResumeDataSchema', () => {
  it('accepts an empty object', () => {
    expect(ResumeDataSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a valid basics block', () => {
    const result = ResumeDataSchema.safeParse({
      basics: { name: 'Ada Lovelace', email: 'ada@example.com' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a partial/malformed email in basics (no format check at save layer)', () => {
    const result = ResumeDataSchema.safeParse({
      basics: { email: 'not-an-email' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a partially typed email (mid-keystroke state)', () => {
    const result = ResumeDataSchema.safeParse({
      basics: { email: 'user@gm' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts work array with highlights', () => {
    const result = ResumeDataSchema.safeParse({
      work: [{ name: 'Acme', position: 'Engineer', highlights: ['Built X', 'Shipped Y'] }],
    })
    expect(result.success).toBe(true)
  })
})

describe('ResumeMetaSchema', () => {
  it('applies all defaults when given empty object', () => {
    const result = ResumeMetaSchema.parse({})
    expect(result.templateId).toBe('classic')
    expect(result.fontFamily).toBe('Calibri')
    expect(result.headerFontFamily).toBe('Calibri')
    expect(result.primaryColor).toBe('#000000')
    expect(result.pageMargins).toBe(1.0)
    expect(result.lineSpacing).toBe(1.15)
    expect(result.layout).toBe('single-column')
  })

  it('rejects pageMargins below 0.5', () => {
    const result = ResumeMetaSchema.safeParse({ pageMargins: 0.4 })
    expect(result.success).toBe(false)
  })

  it('rejects pageMargins above 1.5', () => {
    const result = ResumeMetaSchema.safeParse({ pageMargins: 2.0 })
    expect(result.success).toBe(false)
  })

  it('rejects lineSpacing outside 1.0–1.15', () => {
    expect(ResumeMetaSchema.safeParse({ lineSpacing: 0.9 }).success).toBe(false)
    expect(ResumeMetaSchema.safeParse({ lineSpacing: 1.5 }).success).toBe(false)
  })

  it('rejects unknown layout value', () => {
    const result = ResumeMetaSchema.safeParse({ layout: 'three-column' })
    expect(result.success).toBe(false)
  })
})

describe('CreateResumeSchema', () => {
  it('requires a non-empty title', () => {
    expect(CreateResumeSchema.safeParse({ title: '' }).success).toBe(false)
    expect(CreateResumeSchema.safeParse({ title: 'My CV' }).success).toBe(true)
  })

  it('defaults data and meta when not provided', () => {
    const result = CreateResumeSchema.parse({ title: 'My CV' })
    expect(result.data).toEqual({})
    expect(result.meta.templateId).toBe('classic')
  })
})

describe('PatchResumeSchema', () => {
  it('accepts an empty patch (all fields optional)', () => {
    expect(PatchResumeSchema.safeParse({}).success).toBe(true)
  })

  it('accepts partial meta', () => {
    const result = PatchResumeSchema.safeParse({ meta: { fontFamily: 'Arial' } })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.meta?.fontFamily).toBe('Arial')
  })

  it('only includes explicitly provided meta fields — no default bleed', () => {
    const result = PatchResumeSchema.safeParse({ meta: { fontFamily: 'Arial' } })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.meta).toEqual({ fontFamily: 'Arial' })
      expect(result.data.meta?.templateId).toBeUndefined()
    }
  })
})

describe('CreateResumeSchema', () => {
  it('creates a fresh meta object on each parse (no shared reference)', () => {
    const r1 = CreateResumeSchema.parse({ title: 'CV 1' })
    const r2 = CreateResumeSchema.parse({ title: 'CV 2' })
    expect(r1.meta).not.toBe(r2.meta)
    expect(r1.meta.sectionOrder).not.toBe(r2.meta.sectionOrder)
  })

  it('rejects whitespace-only title', () => {
    expect(CreateResumeSchema.safeParse({ title: '   ' }).success).toBe(false)
  })
})

describe('CustomSectionSchema', () => {
  it('accepts a valid custom section with items', () => {
    const result = CustomSectionSchema.safeParse({
      id: 'abc',
      name: 'My Section',
      enabledFields: ['summary', 'highlights'],
      items: [{ id: 'i1', title: 'Entry', summary: 'Details' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid enabledFields value', () => {
    const result = CustomSectionSchema.safeParse({
      id: 'abc',
      name: 'X',
      enabledFields: ['bogusField'],
      items: [],
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty items and enabledFields', () => {
    const result = CustomSectionSchema.safeParse({
      id: 'x', name: 'Y', enabledFields: [], items: [],
    })
    expect(result.success).toBe(true)
  })
})

describe('ResumeDataSchema — customSections', () => {
  it('accepts data with customSections array', () => {
    const result = ResumeDataSchema.safeParse({
      customSections: [{
        id: 's1',
        name: 'Publications',
        enabledFields: ['subtitle', 'dateRange', 'url'],
        items: [{ id: 'i1', title: 'My Paper', subtitle: 'Journal X', startDate: '2024-01' }],
      }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts data without customSections (optional)', () => {
    expect(ResumeDataSchema.safeParse({}).success).toBe(true)
  })
})

describe('ResumeMetaSchema — updated sectionOrder default', () => {
  // Sprint 2 promotes certificates/awards/publications/interests/projects to
  // first-class, natively-editable sections (editor forms + template rendering
  // now exist for all 5), so the default sectionOrder must include them —
  // matching models/Resume.ts's Mongoose-level default exactly.
  it('default sectionOrder includes all 10 native sections in the canonical order', () => {
    const result = ResumeMetaSchema.parse({})
    expect(result.sectionOrder).toEqual([
      'work',
      'education',
      'skills',
      'certificates',
      'awards',
      'publications',
      'volunteer',
      'languages',
      'interests',
      'projects',
    ])
  })
})
