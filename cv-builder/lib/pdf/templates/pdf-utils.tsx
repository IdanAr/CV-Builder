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
  // Helvetica fallback into the file. Within a paragraph, each line is its own
  // nested <Text> so a soft line break (single \n) renders as a real new line
  // without the full paragraph gap.
  const paragraphs = splitParagraphs(text)
  if (paragraphs.length === 0) return null
  const base: Style[] = Array.isArray(baseStyle) ? baseStyle : baseStyle ? [baseStyle] : []
  return paragraphs.map((lines, i) => (
    <Text key={i} style={i === 0 ? base : [...base, { marginTop: PARAGRAPH_GAP_PT }]}>
      {lines.map((line, li) => (
        <Text key={li} style={li === 0 ? undefined : { marginTop: 0 }}>
          {richTextInlineRuns(line, li > 0 ? '\n' : '')}
        </Text>
      ))}
    </Text>
  ))
}

/**
 * Inline <Text> run nodes for one line, carrying bold/italic/underline.
 * `prefix` (a literal '\n' for soft-break lines after the first) is folded
 * into the first run's own text rather than rendered as a sibling text node —
 * a bare '\n' as its own child hits the same base-14 fallback as an empty
 * line, since it carries no glyphs of its own to anchor an embedded font.
 */
function richTextInlineRuns(line: string, prefix = ''): React.ReactNode {
  const runs = parseRichText(line)
  if (runs.length === 1 && !runs[0].bold && !runs[0].italic && !runs[0].underline) {
    return prefix + runs[0].text
  }
  return runs.map((run, i) => {
    const style: Record<string, string> = {}
    if (run.bold) style.fontWeight = 'bold'
    if (run.italic) style.fontStyle = 'italic'
    if (run.underline) style.textDecoration = 'underline'
    return (
      <Text key={i} style={Object.keys(style).length ? style : undefined}>
        {i === 0 ? prefix + run.text : run.text}
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
