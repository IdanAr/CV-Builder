// lib/coverletter/design.ts
// The letter's visual design. Pure and client-safe: the Zod schema, the editor
// panel and both renderers import it, so it must not pull in server code.

export const LETTER_DESIGNS = ['classic', 'accent-edge'] as const
export type LetterDesign = (typeof LETTER_DESIGNS)[number]

// The CV templates whose look the accent-edge letter matches; every other template gets the classic letter.
const ACCENT_EDGE_TEMPLATES: ReadonlySet<string> = new Set(['modern', 'sidebar'])

/** The design a letter takes when its owner has not chosen one: the one that matches the CV's template. */
export function defaultDesignFor(templateId: string | undefined): LetterDesign {
  return templateId !== undefined && ACCENT_EDGE_TEMPLATES.has(templateId) ? 'accent-edge' : 'classic'
}

/** An explicit choice wins; otherwise the letter follows the CV's template. */
export function resolveDesign(design: LetterDesign | undefined, templateId: string | undefined): LetterDesign {
  return design ?? defaultDesignFor(templateId)
}
