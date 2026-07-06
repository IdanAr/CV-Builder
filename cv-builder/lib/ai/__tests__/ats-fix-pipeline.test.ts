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
  })

  it('assigns stable ids based on the target location, not array position', async () => {
    mockClaudeResponse([
      {
        sectionIndex: 1,
        original: 'Built a dashboard used by 200 users',
        suggested: 'Built a React dashboard used by 200 users',
        targetKeywords: ['react'],
      },
      {
        sectionIndex: 0,
        original: 'Experienced developer building web applications.',
        suggested: 'Experienced React developer building web applications.',
        targetKeywords: ['react'],
      },
    ])

    const fixes = await runAtsFixPipeline(sampleData, ['react'])
    expect(fixes.map((f) => f.id)).toEqual(['fix-work-0-0', 'fix-summary'])
  })

  it('rejects fixes whose original does not match the current resume text', async () => {
    mockClaudeResponse([
      {
        sectionIndex: 0,
        original: 'Some hallucinated text that is not in the resume.',
        suggested: 'Some hallucinated React text.',
        targetKeywords: ['react'],
      },
    ])

    const fixes = await runAtsFixPipeline(sampleData, ['react'])
    expect(fixes).toHaveLength(0)
  })

  it('flags numeric claims in suggested text that are absent from the original', async () => {
    mockClaudeResponse([
      {
        sectionIndex: 0,
        original: 'Experienced developer building web applications.',
        suggested: 'Experienced React developer who cut costs by 45% across 12 teams.',
        targetKeywords: ['react'],
      },
    ])

    const fixes = await runAtsFixPipeline(sampleData, ['react'])
    expect(fixes).toHaveLength(1)
    expect(fixes[0].pendingApprovals).toEqual(expect.arrayContaining(['45%', '12']))
  })

  it('flags a technology injected into suggested text that is absent from the original', async () => {
    mockClaudeResponse([
      {
        sectionIndex: 1,
        original: 'Built a dashboard used by 200 users',
        suggested: 'Built a React dashboard used by 200 users',
        targetKeywords: ['react'],
      },
    ])

    const fixes = await runAtsFixPipeline(sampleData, ['react'])
    expect(fixes).toHaveLength(1)
    expect(fixes[0].pendingApprovals).toEqual(['react'])
  })

  it('returns empty pendingApprovals when suggested adds no new claims', async () => {
    mockClaudeResponse([
      {
        sectionIndex: 1,
        original: 'Built a dashboard used by 200 users',
        suggested: 'Built a dashboard that was adopted by 200 users',
        targetKeywords: ['react'],
      },
    ])

    const fixes = await runAtsFixPipeline(sampleData, ['react'])
    expect(fixes).toHaveLength(1)
    expect(fixes[0].pendingApprovals).toEqual([])
  })

  it('drops malformed items that fail schema validation', async () => {
    mockClaudeResponse([
      {
        sectionIndex: 'zero',
        original: 'Experienced developer building web applications.',
        suggested: 'Experienced React developer.',
        targetKeywords: ['react'],
      },
      {
        sectionIndex: 1,
        original: 'Built a dashboard used by 200 users',
        suggested: 'Built a React dashboard used by 200 users',
        targetKeywords: 'react',
      },
    ])

    const fixes = await runAtsFixPipeline(sampleData, ['react'])
    // First item has a non-numeric sectionIndex; second has non-array keywords.
    // Only structurally valid items survive; the second is salvageable if the
    // schema coerces nothing — expect it dropped too.
    expect(fixes).toHaveLength(0)
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
