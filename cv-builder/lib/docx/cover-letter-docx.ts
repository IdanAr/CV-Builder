import { Document, Paragraph, TextRun, convertInchesToTwip } from 'docx'
import { parseRichText, splitParagraphs } from '@/lib/rich-text'
import { letterLocale, type LetterLanguage } from '@/lib/coverletter/header'

function richTextRuns(text: string, font: string): TextRun[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: TextRun[] = []
  lines.forEach((line, i) => {
    if (i > 0) out.push(new TextRun({ text: '', break: 1, font, size: 22 }))
    for (const run of parseRichText(line)) {
      out.push(new TextRun({
        text: run.text,
        font,
        size: 22,
        bold: run.bold || false,
        italics: run.italic || false,
        underline: run.underline ? {} : undefined,
      }))
    }
  })
  return out
}

export interface CoverLetterDocxHeader {
  name?: string
  /** One line: email · phone · city · profile URL. Omitted when empty. */
  contact?: string
  date?: string
}

/**
 * Plain single-column DOCX for cover letter text only — no résumé template involved.
 * The header (name, contact line, date) comes first, as ordinary paragraphs.
 */
export function buildCoverLetterDocx(
  content: string,
  header: CoverLetterDocxHeader = {},
  font = 'Arial',
  language: LetterLanguage = 'en',
): Document {
  const bodyParagraphs = splitParagraphs(content).map((lines) => new Paragraph({
    children: richTextRuns(lines.join('\n'), font),
    spacing: { after: 200 },
  }))

  const headerLines: Array<{ text: string; size: number; bold: boolean }> = []
  if (header.name) headerLines.push({ text: header.name, size: 28, bold: true })
  if (header.contact) headerLines.push({ text: header.contact, size: 20, bold: false })
  if (header.date) headerLines.push({ text: header.date, size: 20, bold: false })

  const headerParagraphs = headerLines.map((line, i) => new Paragraph({
    children: [new TextRun({ text: line.text, font, size: line.size, bold: line.bold })],
    spacing: { after: i === headerLines.length - 1 ? 240 : 40 },
  }))

  const locale = letterLocale(language)

  return new Document({
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
      children: [...headerParagraphs, ...bodyParagraphs],
    }],
  })
}
