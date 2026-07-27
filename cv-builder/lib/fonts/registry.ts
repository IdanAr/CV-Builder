import { Font } from '@react-pdf/renderer'
import path from 'node:path'
import { accessSync, constants } from 'node:fs'

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

const DEFAULT_PICKER_FONT = 'Calibri'

/** `latin` lacks U+20AA (₪); `latin-ext` covers U+20A0-20AB. */
const SUBSETS = ['latin', 'latin-ext'] as const
const WEIGHTS = [400, 700] as const

/**
 * Italic must be registered explicitly. `ExecutivePdfTemplate` sets
 * `fontStyle: 'italic'`, which previously rode on @react-pdf's automatic
 * base-14 italic; once real fonts are registered, an unregistered italic
 * throws `Could not resolve font` and crashes the render. All eight
 * @fontsource packages ship italic files at both weights and both subsets.
 */
const STYLES = ['normal', 'italic'] as const

/**
 * Last resort in every font chain.
 *
 * Being in the `latin-ext` *range* does not mean a face actually draws the
 * glyph. Verified with fontkit against @fontsource 5.3.0: Carlito, Arimo,
 * Roboto and IBM Plex Sans carry U+20AA; Caladea, Gelasio, EB Garamond and
 * Lato do not. Without a third link in the chain, a Cambria / Georgia /
 * Garamond / Lato résumé falls through to @react-pdf's built-in Helvetica and
 * reprints the original `ª` corruption — measured, not hypothetical.
 *
 * Appending CarlitoExt costs a glyph-level typeface mismatch on the handful of
 * characters the chosen family cannot draw. That is strictly better than
 * printing the wrong character, which is what the alternative does.
 */
const GLYPH_FALLBACK = 'CarlitoExt'

/**
 * Resolve through the module graph rather than process.cwd(): on Vercel the
 * working directory of a serverless function is not guaranteed to be the app
 * root, and a cwd-relative path is the classic "works locally, 500s in
 * production" failure. require.resolve follows whatever layout the tracer
 * produced. The cwd form stays as a last-resort fallback.
 */
function fontFile(slug: string, subset: string, weight: number, style: string): string {
  const file = `${slug}-${subset}-${weight}-${style}.woff`
  try {
    const pkgJson = require.resolve(`@fontsource/${slug}/package.json`)
    return path.join(path.dirname(pkgJson), 'files', file)
  } catch {
    return path.join(process.cwd(), 'node_modules', '@fontsource', slug, 'files', file)
  }
}

let registered = false

/**
 * Families we successfully registered. `pdfFontFamily` filters chains through
 * this so a family that failed to register is never named in a style — naming
 * an unregistered family throws `Font family not registered` at render time.
 */
const available = new Set<string>()

/**
 * Idempotent. @react-pdf rejects .woff2 but accepts .woff, and has no
 * unicode-range support — so each family is registered twice and consumed as
 * an array fontFamily, which @react-pdf resolves as a fallback chain.
 */
export function registerPdfFonts(): void {
  if (registered) return
  const seen = new Set<string>()
  for (const { family, slug } of Object.values(FONT_SUBSTITUTES)) {
    if (seen.has(family)) continue // Arial and Helvetica share Arimo
    seen.add(family)
    try {
      for (const subset of SUBSETS) {
        const registeredFamily = subset === 'latin' ? family : `${family}Ext`
        const fonts = WEIGHTS.flatMap(weight =>
          STYLES.map(fontStyle => ({
            src: fontFile(slug, subset, weight, fontStyle),
            fontWeight: weight,
            fontStyle,
          }))
        )
        // `Font.register` performs NO file I/O — it only records a descriptor.
        // fontkit reads the file lazily during the first render that uses the
        // face, which is outside this try/catch and would surface as a 500.
        // Verified: register() with a nonexistent path does not throw, while
        // the subsequent render throws ENOENT. Probe readability here so an
        // unreadable font is caught while we can still degrade gracefully.
        for (const font of fonts) accessSync(font.src, constants.R_OK)
        Font.register({ family: registeredFamily, fonts })
        available.add(registeredFamily)
      }
    } catch (err) {
      // A missing or unreadable font file must never 500 an export. The family
      // stays out of `available`, so chains skip it and fall back.
      console.error(`[fonts] failed to register ${family}:`, err)
    }
  }
  Font.registerHyphenationCallback(word => [word]) // browsers don't hyphenate
  registered = true
}

/**
 * The font chain for a picker name — pass straight to a `fontFamily` style
 * property. @react-pdf resolves an array as a per-glyph fallback chain.
 */
export function pdfFontFamily(pickerName: string): string[] {
  registerPdfFonts()
  const entry = FONT_SUBSTITUTES[pickerName] ?? FONT_SUBSTITUTES[DEFAULT_PICKER_FONT]
  const chain = [entry.family, `${entry.family}Ext`, GLYPH_FALLBACK]
  const usable = [...new Set(chain)].filter(f => available.has(f))
  // Everything failed to register: name the built-in so the export still
  // renders (degraded) instead of throwing "Font family not registered".
  return usable.length > 0 ? usable : ['Helvetica']
}

/** `@font-face` rules so the browser preview loads the same files. */
export function fontFaceCss(): string {
  const seen = new Set<string>()
  const rules: string[] = []
  for (const { family, slug } of Object.values(FONT_SUBSTITUTES)) {
    if (seen.has(family)) continue
    seen.add(family)
    for (const weight of WEIGHTS) {
      rules.push(
        `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;` +
        `font-display:swap;src:url('/fonts/${slug}-latin-${weight}-normal.woff') format('woff');}`
      )
    }
  }
  return rules.join('\n')
}
