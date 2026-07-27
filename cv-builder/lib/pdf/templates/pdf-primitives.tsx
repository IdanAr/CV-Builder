import type { Style } from '@react-pdf/types'

/**
 * @react-pdf resolves a unitless `lineHeight` against the fontSize in scope
 * *where it is declared*, then inherits the resulting absolute value. A page
 * that declares `{ fontSize: 11, lineHeight: 1.15 }` therefore hands a 12.65pt
 * line box to a 22pt heading, which then overlaps whatever follows it.
 *
 * Re-declaring `lineHeight` on every style that overrides `fontSize` restores
 * a correctly proportioned line box while preserving the user's line-spacing
 * setting.
 */
export function withLineHeights<T extends Record<string, Style>>(
  styles: T,
  lineSpacing: number
): T {
  const out = {} as Record<string, Style>
  for (const [key, style] of Object.entries(styles)) {
    out[key] =
      style && style.fontSize !== undefined && style.lineHeight === undefined
        ? { ...style, lineHeight: lineSpacing }
        : style
  }
  return out as T
}
