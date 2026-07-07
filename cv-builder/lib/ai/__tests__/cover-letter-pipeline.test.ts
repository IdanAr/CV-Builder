import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('../models', () => ({
  getAnthropic: vi.fn(() => ({ messages: { create: mockCreate } })),
}))

import { generateCoverLetter } from '../cover-letter-pipeline'
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

function mockClaudeText(text: string) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text }],
  })
}

beforeEach(() => {
  mockCreate.mockReset()
})

describe('generateCoverLetter', () => {
  it('generates a letter using resume facts', async () => {
    mockClaudeText('Dear Hiring Manager,\n\nI am excited to apply. I built a dashboard used by 200 users and improved page load speed by 30%.\n\nSincerely,\nJane Smith')

    const result = await generateCoverLetter(sampleData, 'Looking for a frontend engineer.')

    expect(result.content).toContain('200 users')
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('returns empty pendingApprovals when the letter only restates resume facts', async () => {
    mockClaudeText('Dear Hiring Manager,\n\nI built a dashboard used by 200 users and improved page load speed by 30%.\n\nSincerely,\nJane Smith')

    const result = await generateCoverLetter(sampleData, 'Looking for a frontend engineer.')

    expect(result.pendingApprovals).toEqual([])
  })

  it('flags a metric or skill in the letter that is not in the resume data (real integration with detectHallucinations)', async () => {
    // The mocked AI response invents a metric (45%) and a skill (Kubernetes)
    // that do not appear anywhere in sampleData's facts. This exercises the
    // real detectHallucinations function end-to-end, not a mock of it.
    mockClaudeText('Dear Hiring Manager,\n\nI reduced deployment time by 45% using Kubernetes at Acme Corp.\n\nSincerely,\nJane Smith')

    const result = await generateCoverLetter(sampleData, 'Looking for a frontend engineer with cloud experience.')

    expect(result.pendingApprovals.length).toBeGreaterThan(0)
    expect(result.pendingApprovals).toEqual(expect.arrayContaining(['45%', 'kubernetes']))
  })

  it('includes company and role context in the generation prompt when provided', async () => {
    mockClaudeText('Dear Hiring Manager,\n\nI am excited about this role.\n\nSincerely,\nJane Smith')

    await generateCoverLetter(sampleData, 'Looking for a frontend engineer.', {
      companyName: 'Globex Corporation',
      roleName: 'Senior Frontend Engineer',
    })

    const firstCallMessages = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(firstCallMessages).toContain('Globex Corporation')
    expect(firstCallMessages).toContain('Senior Frontend Engineer')
  })

  it('omits context line when company/role are not provided', async () => {
    mockClaudeText('Dear Hiring Manager,\n\nI am excited about this role.\n\nSincerely,\nJane Smith')

    await generateCoverLetter(sampleData, 'Looking for a frontend engineer.')

    const firstCallMessages = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(firstCallMessages).not.toContain('Role:')
    expect(firstCallMessages).not.toContain('Company:')
  })

  it('uses the Haiku model', async () => {
    mockClaudeText('Dear Hiring Manager,\n\nI am excited about this role.\n\nSincerely,\nJane Smith')

    await generateCoverLetter(sampleData, 'Looking for a frontend engineer.')

    expect(mockCreate.mock.calls[0][0].model).toBe('claude-haiku-4-5-20251001')
  })
})
