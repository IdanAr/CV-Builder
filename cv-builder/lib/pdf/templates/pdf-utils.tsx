import React from 'react'
import { Text } from '@react-pdf/renderer'
import { parseRichText } from '@/lib/rich-text'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

export function mapToPdfFont(font: string): string {
  const serifFonts = ['Garamond', 'Georgia', 'Cambria']
  return serifFonts.includes(font) ? 'Times-Roman' : 'Helvetica'
}

export function inToPt(inches: number): number {
  return inches * 72
}

export function formatContact(basics: {
  email?: string
  phone?: string
  location?: { city?: string; region?: string }
}): string {
  const location = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
  return [basics.email, basics.phone, location].filter(Boolean).join(' · ')
}

export const DEFAULT_SECTION_ORDER = [
  'work', 'education', 'skills', 'volunteer', 'languages',
]

export function resolveSectionOrder(meta: ResumeMeta): string[] {
  return meta.sectionOrder?.length > 0 ? meta.sectionOrder : DEFAULT_SECTION_ORDER
}

export function ensureHttps(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

/**
 * Renders a rich-text string as a @react-pdf/renderer <Text> element with nested
 * <Text> children for bold/italic/underline runs. Returns null for falsy input.
 */
export function renderPdfRichText(
  text: string | undefined | null,
  baseStyle?: object
): React.ReactNode {
  if (!text) return null
  const runs = parseRichText(text)
  if (runs.length === 1 && !runs[0].bold && !runs[0].italic && !runs[0].underline) {
    return <Text style={baseStyle}>{runs[0].text}</Text>
  }
  return (
    <Text style={baseStyle}>
      {runs.map((run, i) => {
        const style: Record<string, string> = {}
        if (run.bold) style.fontWeight = 'bold'
        if (run.italic) style.fontStyle = 'italic'
        if (run.underline) style.textDecoration = 'underline'
        return (
          <Text key={i} style={Object.keys(style).length ? style : undefined}>
            {run.text}
          </Text>
        )
      })}
    </Text>
  )
}

/**
 * Returns an array of inline <Text> run nodes (no outer wrapper) for use inside
 * a caller-owned <Text> element — e.g. bullet items that prepend "• ".
 */
export function renderPdfRichTextRuns(text: string): React.ReactNode[] {
  const runs = parseRichText(text)
  return runs.map((run, i) => {
    const style: Record<string, string> = {}
    if (run.bold) style.fontWeight = 'bold'
    if (run.italic) style.fontStyle = 'italic'
    if (run.underline) style.textDecoration = 'underline'
    return (
      <Text key={i} style={Object.keys(style).length ? style : undefined}>
        {run.text}
      </Text>
    )
  })
}
