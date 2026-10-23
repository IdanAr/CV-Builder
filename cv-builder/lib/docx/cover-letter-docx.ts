import {
  AlignmentType, BorderStyle, Document, LevelFormat, Paragraph, TextRun, convertInchesToTwip,
  type IParagraphStyleOptions, type IParagraphStylePropertiesOptions,
} from 'docx'
import { parseRichText } from '@/lib/rich-text'
import { letterBlocks } from '@/lib/coverletter/body'
import { letterLocale } from '@/lib/coverletter/header'
import { resolveAccent } from '@/lib/coverletter/accent'
import type { CoverLetterRenderInput } from '@/lib/coverletter/render-input'
import { mapFont } from './fonts'

const BODY_SIZE = 22 // half-points: 11pt
const NAME_SIZE = 32 // 16pt
const SMALL_SIZE = 20 // 10pt
const BULLET_REF = 'letter-bullets'

const EDGE_INDENT = 240
const EDGE_BAR_SIZE = 32
const RULE_SIZE = 8

/**
 * Named paragraph styles, one per kind of paragraph. Each paragraph also carries
 * the same spacing, alignment and border as direct formatting, which Word uses;
 * Pages drops direct paragraph formatting from a paragraph that has no named
 * style, so the style is what keeps the layout there.
 */
const STYLE = {
  centered: 'LetterCentered',
  centeredRule: 'LetterCenteredRule',
  edge: 'LetterEdge',
  line: 'LetterLine',
  block: 'LetterBlock',
  body: 'LetterBody',
  bullet: 'LetterBullet',
  bulletEnd: 'LetterBulletEnd',
} as const

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

function letterStyle(id: string, name: string, paragraph: IParagraphStylePropertiesOptions): IParagraphStyleOptions {
  return { id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true, paragraph }
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
  // docx wants bare hex, without the "#".
  const accent = resolveAccent(input.accentColor).slice(1)
  const rule = { bottom: { style: BorderStyle.SINGLE, size: RULE_SIZE, color: accent, space: 6 } }
  const edgeBar = { left: { style: BorderStyle.SINGLE, size: EDGE_BAR_SIZE, color: accent, space: 8 } }

  const header: Paragraph[] = []
  if (design === 'accent-edge') {
    if (name || contact) {
      const children: TextRun[] = []
      if (name) children.push(new TextRun({ text: name, font: nameFont, size: NAME_SIZE, bold: true, color: accent }))
      if (contact) children.push(new TextRun({ text: contact, font: bodyFont, size: SMALL_SIZE, break: name ? 1 : undefined }))
      header.push(new Paragraph({
        children,
        style: STYLE.edge,
        indent: { left: EDGE_INDENT },
        border: edgeBar,
        spacing: { after: 360 },
      }))
    }
  } else {
    if (name) {
      header.push(new Paragraph({
        children: [new TextRun({ text: name, font: nameFont, size: NAME_SIZE, bold: true })],
        style: contact ? STYLE.centered : STYLE.centeredRule,
        alignment: AlignmentType.CENTER,
        spacing: { after: contact ? 40 : 360 },
        ...(contact ? {} : { border: rule }),
      }))
    }
    if (contact) {
      header.push(new Paragraph({
        children: [new TextRun({ text: contact, font: bodyFont, size: SMALL_SIZE })],
        style: STYLE.centeredRule,
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
      style: STYLE.block,
      spacing: { after: 240 },
    }))
  }
  recipient.forEach((line, i) => {
    const last = i === recipient.length - 1
    preamble.push(new Paragraph({
      children: [new TextRun({ text: line, font: bodyFont, size: BODY_SIZE })],
      style: last ? STYLE.block : STYLE.line,
      spacing: { after: last ? 240 : 0 },
    }))
  })
  if (subject) {
    preamble.push(new Paragraph({
      children: [new TextRun({ text: subject, font: bodyFont, size: BODY_SIZE, bold: true })],
      style: STYLE.block,
      spacing: { after: 240 },
    }))
  }

  const body: Paragraph[] = []
  for (const block of letterBlocks(content)) {
    if (block.kind === 'text') {
      body.push(new Paragraph({ children: richTextRuns(block.text, bodyFont), style: STYLE.body, spacing: { after: 200 } }))
    } else {
      block.items.forEach((item, i) => {
        const last = i === block.items.length - 1
        body.push(new Paragraph({
          children: richTextRuns(item, bodyFont),
          style: last ? STYLE.bulletEnd : STYLE.bullet,
          numbering: { reference: BULLET_REF, level: 0 },
          spacing: { after: last ? 200 : 40 },
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
      paragraphStyles: [
        { id: 'Normal', name: 'Normal', quickFormat: true, run: { font: bodyFont, size: BODY_SIZE }, paragraph: { spacing: { after: 0 } } },
        letterStyle(STYLE.centered, 'Letter Centered', { alignment: AlignmentType.CENTER, spacing: { after: 40 } }),
        letterStyle(STYLE.centeredRule, 'Letter Centered Rule', { alignment: AlignmentType.CENTER, spacing: { after: 360 }, border: rule }),
        letterStyle(STYLE.edge, 'Letter Edge', { indent: { left: EDGE_INDENT }, spacing: { after: 360 }, border: edgeBar }),
        letterStyle(STYLE.line, 'Letter Line', { spacing: { after: 0 } }),
        letterStyle(STYLE.block, 'Letter Block', { spacing: { after: 240 } }),
        letterStyle(STYLE.body, 'Letter Body', { spacing: { after: 200 } }),
        letterStyle(STYLE.bullet, 'Letter Bullet', { spacing: { after: 40 } }),
        letterStyle(STYLE.bulletEnd, 'Letter Bullet End', { spacing: { after: 200 } }),
      ],
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
