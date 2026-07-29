import React from 'react'
import { Text } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import { parseRichText, splitParagraphs } from '@/lib/rich-text'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { registerPdfFonts, pdfFontFamily } from '@/lib/fonts/registry'
import { PARAGRAPH_GAP_PT } from '@/lib/design/tokens'

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
  // One <Text> block per paragraph: paragraphs stay visually distinct via a
  // real inter-block gap instead of a blank line inside a single <Text> — an
  // empty line there has no glyphs to carry the font and forces a bare, unembedded
  // Helvetica fallback into the file.
  const paragraphs = splitParagraphs(text)
  if (paragraphs.length === 0) return null
  const base: Style[] = Array.isArray(baseStyle) ? baseStyle : baseStyle ? [baseStyle] : []
  return paragraphs.map((paragraph, i) => (
    <Text key={i} style={i === 0 ? base : [...base, { marginTop: PARAGRAPH_GAP_PT }]}>
      {richTextInlineRuns(paragraph)}
    </Text>
  ))
}

/** Inline <Text> run nodes for one paragraph, carrying bold/italic/underline. */
function richTextInlineRuns(paragraph: string): React.ReactNode {
  const runs = parseRichText(paragraph)
  if (runs.length === 1 && !runs[0].bold && !runs[0].italic && !runs[0].underline) {
    return runs[0].text
  }
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
