import React from 'react'
import { Text } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import { parseRichText } from '@/lib/rich-text'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { registerPdfFonts, pdfFontFamily } from '@/lib/fonts/registry'

/**
 * Returns the array font-family chain for a picker font name, registering the
 * bundled faces on first use. Previously collapsed every font to a
 * non-embedded base-14 face, which discarded the user's choice and could not
 * represent characters outside WinAnsi.
 */
export function mapToPdfFont(font: string): string[] {
  registerPdfFonts()
  return pdfFontFamily(font)
}

export function inToPt(inches: number): number {
  return inches * 72
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
  baseStyle?: Style | Style[]
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

/**
 * Standard <Document> metadata for all PDF exports. Untagged PDFs are all
 * @react-pdf/renderer can produce, so title/author/language metadata is the
 * structural signal we can give parsers.
 */
export function pdfDocumentProps(data: ResumeData, title?: string) {
  const name = data.basics?.name ?? ''
  return {
    title: title || (name ? `${name} - Resume` : 'Resume'),
    author: name,
    subject: 'Resume',
    language: 'en',
  }
}
