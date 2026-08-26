// lib/jobsearch/__tests__/apply.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRunAtsFixPipeline, mockGenerateCoverLetter, mockScoreResume, mockCreateResume } = vi.hoisted(() => ({
  mockRunAtsFixPipeline: vi.fn(),
  mockGenerateCoverLetter: vi.fn(),
  mockScoreResume: vi.fn(),
  mockCreateResume: vi.fn(),
}))

vi.mock('@/lib/ai/ats-fix-pipeline', () => ({ runAtsFixPipeline: mockRunAtsFixPipeline }))
vi.mock('@/lib/ai/cover-letter-pipeline', () => ({ generateCoverLetter: mockGenerateCoverLetter }))
vi.mock('@/lib/ats/scorer', () => ({ scoreResume: mockScoreResume }))
vi.mock('@/lib/api/resumes', () => ({ createResume: mockCreateResume }))

import { runApplyPipeline, PER_PROFILE_DAILY_DRAFT_CAP, PER_USER_DAILY_DRAFT_CAP } from '../apply'

const baseResumeData = { basics: { name: 'Jane Doe', summary: 'Engineer.' } }
const posting = { title: 'Backend Engineer', company: 'Acme', description: 'Build things with Node.' }

beforeEach(() => {
  vi.clearAllMocks()
  mockRunAtsFixPipeline.mockResolvedValue([])
  mockGenerateCoverLetter.mockResolvedValue({ content: 'Dear Acme, ...', pendingApprovals: [] })
  mockScoreResume.mockReturnValue({ total: 90, missingKeywords: [] })
  mockCreateResume.mockResolvedValue({ _id: 'r1' })
})

describe('runApplyPipeline', () => {
  it('exposes the documented daily caps', () => {
    expect(PER_PROFILE_DAILY_DRAFT_CAP).toBe(3)
    expect(PER_USER_DAILY_DRAFT_CAP).toBe(10)
  })

  it('returns status "queued" when there are no pending approvals and the score clears the threshold', async () => {
    const result = await runApplyPipeline('u1', baseResumeData as never, posting, [], 75, 'source-r1')
    expect(result.status).toBe('queued')
    expect(result.draftResumeId).toBe('r1')
    expect(result.postTailorScore).toBe(90)
  })

  it('returns status "needs_review" when the post-tailor score is below minAtsScore', async () => {
    mockScoreResume.mockReturnValue({ total: 60, missingKeywords: [] })
    const result = await runApplyPipeline('u1', baseResumeData as never, posting, [], 75, 'source-r1')
    expect(result.status).toBe('needs_review')
  })

  it('returns status "needs_review" when a fix or the cover letter has pending approvals, even with a high score', async () => {
    mockRunAtsFixPipeline.mockResolvedValue([
      { id: 'fix-summary', section: 'summary', original: '', suggested: 'Grew revenue 40%.', targetKeywords: ['revenue'], pendingApprovals: ['40%'] },
    ])
    mockScoreResume.mockReturnValue({ total: 95, missingKeywords: [] })
    const result = await runApplyPipeline('u1', baseResumeData as never, posting, [], 75, 'source-r1')
    expect(result.status).toBe('needs_review')
    expect(result.pendingApprovals).toEqual(['40%'])
  })

  it('applies every returned fix into the tailored resume data before scoring and persisting', async () => {
    mockRunAtsFixPipeline.mockResolvedValue([
      { id: 'fix-summary', section: 'summary', original: 'Engineer.', suggested: 'Backend engineer with Node experience.', targetKeywords: ['Node'], pendingApprovals: [] },
    ])

    await runApplyPipeline('u1', baseResumeData as never, posting, ['Node'], 75, 'source-r1')

    expect(mockRunAtsFixPipeline).toHaveBeenCalledWith(baseResumeData, ['Node'])
    expect(mockScoreResume).toHaveBeenCalledWith(
      expect.objectContaining({ basics: expect.objectContaining({ summary: 'Backend engineer with Node experience.' }) }),
      posting.description
    )
    expect(mockCreateResume).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        data: expect.objectContaining({
          basics: expect.objectContaining({ summary: 'Backend engineer with Node experience.' }),
          coverLetter: 'Dear Acme, ...',
        }),
        applicationStatus: 'draft',
        targetCompany: 'Acme',
        targetRole: 'Backend Engineer',
      }),
      expect.anything()
    )
  })

  it('passes sourceResumeId through as parentResumeId so the draft records lineage', async () => {
    await runApplyPipeline('u1', baseResumeData as never, posting, [], 75, 'source-r1')

    expect(mockCreateResume).toHaveBeenCalledWith('u1', expect.anything(), { parentResumeId: 'source-r1' })
  })

  it('deduplicates tailoredKeywords across multiple fixes', async () => {
    mockRunAtsFixPipeline.mockResolvedValue([
      { id: 'f1', section: 'summary', original: '', suggested: 'a', targetKeywords: ['Node', 'API'], pendingApprovals: [] },
      { id: 'f2', section: 'work', workIndex: 0, highlightIndex: 0, original: 'x', suggested: 'b', targetKeywords: ['Node'], pendingApprovals: [] },
    ])
    const result = await runApplyPipeline(
      'u1',
      { ...baseResumeData, work: [{ name: 'Co', highlights: ['x'] }] } as never,
      posting,
      [],
      75,
      'source-r1'
    )
    expect(result.tailoredKeywords.sort()).toEqual(['API', 'Node'])
  })

  it('truncates an oversized title/company/role before persisting the draft resume', async () => {
    const longTitle = 'T'.repeat(250)
    const longCompany = 'C'.repeat(250)
    await runApplyPipeline(
      'u1',
      baseResumeData as never,
      { ...posting, title: longTitle, company: longCompany },
      [],
      75,
      'source-r1'
    )

    const call = mockCreateResume.mock.calls[0][1]
    expect(call.title.length).toBeLessThanOrEqual(200)
    expect(call.targetCompany.length).toBeLessThanOrEqual(200)
    expect(call.targetRole.length).toBeLessThanOrEqual(200)
  })
})
