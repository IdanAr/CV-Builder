import { Font } from '@react-pdf/renderer'
import path from 'node:path'
import { accessSync, constants } from 'node:fs'
import {
  FONT_SUBSTITUTES,
  DEFAULT_PICKER_FONT,
  SUBSETS,
  WEIGHTS,
  STYLES,
  GLYPH_FALLBACK,
} from './families'

// Re-exported so `lib/pdf/templates/pdf-utils.tsx` and existing tests can keep
// importing `FONT_SUBSTITUTES` from `registry.ts` unchanged. The canonical
// declaration now lives in `families.ts` (client-safe, no Node/@react-pdf).
export { FONT_SUBSTITUTES }

/**
 * Locate a font file on disk.
 *
 * **In a production build, `process.cwd()` is the only live path.** Turbopack
 * compiles `require.resolve` of a template literal into a *context module*,
 * whose `resolve` returns the numeric module id rather than a filename —
 * verified in the built chunk: `moduleContext.resolve = (id) => map[id].id()`.
 * `path.dirname(1010)` then throws `ERR_INVALID_ARG_TYPE`, which the guard
 * below catches. Under Vitest and plain Node the same call does return a real
 * path, so the module-graph branch is live in tests and dead in production —
 * the reverse of what matters.
 *
 * This is left as a best-effort first attempt rather than deleted, because it
 * works wherever `require.resolve` is genuine. But the cwd form is not a
 * "last resort": on Vercel it is the one that runs, and it is only correct
 * while the function's working directory is the app root. That assumption is
 * unverified — Task 10's preview-deploy check was never run — and it is the
 * single riskiest thing in this feature. A wrong cwd does not 500: every
 * family fails its `accessSync` probe, `pdfFontFamily` degrades to
 * base-14 Helvetica, and the export silently reprints the `ª`-for-₪ corruption
 * this phase exists to remove, visible only as `[fonts] failed to register`
 * lines in the platform log.
 */
function fontFile(slug: string, subset: string, weight: number, style: string): string {
  const file = `${slug}-${subset}-${weight}-${style}.woff`
  try {
    const pkgJson = require.resolve(`@fontsource/${slug}/package.json`)
    // Guard the bundler case explicitly instead of relying on dirname throwing.
    if (typeof pkgJson === 'string') {
      return path.join(path.dirname(pkgJson), 'files', file)
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
