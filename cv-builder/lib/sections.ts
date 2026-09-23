import type { ResumeData, ResumeMeta } from './schemas/resume.zod'

/**
 * The built-in resume sections, in the order a new resume shows them.
 *
 * Single source of truth. The Zod default, the editor store's initial meta,
 * all five preview templates, both exporters and sectionsFilledCount below
 * all read this list. They each used to keep a private copy, and the two
 * exporters' copies had gone stale at the original five entries -- so a
 * resume whose meta.sectionOrder was missing or empty rendered certificates,
 * awards, publications, interests and projects on screen and silently
 * dropped all five from every PDF and DOCX, including ATS mode.
 *
 * Adding a built-in section means adding it here and nowhere else.
 */
export const DEFAULT_SECTION_ORDER = [
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
] as const satisfies readonly string[]

export type BuiltInSection = (typeof DEFAULT_SECTION_ORDER)[number]

/**
 * A fresh mutable copy of the default order.
 *
 * Every caller gets its own array: the Zod default and the editor store both
 * hand theirs to code that reorders and appends in place, so sharing one
 * instance would let one resume's edits leak into the next parse.
 */
export function defaultSectionOrder(): string[] {
  return [...DEFAULT_SECTION_ORDER]
}

/**
 * The section list to render for a resume.
 *
 * A missing or empty `sectionOrder` falls back to the full built-in set --
 * the same list the editor would have written for any resume created through
 * the normal path, so the fallback matches what the user would otherwise see
 * rather than inventing a narrower document.
 */
export function resolveSectionOrder(meta: Pick<ResumeMeta, 'sectionOrder'>): string[] {
  return meta.sectionOrder?.length > 0 ? meta.sectionOrder : defaultSectionOrder()
}

export function sectionsFilledCount(data: ResumeData): number {
  return DEFAULT_SECTION_ORDER.filter((section: BuiltInSection) => {
    const val = data[section]
    return Array.isArray(val) && val.length > 0
  }).length
}
