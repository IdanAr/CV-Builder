import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('../models', () => ({
  getAnthropic: vi.fn(() => ({ messages: { create: mockCreate } })),
}))

import { runAtsFixPipeline } from '../ats-fix-pipeline'
import type { ResumeData } from '@/lib/schemas/resume.zod'

const sampleData: ResumeData = {
  basics: {
    name: 'Jane Smith',
    summary: 'Experienced developer building web applications.',
  },
  work: [{
    name: 'Acme Corp',
    position: 'Frontend Engineer',
    highlights: [
      'Built a dashboard used by 200 users',
      'Improved page load speed by 30%',
    ],
  }],
}

function mockClaudeResponse(json: unknown) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(json) }],
  })
}

beforeEach(() => {
  mockCreate.mockReset()
})

describe('runAtsFixPipeline', () => {
  it('returns empty array for empty keywords', async () => {
    const fixes = await runAtsFixPipeline(sampleData, [])
    expect(fixes).toEqual([])
  })

  it('returns empty array when resume has no editable sections', async () => {
    const fixes = await runAtsFixPipeline({}, ['react'])
    expect(fixes).toEqual([])
  })

  it('returns fixes parsed from Claude response', async () => {
    mockClaudeResponse([
      {
        sectionIndex: 0,
        original: 'Experienced developer building web applications.',
        suggested: 'Experienced React developer building scalable web applications.',
        targetKeywords: ['react'],
      },
    ])

    const fixes = await runAtsFixPipeline(sampleData, ['react'])
    expect(fixes).toHaveLength(1)
    expect(fixes[0].section).toBe('summary')
    expect(fixes[0].targetKeywords).toContain('react')
    expect(fixes[0].id).toBe('fix-0')
  })

  it('maps work section fixes with correct indices', async () => {
    mockClaudeResponse([
      {
        sectionIndex: 1,
        original: 'Built a dashboard used by 200 users',
        suggested: 'Built a TypeScript dashboard used by 200 users',
        targetKeywords: ['typescript'],
      },
    ])

    const fixes = await runAtsFixPipeline(sampleData, ['typescript'])
    expect(fixes).toHaveLength(1)
    expect(fixes[0].section).toBe('work')
    expect(fixes[0].workIndex).toBe(0)
    expect(fixes[0].highlightIndex).toBe(0)
  })

  it('skips fixes where suggested equals original', async () => {
    mockClaudeResponse([
      {
        sectionIndex: 0,
        original: 'Experienced developer building web applications.',
        suggested: 'Experienced developer building web applications.',
        targetKeywords: ['react'],
      },
    ])

    const fixes = await runAtsFixPipeline(sampleData, ['react'])
    expect(fixes).toHaveLength(0)
  })

  it('skips fixes with invalid sectionIndex', async () => {
    mockClaudeResponse([
      {
        sectionIndex: 99,
        original: 'something',
        suggested: 'something else',
        targetKeywords: ['react'],
      },
    ])

    const fixes = await runAtsFixPipeline(sampleData, ['react'])
    expect(fixes).toHaveLength(0)
  })

  it('returns empty array when Claude returns invalid JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json at all' }],
    })

    const fixes = await runAtsFixPipeline(sampleData, ['react'])
    expect(fixes).toEqual([])
  })

  it('limits input to 20 keywords', async () => {
    mockClaudeResponse([])
    const manyKeywords = Array.from({ length: 30 }, (_, i) => `keyword${i}`)
    await runAtsFixPipeline(sampleData, manyKeywords)

    const call = mockCreate.mock.calls[0]?.[0]
    const prompt: string = call?.messages[0]?.content ?? ''
    expect(prompt).not.toContain('keyword20')
  })
})
