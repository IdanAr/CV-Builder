import React from 'react'
import { View, Text } from '@react-pdf/renderer'
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

/**
 * A bullet with a true hanging indent, matching the web `<ul>`: the marker
 * occupies a fixed-width column and the body flexes, so wrapped lines align
 * with the first line's text rather than with the marker.
 */
export function PdfBullet({
  style, indent, gap, children,
}: {
  style?: Style | Style[]
  indent: number
  gap: number
  children: React.ReactNode
}) {
  const base: Style[] = Array.isArray(style) ? style : style ? [style] : []
  return (
    <View style={{ flexDirection: 'row', marginLeft: indent }} wrap={false}>
      <Text style={[...base, { width: gap * 2 }]}>{'•'}</Text>
      <Text style={[...base, { flex: 1 }]}>{children}</Text>
    </View>
  )
}

/**
 * Entry head row matching the web's `justify-content: space-between`.
 * Content-stream order stays left-then-right, so ATS reading order is
 * unaffected. AtsPdfTemplate deliberately does not use this — its inline
 * `Name | Dates` form is already linear and correct.
 */
export function PdfEntryHead({
  left, right, style,
}: {
  left: React.ReactNode
  right?: React.ReactNode
  style?: Style
}) {
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }, style ?? {}]}>
      <Text>{left}</Text>
      {right ? <Text>{right}</Text> : null}
    </View>
  )
}

/**
 * Space that must remain below a section heading before @react-pdf will place
 * it on the current page. Three body lines, derived at render time so it
 * tracks the user's line-spacing setting rather than hardcoding 38pt.
 */
export function sectionReserve(pageFontSize: number, lineSpacing: number): number {
  return 3 * pageFontSize * lineSpacing
}

/** Two body lines — enough that an entry head is followed by its first bullet. */
export function entryReserve(pageFontSize: number, lineSpacing: number): number {
  return 2 * pageFontSize * lineSpacing
}
