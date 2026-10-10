/**
 * Heading + body font presets over `meta.headerFontFamily` / `meta.fontFamily`.
 * A pairing is not stored: it is recognised by value, so an old CV that happens
 * to use Cambria headings with Calibri body simply shows "Editorial" selected.
 * Names must exist in FONT_SUBSTITUTES (guarded by a test) so the preview and
 * the PDF can both draw them.
 */
export interface Pairing {
  id: string
  label: string
  heading: string
  body: string
}

export const PAIRINGS: Pairing[] = [
  { id: 'clean', label: 'Clean', heading: 'Calibri', body: 'Calibri' },
  { id: 'editorial', label: 'Editorial', heading: 'Cambria', body: 'Calibri' },
  { id: 'executive', label: 'Executive', heading: 'Georgia', body: 'Arial' },
  { id: 'refined', label: 'Refined', heading: 'Garamond', body: 'Lato' },
  { id: 'modern', label: 'Modern', heading: 'Roboto', body: 'Roboto' },
  { id: 'technical', label: 'Technical', heading: 'IBM Plex Sans', body: 'IBM Plex Sans' },
]

export function matchPairing(heading: string, body: string): Pairing | undefined {
  return PAIRINGS.find((p) => p.heading === heading && p.body === body)
}
