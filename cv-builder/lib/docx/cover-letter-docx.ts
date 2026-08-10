import { Document, Paragraph, TextRun, convertInchesToTwip } from 'docx'
import { parseRichText, splitParagraphs } from '@/lib/rich-text'

function richTextRuns(text: string, font: string): TextRun[] {
  return parseRichText(text).map((run) => new TextRun({
    text: run.text,
    font,
    size: 22,
    bold: run.bold || false,
    italics: run.italic || false,
    underline: run.underline ? {} : undefined,
  }))
}

/** Plain single-column DOCX for cover letter text only — no résumé template involved. */
export function buildCoverLetterDocx(content: string, name?: string, font = 'Arial'): Document {
  const bodyParagraphs = splitParagraphs(content).map((paragraph) => new Paragraph({
    children: richTextRuns(paragraph, font),
    spacing: { after: 200 },
  }))

  const children = name
    ? [
        new Paragraph({
          children: [new TextRun({ text: name, font, size: 28, bold: true })],
          spacing: { after: 240 },
        }),
        ...bodyParagraphs,
      ]
    : bodyParagraphs

  return new Document({
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
      children,
    }],
  })
}
