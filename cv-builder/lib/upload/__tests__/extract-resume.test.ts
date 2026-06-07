import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@/lib/ai/models', () => ({
  getAnthropic: () => ({ messages: { create: mockCreate } }),
}))

const { extractResume, ExtractionError } = await import('../extract-resume')

function mockResponse(text: string) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text }],
  })
}

describe('extractResume', () => {
  beforeEach(() => mockCreate.mockClear())

  it('returns ResumeData when Claude returns valid JSON', async () => {
    mockResponse(JSON.stringify({
      basics: { name: 'Jane Smith', email: 'jane@example.com' },
      work: [{ name: 'Acme Corp', position: 'Engineer', startDate: '2020-01' }],
    }))
    const result = await extractResume('CV text here with enough content')
    expect(result.basics?.name).toBe('Jane Smith')
    expect(result.work?.[0]?.name).toBe('Acme Corp')
  })

  it('throws ExtractionError when Claude returns invalid JSON', async () => {
    mockResponse('not valid json {{{')
    await expect(extractResume('CV text')).rejects.toThrow(ExtractionError)
  })

  it('handles partial extraction (only basics present)', async () => {
    mockResponse(JSON.stringify({ basics: { name: 'John Doe' } }))
    const result = await extractResume('CV text')
    expect(result.basics?.name).toBe('John Doe')
    expect(result.work).toBeUndefined()
    expect(result.skills).toBeUndefined()
  })

  it('returns empty object when Claude returns empty JSON object', async () => {
    mockResponse('{}')
    const result = await extractResume('CV text')
    expect(result).toEqual({})
  })

  it('truncates text longer than 50 000 characters before sending to Claude', async () => {
    mockResponse('{}')
    const longText = 'a'.repeat(60_000)
    await extractResume(longText)
    const sentContent: string = mockCreate.mock.calls[0][0].messages[0].content
    expect(sentContent.length).toBeLessThanOrEqual(50_020)
  })

  it('throws ExtractionError when Claude returns a non-text content block', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'tool_use', id: 'x' }] })
    await expect(extractResume('CV text')).rejects.toThrow(ExtractionError)
  })
})
