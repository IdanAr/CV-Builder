import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMammothExtract = vi.fn()
const mockExtractLayoutAwareText = vi.fn()

// Mock the PDFParse class — the fallback path used only when layout-aware
// extraction throws or comes back too short.
class MockPDFParse {
  data: Buffer

  constructor(options: { data: Buffer }) {
    this.data = options.data
  }

  async getText() {
    return vi.mocked(mockGetText).call(this)
  }
}

const mockGetText = vi.fn()

vi.mock('pdf-parse', () => ({
  PDFParse: MockPDFParse
}))

vi.mock('pdf-parse/worker', () => ({
  CanvasFactory: class {}
}))

vi.mock('../pdf-layout-text', () => ({
  extractLayoutAwareText: mockExtractLayoutAwareText,
}))

vi.mock('mammoth', () => ({
  extractRawText: mockMammothExtract
}))

// Import after mocks are set up
const { parseFile, ParseError } = await import('../parse-file')

const PDF_MIME = 'application/pdf'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const LONG_TEXT = 'Jane Smith\nSenior Engineer\nAcme Corp 2020–2024\nExperienced professional with strong technical background.'

describe('parseFile', () => {
  beforeEach(() => {
    mockGetText.mockClear()
    mockMammothExtract.mockClear()
    mockExtractLayoutAwareText.mockClear()
  })

  it('extracts text via layout-aware extraction and never falls back to pdf-parse when it succeeds', async () => {
    mockExtractLayoutAwareText.mockResolvedValueOnce(LONG_TEXT)
    const result = await parseFile(Buffer.from('fake-pdf'), PDF_MIME)
    expect(result).toBe(LONG_TEXT)
    expect(mockExtractLayoutAwareText).toHaveBeenCalled()
    expect(mockGetText).not.toHaveBeenCalled()
  })

  it('falls back to pdf-parse when layout-aware extraction throws', async () => {
    mockExtractLayoutAwareText.mockRejectedValueOnce(new Error('pdfjs blew up'))
    mockGetText.mockResolvedValueOnce({ text: LONG_TEXT })
    const result = await parseFile(Buffer.from('fake-pdf'), PDF_MIME)
    expect(result).toBe(LONG_TEXT)
    expect(mockGetText).toHaveBeenCalled()
  })

  it('falls back to pdf-parse when layout-aware extraction comes back too short', async () => {
    mockExtractLayoutAwareText.mockResolvedValueOnce('short')
    mockGetText.mockResolvedValueOnce({ text: LONG_TEXT })
    const result = await parseFile(Buffer.from('fake-pdf'), PDF_MIME)
    expect(result).toBe(LONG_TEXT)
    expect(mockGetText).toHaveBeenCalled()
  })

  it('extracts text from a DOCX buffer', async () => {
    mockMammothExtract.mockResolvedValueOnce({ value: 'Jane Smith\nSenior Engineer\nAcme Corp 2020–2024\nExperienced professional.' })
    const result = await parseFile(Buffer.from('fake-docx'), DOCX_MIME)
    expect(result).toBe('Jane Smith\nSenior Engineer\nAcme Corp 2020–2024\nExperienced professional.')
    expect(mockMammothExtract).toHaveBeenCalledWith({ buffer: expect.any(Buffer) })
  })

  it('throws ParseError when both layout-aware extraction and the pdf-parse fallback come back empty', async () => {
    mockExtractLayoutAwareText.mockResolvedValueOnce('')
    mockGetText.mockResolvedValueOnce({ text: '   ' })
    await expect(parseFile(Buffer.from('fake'), PDF_MIME)).rejects.toThrow(ParseError)
  })

  it('throws ParseError when both layout-aware extraction and the pdf-parse fallback come back too short (likely scanned)', async () => {
    mockExtractLayoutAwareText.mockResolvedValueOnce('')
    mockGetText.mockResolvedValueOnce({ text: 'abc' })
    await expect(parseFile(Buffer.from('fake'), PDF_MIME)).rejects.toThrow(ParseError)
  })

  it('throws ParseError for unsupported MIME type', async () => {
    await expect(parseFile(Buffer.from('x'), 'text/plain')).rejects.toThrow(ParseError)
  })

  it('throws ParseError when both layout-aware extraction and the pdf-parse fallback throw', async () => {
    mockExtractLayoutAwareText.mockRejectedValueOnce(new Error('pdfjs blew up'))
    mockGetText.mockRejectedValueOnce(new Error('Encrypted PDF'))
    await expect(parseFile(Buffer.from('fake'), PDF_MIME)).rejects.toThrow(ParseError)
  })
})
