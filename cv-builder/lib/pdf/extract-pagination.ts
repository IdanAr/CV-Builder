// lib/pdf/extract-pagination.ts
// Reads ground-truth pagination out of a rendered PDF buffer: the page
// count, plus the first text of every page after the first ("anchors").
// The client locates each anchor inside the HTML preview DOM to pin the
// page-break divider to the exact line where the exported PDF breaks.
import { PDFParse } from 'pdf-parse'
import { normalizeAnchorText, ANCHOR_MAX_CHARS } from '@/lib/preview-pagination'

export interface PdfPagination {
  pageCount: number
  /** anchors[i] = normalized first text of page i+2 (one per page break). */
  anchors: string[]
}

export async function extractPagination(buffer: Buffer): Promise<PdfPagination> {
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    const anchors = result.pages
      .slice(1)
      .map((page) => normalizeAnchorText(page.text).slice(0, ANCHOR_MAX_CHARS))
    return { pageCount: result.total, anchors }
  } finally {
    await parser.destroy()
  }
}
