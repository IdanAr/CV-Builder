import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('../models', () => ({
  getAnthropic: vi.fn(() => ({ messages: { create: mockCreate } })),
}))

import { extractJdRequirements } from '../jd-extraction-pipeline'

function mockClaudeResponse(json: unknown) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(json) }],
  })
}

beforeEach(() => {
  mockCreate.mockReset()
})

describe('extractJdRequirements', () => {
  it('returns empty array and does not call Claude for a blank job description', async () => {
    const result = await extractJdRequirements('   ')
    expect(result).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns lowercased terms from a valid Claude response', async () => {
    mockClaudeResponse(['React', 'Google Cloud Platform', 'Mixpanel', 'Agile'])
    const result = await extractJdRequirements('We need a React developer with GCP and Mixpanel experience.')
    expect(result).toEqual(['react', 'google cloud platform', 'mixpanel', 'agile'])
  })

  it('trims whitespace and drops empty strings', async () => {
    mockClaudeResponse(['  react  ', '', '   ', 'agile'])
    const result = await extractJdRequirements('some jd')
    expect(result).toEqual(['react', 'agile'])
  })

  it('deduplicates case-insensitively, keeping the first occurrence', async () => {
    mockClaudeResponse(['React', 'react', 'REACT', 'Agile'])
    const result = await extractJdRequirements('some jd')
    expect(result).toEqual(['react', 'agile'])
  })

  it('returns empty array when Claude returns invalid JSON', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'not json' }] })
    const result = await extractJdRequirements('some jd')
    expect(result).toEqual([])
  })

  it('parses the array even when Claude wraps it in a markdown code fence', async () => {
    // Claude frequently wraps JSON output in ```json ... ``` fences despite
    // being told to return only the array — real production behavior that
    // every other test in this file (using JSON.stringify directly) never
    // exercises.
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '```json\n["Mixpanel", "Amplitude", "SQL"]\n```' }],
    })
    const result = await extractJdRequirements('some jd')
    expect(result).toEqual(['mixpanel', 'amplitude', 'sql'])
  })

  it('parses the array even with leading/trailing prose around it', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Here are the extracted terms:\n["React", "Agile"]\nLet me know if you need more.' }],
    })
    const result = await extractJdRequirements('some jd')
    expect(result).toEqual(['react', 'agile'])
  })

  it('returns empty array when Claude returns a non-array', async () => {
    mockClaudeResponse({ terms: ['react'] })
    const result = await extractJdRequirements('some jd')
    expect(result).toEqual([])
  })

  it('truncates the job description at 10,000 characters in the prompt', async () => {
    mockClaudeResponse([])
    const longText = 'a'.repeat(15_000)
    await extractJdRequirements(longText)

    const call = mockCreate.mock.calls[0]?.[0]
    const prompt: string = call?.messages[0]?.content ?? ''
    expect(prompt).toContain('a'.repeat(10_000))
    expect(prompt).not.toContain('a'.repeat(10_001))
  })

  it('caps the returned terms at 60 even if Claude returns more', async () => {
    const manyTerms = Array.from({ length: 80 }, (_, i) => `term${i}`)
    mockClaudeResponse(manyTerms)
    const result = await extractJdRequirements('some jd')
    expect(result).toHaveLength(60)
    expect(result[0]).toBe('term0')
    expect(result[59]).toBe('term59')
  })

  it('uses the Haiku 4.5 model with a small token budget', async () => {
    mockClaudeResponse([])
    await extractJdRequirements('some jd')

    const call = mockCreate.mock.calls[0]?.[0]
    expect(call?.model).toBe('claude-haiku-4-5-20251001')
    expect(call?.max_tokens).toBe(1000)
  })
})
