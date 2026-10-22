// lib/coverletter/accent.ts
// One rule for the letter's accent colour, shared by the PDF template and the DOCX
// builder so the two formats never disagree. Pure and client-safe.

/** The CV templates' default accent (ResumeMetaSchema), used when the colour is not a valid hex. */
export const DEFAULT_LETTER_ACCENT = '#0066cc'

const HEX_COLOUR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/**
 * The accent as a lowercase six-digit `#rrggbb`. Accepts `#RGB` and `#RRGGBB`
 * (any case, surrounding space ignored); anything else, including a hex without
 * the leading "#", gives the default.
 */
export function resolveAccent(value: string | undefined): string {
  const match = value === undefined ? null : HEX_COLOUR.exec(value.trim())
  if (!match) return DEFAULT_LETTER_ACCENT
  const hex = match[1].toLowerCase()
  return `#${hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex}`
}
