import { Font } from '@react-pdf/renderer'
import path from 'node:path'
import { accessSync, constants, existsSync } from 'node:fs'
import {
  FONT_SUBSTITUTES,
  DEFAULT_PICKER_FONT,
  SUBSETS,
  WEIGHTS,
  STYLES,
  GLYPH_FALLBACK,
  HEBREW_FALLBACK,
} from './families'

// Re-exported so `lib/pdf/templates/pdf-utils.tsx` and existing tests can keep
// importing `FONT_SUBSTITUTES` from `registry.ts` unchanged. The canonical
// declaration now lives in `families.ts` (client-safe, no Node/@react-pdf).
export { FONT_SUBSTITUTES }

/**
 * Locate a font file on disk.
 *
 * `require.resolve` of a template literal is unreliable under Turbopack: it
 * was expected to throw `ERR_INVALID_ARG_TYPE` on a numeric module id (caught
 * below), but the observed behavior under `next dev --turbopack` is worse —
 * it *returns a string* using Turbopack's `[project]/...` pseudo-root
 * notation (e.g. `[project]/cv-builder/node_modules/@fontsource/arimo/package.json`),
 * which is not a real filesystem path but passes the old `typeof === 'string'`
 * guard. Every custom font family then failed its later `accessSync` probe
 * with ENOENT, `pdfFontFamily` silently degraded to base-14 Helvetica, and
 * every PDF export in dev — not just Hebrew/non-Latin text — lost its
 * embedded fonts. `existsSync` now verifies the resolved path is real before
 * trusting it, falling through to the `process.cwd()` form otherwise (also
 * verified against a real production deploy — this used to be the untested,
 * "riskiest" fallback but is now the only path proven to work here).
 */
function fontFile(slug: string, subset: string, weight: number, style: string): string {
  const file = `${slug}-${subset}-${weight}-${style}.woff`
  try {
    const pkgJson = require.resolve(`@fontsource/${slug}/package.json`)
    if (typeof pkgJson === 'string') {
      const resolved = path.join(path.dirname(pkgJson), 'files', file)
      if (existsSync(resolved)) return resolved
    }
  } catch {
    // fall through
  }
  return path.join(process.cwd(), 'node_modules', '@fontsource', slug, 'files', file)
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

  // Dedicated Hebrew-glyph fallback, sourced from Arimo's `hebrew` subset —
  // the only @fontsource package among FONT_SUBSTITUTES that ships one.
  // Registered once, outside the per-family loop above, and outside its
  // 'latin'/'latin-ext' SUBSETS naming scheme.
  try {
    const fonts = WEIGHTS.flatMap(weight =>
      STYLES.map(fontStyle => ({
        src: fontFile('arimo', 'hebrew', weight, fontStyle),
        fontWeight: weight,
        fontStyle,
      }))
    )
    for (const font of fonts) accessSync(font.src, constants.R_OK)
    Font.register({ family: HEBREW_FALLBACK, fonts })
    available.add(HEBREW_FALLBACK)
  } catch (err) {
    console.error(`[fonts] failed to register ${HEBREW_FALLBACK}:`, err)
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
  const chain = [entry.family, `${entry.family}Ext`, GLYPH_FALLBACK, HEBREW_FALLBACK]
  const usable = [...new Set(chain)].filter(f => available.has(f))
  // Everything failed to register: name the built-in so the export still
  // renders (degraded) instead of throwing "Font family not registered".
  return usable.length > 0 ? usable : ['Helvetica']
}
