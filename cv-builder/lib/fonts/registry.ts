import { Font } from '@react-pdf/renderer'
import path from 'node:path'

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
 * Several templates (e.g. ExecutivePdfTemplate's subtitle/degree styles) set
 * `fontStyle: 'italic'`. @react-pdf's built-in base-14 faces carry italic
 * automatically, but a custom-registered family does not unless the italic
 * file is registered too — an unregistered style throws `Could not resolve
 * font for <family>, fontWeight <n>, fontStyle italic` and aborts the whole
 * render, rather than falling back gracefully. Every @fontsource package used
 * here ships italic files at the same weights, so both styles are registered.
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
        Font.register({
          family: subset === 'latin' ? family : `${family}Ext`,
          fonts: WEIGHTS.flatMap(weight =>
            STYLES.map(style => ({
              src: fontFile(slug, subset, weight, style),
              fontWeight: weight,
              fontStyle: style,
            }))
          ),
        })
      }
    } catch (err) {
      // A missing or unreadable font file must never 500 an export. The
      // template falls back to @react-pdf's built-in Helvetica.
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
  const entry = FONT_SUBSTITUTES[pickerName] ?? FONT_SUBSTITUTES[DEFAULT_PICKER_FONT]
  const chain = [entry.family, `${entry.family}Ext`, GLYPH_FALLBACK]
  return [...new Set(chain)] // Carlito is its own fallback; don't list it twice
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
