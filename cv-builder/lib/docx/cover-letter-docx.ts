import {
  AlignmentType, BorderStyle, Document, LevelFormat, Paragraph, TextRun, convertInchesToTwip,
} from 'docx'
import { parseRichText } from '@/lib/rich-text'
import { letterBlocks } from '@/lib/coverletter/body'
import { letterLocale } from '@/lib/coverletter/header'
import type { CoverLetterRenderInput } from '@/lib/coverletter/render-input'
import { mapFont } from './fonts'

// The CV templates' default accent (ResumeMetaSchema), used when the colour is not a valid hex.
const DEFAULT_ACCENT = '0066cc'
const HEX_COLOUR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** A six-digit hex without the "#", which is how Word wants colours. */
function accentOf(value: string | undefined): string {
  const match = value === undefined ? null : HEX_COLOUR.exec(value.trim())
  if (!match) return DEFAULT_ACCENT
  const hex = match[1].toLowerCase()
  return hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
}

const BODY_SIZE = 22 // half-points: 11pt
const NAME_SIZE = 32 // 16pt
const SMALL_SIZE = 20 // 10pt
const BULLET_REF = 'letter-bullets'

function richTextRuns(text: string, font: string): TextRun[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: TextRun[] = []
  lines.forEach((line, i) => {
    if (i > 0) out.push(new TextRun({ text: '', break: 1, font, size: BODY_SIZE }))
    for (const run of parseRichText(line)) {
      out.push(new TextRun({
        text: run.text,
        font,
        size: BODY_SIZE,
        bold: run.bold || false,
        italics: run.italic || false,
        underline: run.underline ? {} : undefined,
      }))
    }
  })
  return out
}

/**
 * Single-column DOCX for a cover letter, in one of two designs: "classic"
 * (centred header over a thin accent rule) or "accent-edge" (left-aligned header
 * beside a thick accent bar). Reading order is the same in both and in the PDF:
 * name, contact, date, recipient, subject, then the body.
 *
 * Native paragraphs only: no tables, text boxes, floating shapes, images or
 * columns. Lists are real Word bullets, one paragraph per item. `fontScale` is
 * ignored here; the export route applies it to the packed document.
 */
export function buildCoverLetterDocx(input: CoverLetterRenderInput): Document {
  const { content, design, language, name, contact, date, recipient, subject, title } = input
  const bodyFont = mapFont(input.font ?? 'Arial')
  const nameFont = input.headerFont ? mapFont(input.headerFont) : bodyFont
  const accent = accentOf(input.accentColor)

  const header: Paragraph[] = []
  if (design === 'accent-edge') {
    if (name || contact) {
      const children: TextRun[] = []
      if (name) children.push(new TextRun({ text: name, font: nameFont, size: NAME_SIZE, bold: true, color: accent }))
      if (contact) children.push(new TextRun({ text: contact, font: bodyFont, size: SMALL_SIZE, break: name ? 1 : undefined }))
      header.push(new Paragraph({
        children,
        indent: { left: 240 },
        border: { left: { style: BorderStyle.SINGLE, size: 24, color: accent, space: 8 } },
        spacing: { after: 360 },
      }))
    }
  } else {
    const rule = { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 6 } }
    if (name) {
      header.push(new Paragraph({
        children: [new TextRun({ text: name, font: nameFont, size: NAME_SIZE, bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: contact ? 40 : 360 },
        ...(contact ? {} : { border: rule }),
      }))
    }
    if (contact) {
      header.push(new Paragraph({
        children: [new TextRun({ text: contact, font: bodyFont, size: SMALL_SIZE })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 360 },
        border: rule,
      }))
    }
  }

  const preamble: Paragraph[] = []
  if (date) {
    preamble.push(new Paragraph({
      children: [new TextRun({ text: date, font: bodyFont, size: SMALL_SIZE })],
      spacing: { after: 240 },
    }))
  }
  recipient.forEach((line, i) => {
    preamble.push(new Paragraph({
      children: [new TextRun({ text: line, font: bodyFont, size: BODY_SIZE })],
      spacing: { after: i === recipient.length - 1 ? 240 : 0 },
    }))
  })
  if (subject) {
    preamble.push(new Paragraph({
      children: [new TextRun({ text: subject, font: bodyFont, size: BODY_SIZE, bold: true })],
      spacing: { after: 240 },
    }))
  }

  const body: Paragraph[] = []
  for (const block of letterBlocks(content)) {
    if (block.kind === 'text') {
      body.push(new Paragraph({ children: richTextRuns(block.text, bodyFont), spacing: { after: 200 } }))
    } else {
      block.items.forEach((item, i) => {
        body.push(new Paragraph({
          children: richTextRuns(item, bodyFont),
          numbering: { reference: BULLET_REF, level: 0 },
          spacing: { after: i === block.items.length - 1 ? 200 : 40 },
        }))
      })
    }
  }

  const locale = letterLocale(language)

  return new Document({
    title,
    creator: name,
    subject: 'Cover Letter',
    numbering: {
      config: [{
        reference: BULLET_REF,
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 260 } } },
        }],
      }],
    },
    styles: {
      default: {
        document: { run: { language: language === 'he' ? { value: locale, bidirectional: locale } : { value: locale } } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
          },
        },
      },
      children: [...header, ...preamble, ...body],
    }],
  })
}
