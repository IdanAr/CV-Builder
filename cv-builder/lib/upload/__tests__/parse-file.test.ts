import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMammothExtract = vi.fn()

// Mock the PDFParse class
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

vi.mock('mammoth', () => ({
  extractRawText: mockMammothExtract
}))

// Import after mocks are set up
const { parseFile, ParseError } = await import('../parse-file')

const PDF_MIME = 'application/pdf'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

describe('parseFile', () => {
  beforeEach(() => {
    mockGetText.mockClear()
    mockMammothExtract.mockClear()
  })

  it('extracts text from a PDF buffer', async () => {
    mockGetText.mockResolvedValueOnce({ text: 'Jane Smith\nSenior Engineer\nAcme Corp 2020–2024\nExperienced professional with strong technical background.' })
    const result = await parseFile(Buffer.from('fake-pdf'), PDF_MIME)
    expect(result).toBe('Jane Smith\nSenior Engineer\nAcme Corp 2020–2024\nExperienced professional with strong technical background.')
    expect(mockGetText).toHaveBeenCalled()
  })

  it('extracts text from a DOCX buffer', async () => {
    mockMammothExtract.mockResolvedValueOnce({ value: 'Jane Smith\nSenior Engineer\nAcme Corp 2020–2024\nExperienced professional.' })
    const result = await parseFile(Buffer.from('fake-docx'), DOCX_MIME)
    expect(result).toBe('Jane Smith\nSenior Engineer\nAcme Corp 2020–2024\nExperienced professional.')
    expect(mockMammothExtract).toHaveBeenCalledWith({ buffer: expect.any(Buffer) })
  })

  it('throws ParseError when extracted PDF text is empty', async () => {
    mockGetText.mockResolvedValueOnce({ text: '   ' })
    await expect(parseFile(Buffer.from('fake'), PDF_MIME)).rejects.toThrow(ParseError)
  })

  it('throws ParseError when extracted text is too short (likely scanned)', async () => {
    mockGetText.mockResolvedValueOnce({ text: 'abc' })
    await expect(parseFile(Buffer.from('fake'), PDF_MIME)).rejects.toThrow(ParseError)
  })

  it('throws ParseError for unsupported MIME type', async () => {
    await expect(parseFile(Buffer.from('x'), 'text/plain')).rejects.toThrow(ParseError)
  })

  it('throws ParseError when pdf-parse throws', async () => {
    mockGetText.mockRejectedValueOnce(new Error('Encrypted PDF'))
    await expect(parseFile(Buffer.from('fake'), PDF_MIME)).rejects.toThrow(ParseError)
  })
})
