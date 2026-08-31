import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('../models', () => ({
  getAnthropic: vi.fn(() => ({ messages: { create: mockCreate } })),
  DEFAULT_MODEL: 'claude-haiku-4-5-20251001',
}))

import { runSemanticKeywordAnalysis } from '../keyword-analysis-pipeline'

function mockClaudeResponse(json: unknown) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(json) }],
  })
}

beforeEach(() => {
  mockCreate.mockReset()
})

describe('runSemanticKeywordAnalysis', () => {
  it('returns empty array and does not call Claude when missingKeywords is empty', async () => {
    const result = await runSemanticKeywordAnalysis('Some resume text', [])
    expect(result).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns empty array and does not call Claude when resume text is blank', async () => {
    const result = await runSemanticKeywordAnalysis('   ', ['kubernetes'])
    expect(result).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns keywords confirmed by Claude', async () => {
    mockClaudeResponse(['kubernetes', 'leadership'])
    const result = await runSemanticKeywordAnalysis(
      'Ran production workloads on k8s. Led a team of 5 engineers.',
      ['kubernetes', 'leadership', 'graphql']
    )
    expect(result).toEqual(['kubernetes', 'leadership'])
  })

  it('filters out hallucinated keywords not present in the original list', async () => {
    mockClaudeResponse(['kubernetes', 'docker'])
    const result = await runSemanticKeywordAnalysis(
      'Ran production workloads on k8s.',
      ['kubernetes']
    )
    expect(result).toEqual(['kubernetes'])
  })

  it('matches confirmed keywords case-insensitively against the input list', async () => {
    mockClaudeResponse(['Kubernetes'])
    const result = await runSemanticKeywordAnalysis(
      'Ran production workloads on k8s.',
      ['kubernetes']
    )
    expect(result).toEqual(['kubernetes'])
  })

  it('returns empty array when Claude returns invalid JSON', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'not json' }] })
    const result = await runSemanticKeywordAnalysis('resume text', ['kubernetes'])
    expect(result).toEqual([])
  })

  it('parses a markdown-fenced JSON array instead of silently returning empty', async () => {
    // Claude frequently wraps array output in a ```json ... ``` fence despite
    // being told to return only the array — the exact same failure mode
    // already found and fixed in jd-extraction-pipeline.ts and
    // ats-fix-pipeline.ts, but never applied here.
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '```json\n["kubernetes", "leadership"]\n```' }],
    })
    const result = await runSemanticKeywordAnalysis(
      'Ran production workloads on k8s. Led a team of 5 engineers.',
      ['kubernetes', 'leadership']
    )
    expect(result).toEqual(['kubernetes', 'leadership'])
  })

  it('parses a JSON array followed by trailing prose', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '["kubernetes"]\n\nThese are the confirmed matches.' }],
    })
    const result = await runSemanticKeywordAnalysis('Ran production workloads on k8s.', ['kubernetes'])
    expect(result).toEqual(['kubernetes'])
  })

  it('returns empty array when Claude returns a non-array', async () => {
    mockClaudeResponse({ matched: ['kubernetes'] })
    const result = await runSemanticKeywordAnalysis('resume text', ['kubernetes'])
    expect(result).toEqual([])
  })

  it('caps the keywords sent to Claude at 30', async () => {
    mockClaudeResponse([])
    const manyKeywords = Array.from({ length: 40 }, (_, i) => `keyword${i}`)
    await runSemanticKeywordAnalysis('resume text', manyKeywords)

    const call = mockCreate.mock.calls[0]?.[0]
    const prompt: string = call?.messages[0]?.content ?? ''
    expect(prompt).toContain('keyword29')
    expect(prompt).not.toContain('keyword30')
  })

  it('truncates resume text at 10,000 characters', async () => {
    mockClaudeResponse([])
    const longText = 'a'.repeat(15_000)
    await runSemanticKeywordAnalysis(longText, ['kubernetes'])

    const call = mockCreate.mock.calls[0]?.[0]
    const prompt: string = call?.messages[0]?.content ?? ''
    expect(prompt).toContain('a'.repeat(10_000))
    expect(prompt).not.toContain('a'.repeat(10_001))
  })

  it('uses the Haiku 4.5 model with a small token budget', async () => {
    mockClaudeResponse([])
    await runSemanticKeywordAnalysis('resume text', ['kubernetes'])

    const call = mockCreate.mock.calls[0]?.[0]
    expect(call?.model).toBe('claude-haiku-4-5-20251001')
    expect(call?.max_tokens).toBe(500)
  })
})
