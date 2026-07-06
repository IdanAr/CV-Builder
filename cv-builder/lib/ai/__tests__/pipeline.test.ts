// lib/ai/__tests__/pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAnthropicCreate = vi.fn()

vi.mock('../models', () => ({
  getAnthropic: () => ({
    messages: { create: mockAnthropicCreate },
  }),
}))

describe('runSuggestionPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns generated text when critique is APPROVED (no refinement call)', async () => {
    mockAnthropicCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Built React dashboard for 500 users' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'APPROVED' }] })

    const { runSuggestionPipeline } = await import('../pipeline')
    const result = await runSuggestionPipeline('react dashboard 500 users', { field: 'highlight' })

    expect(result.suggestion).toBe('Built React dashboard for 500 users')
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(2)
  })

  it('calls refinement (third Anthropic call) when critique finds issues', async () => {
    mockAnthropicCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Built React dashboard for 500 users, boosting retention by 40%' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: '40% is not in original notes' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Built React dashboard for 500 users' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'APPROVED' }] })

    const { runSuggestionPipeline } = await import('../pipeline')
    const result = await runSuggestionPipeline('react dashboard 500 users', { field: 'highlight' })

    expect(mockAnthropicCreate).toHaveBeenCalledTimes(4)
    expect(result.suggestion).toBe('Built React dashboard for 500 users')
  })

  it('re-critiques after refinement and refines again if still not approved, bounded at 2 rounds', async () => {
    mockAnthropicCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Built React dashboard for 500 users, boosting retention by 40%' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: '40% is not in original notes' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Built React dashboard, boosting retention' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Missing user count from original notes' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Built React dashboard for 500 users' }] })

    const { runSuggestionPipeline } = await import('../pipeline')
    const result = await runSuggestionPipeline('react dashboard 500 users', { field: 'highlight' })

    expect(mockAnthropicCreate).toHaveBeenCalledTimes(5)
    expect(result.suggestion).toBe('Built React dashboard for 500 users')
  })

  it('returns pendingApprovals for metrics not in original input', async () => {
    mockAnthropicCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Increased revenue by 40%' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'APPROVED' }] })

    const { runSuggestionPipeline } = await import('../pipeline')
    const result = await runSuggestionPipeline('increased revenue', { field: 'highlight' })

    expect(result.pendingApprovals).toContain('40%')
  })

  it('returns empty pendingApprovals when all metrics were in original input', async () => {
    mockAnthropicCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Increased revenue by 40%' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'APPROVED' }] })

    const { runSuggestionPipeline } = await import('../pipeline')
    const result = await runSuggestionPipeline('increased revenue 40%', { field: 'highlight' })

    expect(result.pendingApprovals).toHaveLength(0)
  })

  it('works for summary field', async () => {
    mockAnthropicCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Senior engineer with 5 years of TypeScript experience.' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'APPROVED' }] })

    const { runSuggestionPipeline } = await import('../pipeline')
    const result = await runSuggestionPipeline('senior engineer 5 years typescript', { field: 'summary' })

    expect(typeof result.suggestion).toBe('string')
    expect(result.suggestion.length).toBeGreaterThan(0)
  })

  it('passes jobTitle and company in the generation prompt', async () => {
    mockAnthropicCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Led frontend at Acme Corp' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'APPROVED' }] })

    const { runSuggestionPipeline } = await import('../pipeline')
    await runSuggestionPipeline('led frontend', { field: 'highlight', jobTitle: 'Engineer', company: 'Acme Corp' })

    const firstCallMessages = mockAnthropicCreate.mock.calls[0][0].messages[0].content as string
    expect(firstCallMessages).toContain('Acme Corp')
    expect(firstCallMessages).toContain('Engineer')
  })
})
