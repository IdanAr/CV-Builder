import { describe, it, expect } from 'vitest'
import { DEFAULT_SECTION_ORDER, defaultSectionOrder, resolveSectionOrder } from '@/lib/sections'
import { ResumeMetaSchema, PatchResumeSchema } from '@/lib/schemas/resume.zod'
import type { PatchResumeInput, ResumeMeta } from '@/lib/schemas/resume.zod'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'

const EXPECTED = [
  'work', 'education', 'skills', 'certificates', 'awards',
  'publications', 'volunteer', 'languages', 'interests', 'projects',
]

describe('DEFAULT_SECTION_ORDER is the single source of truth', () => {
  it('lists every built-in section', () => {
    expect([...DEFAULT_SECTION_ORDER]).toEqual(EXPECTED)
  })

  it('is what the Zod schema defaults to', () => {
    expect(ResumeMetaSchema.parse({}).sectionOrder).toEqual(EXPECTED)
  })

  it("is what the editor store's initial meta holds", () => {
    expect(useResumeEditorStore.getState().meta.sectionOrder).toEqual(EXPECTED)
  })

  it('is what an absent or empty sectionOrder resolves to', () => {
    expect(resolveSectionOrder({ sectionOrder: [] })).toEqual(EXPECTED)
    expect(resolveSectionOrder({} as { sectionOrder: string[] })).toEqual(EXPECTED)
  })

  it('hands every caller its own array', () => {
    // The Zod default and the store default both go straight to code that
    // reorders in place (DesignPanel's arrayMove, EditTab's "+ Add Section"),
    // so a shared instance would let one resume's edits leak into the next.
    const a = ResumeMetaSchema.parse({}).sectionOrder
    const b = ResumeMetaSchema.parse({}).sectionOrder
    expect(a).not.toBe(b)
    expect(defaultSectionOrder()).not.toBe(DEFAULT_SECTION_ORDER)

    a.push('custom:leak')
    expect(ResumeMetaSchema.parse({}).sectionOrder).toEqual(EXPECTED)
    expect([...DEFAULT_SECTION_ORDER]).toEqual(EXPECTED)
  })

  it('keeps an explicit order untouched', () => {
    expect(resolveSectionOrder({ sectionOrder: ['skills', 'work'] })).toEqual(['skills', 'work'])
  })
})

describe('ResumeMetaSchema.partial() as the patch schema', () => {
  it('does not materialise defaults for keys the patch omits', () => {
    // patchResume writes back every key that comes out defined, as a
    // `meta.<key>` dot-path $set. If .partial() reapplied the underlying
    // defaults, a one-field design tweak would silently reset template,
    // fonts, colours, margins and section order on every autosave.
    const parsed = PatchResumeSchema.parse({ meta: { templateId: 'modern' } })
    expect(parsed.meta).toEqual({ templateId: 'modern' })
    expect(Object.keys(parsed.meta ?? {})).toEqual(['templateId'])
  })

  it('accepts every meta key, so the two schemas cannot drift apart', () => {
    const full = ResumeMetaSchema.parse({})
    const parsed = PatchResumeSchema.parse({ meta: full })
    expect(parsed.meta).toEqual(full)
  })

  it('still enforces the bounds the full schema declares', () => {
    expect(() => PatchResumeSchema.parse({ meta: { pageMargins: 9 } })).toThrow()
    expect(() => PatchResumeSchema.parse({ meta: { layout: 'three-column' } })).toThrow()
  })
})

describe('the derived patch schema keeps its inferred type', () => {
  it('types meta as every ResumeMeta key, each optional', () => {
    // A compile-time check, not a runtime one: undefaultedShape needs an
    // `as unknown as` to build its mapped type, so this is what stops that
    // cast from quietly drifting away from the real ResumeMeta shape.
    const empty: PatchResumeInput['meta'] = {}
    const everyKey: Required<NonNullable<PatchResumeInput['meta']>> = ResumeMetaSchema.parse({})
    const roundTrip: ResumeMeta = { ...ResumeMetaSchema.parse({}), ...everyKey }
    expect(empty).toEqual({})
    expect(roundTrip.sectionOrder).toEqual(EXPECTED)
  })
})
