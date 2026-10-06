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
        ? { ...style, lineHeight: lineHeightFor(style.fontSize as number, lineSpacing) }
        : style
  }
  return out as T
}

/** Text at or above this size gets the floor below. */
const HEADING_FONT_SIZE = 16
/**
 * Smallest line box a heading may have, as a multiple of its font size.
 * Derived from the worst measured case rather than picked: IBM Plex Sans has a
 * -0.24em descender and a 0.698em cap height, so a 22pt name over a 12pt
 * headline needs 5.28 + 8.38 = 13.66pt of clearance. At lineSpacing 1.0 it got
 * 12.5pt and the two lines overlapped.
 */
const HEADING_MIN_LINE_HEIGHT = 1.15

/**
 * A unitless lineHeight resolves against the font size where it is declared,
 * so the same multiplier that reads comfortably at 10pt body text produces a
 * line box smaller than the glyphs' own ink extent at 22pt. The user's line
 * spacing slider allows 1.0-1.15; at 1.0 and 1.05 a name with descenders
 * (g, j, p, q, y) collided with the headline beneath it in most template and
 * font combinations. Body text keeps the user's exact setting — only headings
 * get a floor, and only when their setting is below it, so 1.15 is unchanged.
 */
export function lineHeightFor(fontSize: number, lineSpacing: number): number {
  return fontSize >= HEADING_FONT_SIZE
    ? Math.max(lineSpacing, HEADING_MIN_LINE_HEIGHT)
    : lineSpacing
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
  // Deliberately NOT wrap={false}. `highlights` is an unbounded string array in
  // the schema, so a single pasted bullet can exceed a page — and react-pdf
  // silently discards everything past the page bottom of a non-wrapping View
  // rather than erroring. A ~14.5k-character highlight rendered as one page
  // with the tail simply missing. Letting the row wrap costs a bullet split
  // across a page break; forbidding it costs the user's content.
  return (
    <View style={{ flexDirection: 'row', marginLeft: indent }}>
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
