import { PDFParse } from 'pdf-parse'
import * as mammoth from 'mammoth'

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

const PDF_MIME = 'application/pdf'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MIN_TEXT_LENGTH = 50

export async function parseFile(buffer: Buffer, mimeType: string): Promise<string> {
  let text: string

  try {
    if (mimeType === PDF_MIME) {
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      text = result.text
    } else if (mimeType === DOCX_MIME) {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else {
      throw new ParseError(
        'Unsupported file type. Please upload a PDF or DOCX file.'
      )
    }
  } catch (err) {
    if (err instanceof ParseError) throw err
    throw new ParseError(
      'Could not read the file. It may be password-protected or corrupted.'
    )
  }

  if (!text || text.trim().length < MIN_TEXT_LENGTH) {
    throw new ParseError(
      'Could not extract readable text. The file may be a scanned image-only PDF. Try exporting it as a text-based PDF or DOCX from Word.'
    )
  }

  return text.trim()
}
