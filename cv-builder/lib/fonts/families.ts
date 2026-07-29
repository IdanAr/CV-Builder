/**
 * Client-safe font metadata and CSS helpers.
 *
 * No Node built-in modules (fs, path) and no react-pdf renderer package
 * imports belong in this file — it is imported by `'use client'` preview
 * templates and `app/layout.tsx`, which run in the browser bundle. Anything
 * that needs Node or react-pdf (font file resolution, `Font.register`)
 * stays in `registry.ts`.
 */

/**
 * Six of the nine picker fonts (Calibri, Cambria, Georgia, Arial, Helvetica)
 * are proprietary and cannot be embedded. Each maps to an open substitute;
 * all but EB Garamond are metric-compatible, so line breaks are unchanged.
 */
export const FONT_SUBSTITUTES: Record<string, { family: string; slug: string }> = {
  'Calibri':       { family: 'Carlito',       slug: 'carlito' },
  'Cambria':       { family: 'Caladea',       slug: 'caladea' },
  'Arial':         { family: 'Arimo',         slug: 'arimo' },
  'Helvetica':     { family: 'Arimo',         slug: 'arimo' },
  'Georgia':       { family: 'Gelasio',       slug: 'gelasio' },
  'Garamond':      { family: 'EBGaramond',    slug: 'eb-garamond' },
  'Lato':          { family: 'Lato',          slug: 'lato' },
  'Roboto':        { family: 'Roboto',        slug: 'roboto' },
  'IBM Plex Sans': { family: 'IBMPlexSans',   slug: 'ibm-plex-sans' },
}

export const DEFAULT_PICKER_FONT = 'Calibri'

/** `latin` lacks U+20AA (₪); `latin-ext` covers U+20A0-20AB. */
export const SUBSETS = ['latin', 'latin-ext'] as const
export const WEIGHTS = [400, 700] as const

/**
 * Italic must be registered explicitly. `ExecutivePdfTemplate` sets
 * `fontStyle: 'italic'`, which previously rode on react-pdf's automatic
 * base-14 italic; once real fonts are registered, an unregistered italic
 * throws `Could not resolve font` and crashes the render. All eight
 * @fontsource packages ship italic files at both weights and both subsets.
 */
export const STYLES = ['normal', 'italic'] as const

/**
 * Last resort in every font chain.
 *
 * Being in the `latin-ext` *range* does not mean a face actually draws the
 * glyph. Verified with fontkit against @fontsource 5.3.0: Carlito, Arimo,
 * Roboto and IBM Plex Sans carry U+20AA; Caladea, Gelasio, EB Garamond and
 * Lato do not. Without a third link in the chain, a Cambria / Georgia /
 * Garamond / Lato résumé falls through to react-pdf's built-in Helvetica and
 * reprints the original `ª` corruption — measured, not hypothetical.
 *
 * Appending CarlitoExt costs a glyph-level typeface mismatch on the handful of
 * characters the chosen family cannot draw. That is strictly better than
 * printing the wrong character, which is what the alternative does.
 */
export const GLYPH_FALLBACK = 'CarlitoExt'

/**
 * `@font-face` rules so the browser preview loads the same files the PDF
 * embeds. Must cover italic as well as normal: ExecutiveTemplate and
 * ClassicTemplate render `fontStyle: 'italic'`, and without a matching
 * `@font-face` the browser fakes italic by shearing the regular face while
 * the PDF embeds the genuine italic — a letterform mismatch the word-level
 * parity test in Task 7 can't detect. Only the `latin` subset is served; the
 * `latin-ext` subset exists solely for PDF glyph fallback and the browser
 * resolves any missing glyphs on its own.
 */
export function fontFaceCss(): string {
  const seen = new Set<string>()
  const rules: string[] = []
  for (const { family, slug } of Object.values(FONT_SUBSTITUTES)) {
    if (seen.has(family)) continue
    seen.add(family)
    for (const weight of WEIGHTS) {
      for (const style of STYLES) {
        rules.push(
          `@font-face{font-family:'${family}';font-weight:${weight};font-style:${style};` +
          `font-display:swap;src:url('/fonts/${slug}-latin-${weight}-${style}.woff') format('woff');}`
        )
      }
    }
  }
  return rules.join('\n')
}

/** Substitutes whose generic CSS fallback should be serif rather than sans. */
const SERIF_FAMILIES = new Set(['Caladea', 'Gelasio', 'EBGaramond'])

/**
 * The CSS `font-family` stack a preview template must use.
 *
 * The browser-side counterpart to `pdfFontFamily`, and not optional:
 * `fontFaceCss` registers faces under *substitute* names (Carlito, Caladea, …)
 * while the résumé's `meta.fontFamily` holds the *picker* name (Calibri,
 * Cambria, …). A template that sets `font-family: Calibri` matches no
 * registered face and silently falls back to a system font — the divergence
 * this phase exists to remove. Only Lato and Roboto would work by coincidence,
 * because their substitute name equals their picker name.
 */
export function webFontFamily(pickerName: string): string {
  const entry = FONT_SUBSTITUTES[pickerName] ?? FONT_SUBSTITUTES[DEFAULT_PICKER_FONT]
  const generic = SERIF_FAMILIES.has(entry.family) ? 'serif' : 'sans-serif'
  return `'${entry.family}', ${generic}`
}
