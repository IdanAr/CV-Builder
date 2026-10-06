import React, { createContext, useContext } from 'react'
import { Text as PdfText, Link as PdfLink, Page as PdfPage } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import { scalePt } from '@/lib/design/font-scale'

/**
 * `meta.fontScale` for the PDF. Rather than editing ~100 literal sizes across
 * six templates, the templates import these drop-in Text / Link / Page
 * components, which multiply `style.fontSize` by the scale carried in context.
 * react-pdf resolves a unitless lineHeight against the fontSize declared on the
 * same element, so scaling fontSize in place keeps line boxes proportionate.
 */
const FontScaleContext = createContext(1)

export const FontScaleProvider = FontScaleContext.Provider

export function useFontScale(): number {
  return useContext(FontScaleContext)
}

type StyleInput = Style | false | null | undefined | StyleInput[]

function flatten(style: StyleInput, into: Style): Style {
  if (!style) return into
  if (Array.isArray(style)) {
    for (const s of style) flatten(s, into)
    return into
  }
  return Object.assign(into, style)
}

/** Identity (same reference) at scale 1 so existing output cannot change. */
export function scaleStyle<T extends StyleInput>(style: T, k: number): Style | undefined {
  if (style === undefined || style === null || style === false) return undefined
  if (k === 1 && !Array.isArray(style)) return style as Style
  const flat = flatten(style, {})
  if (typeof flat.fontSize === 'number') flat.fontSize = scalePt(flat.fontSize, k)
  return flat
}

type TextProps = React.ComponentProps<typeof PdfText>
type LinkProps = React.ComponentProps<typeof PdfLink>
type PageProps = React.ComponentProps<typeof PdfPage>

export function Text({ style, ...rest }: TextProps) {
  const k = useFontScale()
  return <PdfText {...rest} style={scaleStyle(style as StyleInput, k)} />
}

export function Link({ style, ...rest }: LinkProps) {
  const k = useFontScale()
  return <PdfLink {...rest} style={scaleStyle(style as StyleInput, k)} />
}

export function Page({ style, ...rest }: PageProps) {
  const k = useFontScale()
  return <PdfPage {...rest} style={scaleStyle(style as StyleInput, k)} />
}
