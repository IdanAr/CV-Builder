import type { Style } from '@react-pdf/types'
import { scalePt } from '@/lib/design/font-scale'

/**
 * `meta.fontScale` for the PDF. Pure and explicit, mirroring `withLineHeights`:
 * each template passes its stylesheet through `withFontScale` (after
 * `withLineHeights`, so the heading line-height floor keys off the declared,
 * unscaled size) and scales its few inline literals with `scalePt`. There is
 * deliberately no React context here: these modules are imported by Next route
 * handlers, and Next forbids creating context in the server module graph.
 * react-pdf resolves a unitless lineHeight against the fontSize declared on the
 * same element, so scaling fontSize in place keeps line boxes proportionate.
 */

/** Scales every style's numeric `fontSize`; the same object at scale 1. */
export function withFontScale<T extends Record<string, Style>>(styles: T, scale: number): T {
  if (scale === 1) return styles
  const out = {} as Record<string, Style>
  for (const [key, style] of Object.entries(styles)) {
    out[key] = style && typeof style.fontSize === 'number'
      ? { ...style, fontSize: scalePt(style.fontSize, scale) }
      : style
  }
  return out as T
}
