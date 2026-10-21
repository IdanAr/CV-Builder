// lib/ai/cover-letter/__tests__/job.test.ts
// The job runs against a real in-memory MongoDB: the claim, the "still
// writing" guards on every later write and the CastError handling are
// database behaviour a mocked model would only echo back. The writer is mocked.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { connectMemoryMongo, disconnectMemoryMongo, clearMemoryMongo } from '@/test/mongo-memory'
import { FIXTURE_CV } from './fixture-cv'

const { mockWrite } = vi.hoisted(() => ({ mockWrite: vi.fn() }))
vi.mock('../write-with-critique', () => ({ writeCoverLetterWithCritique: mockWrite }))

let runCoverLetterJob: typeof import('../job')['runCoverLetterJob']
let CoverLetter: typeof import('@/models/CoverLetter')['default']
let Resume: typeof import('@/models/Resume')['default']

beforeAll(async () => {
  await connectMemoryMongo()
  ;({ runCoverLetterJob } = await import('../job'))
  CoverLetter = (await import('@/models/CoverLetter')).default
  Resume = (await import('@/models/Resume')).default
}, 60000)

afterAll(async () => {
  await disconnectMemoryMongo()
})

beforeEach(async () => {
  await clearMemoryMongo()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const RUN = {
  content: 'Dear Hiring Team,\n\nA letter body.\n\nBest regards,\nDana Levi',
  pendingApprovals: ['Cut report time by 40%: not in the CV'],
  notices: ['A notice.'],
  language: 'en' as const,
}

async function seed(extra: Record<string, unknown> = {}) {
  const resume = await Resume.create({ userId: 'u1', title: 'My CV', data: FIXTURE_CV })
  const letter = await CoverLetter.create({
    userId: 'u1',
    resumeId: String(resume._id),
    company: 'Northwind',
    role: 'Platform Engineer',
    jobText: 'We build tools for small shops.',
    notes: { motivation: 'I like small tools.', hiringManager: 'Sam Cohen' },
    ...extra,
  })
  return { resume, letterId: String(letter._id) }
}

describe('runCoverLetterJob', () => {
  it('writes the letter, stores the run and returns written', async () => {
    const { letterId } = await seed({ scrapedJobId: 'job-1' })
    mockWrite.mockResolvedValue(RUN)

    expect(await runCoverLetterJob('u1', letterId)).toBe('written')

    const stored = await CoverLetter.findById(letterId).lean()
    expect(stored).toMatchObject({
      status: 'ready',
      content: RUN.content,
      pendingApprovals: RUN.pendingApprovals,
      notices: RUN.notices,
      language: 'en',
      scrapedJobId: 'job-1',
    })
    expect(stored?.startedAt).toBeInstanceOf(Date)
    expect(stored?.error).toBeUndefined()

    const [data, input, opts] = mockWrite.mock.calls[0]
    expect(data.basics.name).toBe('Dana Levi')
    expect(input).toEqual({ company: 'Northwind', role: 'Platform Engineer', jobText: 'We build tools for small shops.' })
    expect(opts.deadlineMs).toBe(55_000)
    expect(opts.notes).toMatchObject({ motivation: 'I like small tools.', hiringManager: 'Sam Cohen' })
  })

  it('does not run a second time on the same letter', async () => {
    const { letterId } = await seed()
    mockWrite.mockResolvedValue(RUN)

    expect(await runCoverLetterJob('u1', letterId)).toBe('written')
    expect(await runCoverLetterJob('u1', letterId)).toBe('already-started')
    expect(mockWrite).toHaveBeenCalledTimes(1)
  })

  it('lets only one of two concurrent deliveries write', async () => {
    const { letterId } = await seed()
    mockWrite.mockResolvedValue(RUN)

    const outcomes = await Promise.all([runCoverLetterJob('u1', letterId), runCoverLetterJob('u1', letterId)])
    expect(outcomes.sort()).toEqual(['already-started', 'written'])
    expect(mockWrite).toHaveBeenCalledTimes(1)
  })

  it('returns gone for a missing letter, another user, or a malformed id, without throwing', async () => {
    const { letterId } = await seed()

    expect(await runCoverLetterJob('u1', '64b64b64b64b64b64b64b64b')).toBe('gone')
    expect(await runCoverLetterJob('u1', 'not-an-object-id')).toBe('gone')
    expect(await runCoverLetterJob('u2', letterId)).toBe('gone')
    expect(mockWrite).not.toHaveBeenCalled()
    // The other user's call did not claim the letter.
    expect((await CoverLetter.findById(letterId).lean())?.startedAt).toBeUndefined()
  })

  it('returns gone when the CV was deleted, without throwing or calling the writer', async () => {
    const { resume, letterId } = await seed()
    await Resume.deleteOne({ _id: resume._id })

    expect(await runCoverLetterJob('u1', letterId)).toBe('gone')
    expect(mockWrite).not.toHaveBeenCalled()
  })

  it("returns gone when the CV belongs to someone else's account", async () => {
    const other = await Resume.create({ userId: 'u2', title: 'Theirs', data: FIXTURE_CV })
    const { letterId } = await seed({ resumeId: String(other._id) })

    expect(await runCoverLetterJob('u1', letterId)).toBe('gone')
    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('stores a failed letter with the user message when the writer throws, and logs without the letter text', async () => {
    const { letterId } = await seed()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockWrite.mockRejectedValue(new Error('upstream exploded'))

    expect(await runCoverLetterJob('u1', letterId)).toBe('failed')

    const stored = await CoverLetter.findById(letterId).lean()
    expect(stored?.status).toBe('failed')
    expect(stored?.error).toBe('Could not write this letter. Please try again.')
    expect(stored?.content).toBe('')
    expect(log).toHaveBeenCalledTimes(1)
    const logged = JSON.stringify(log.mock.calls[0])
    expect(logged).toContain('upstream exploded')
    expect(logged).not.toContain('small shops')
  })

  it('writes the progress steps in order', async () => {
    const { letterId } = await seed()
    const spy = vi.spyOn(CoverLetter, 'updateOne')
    mockWrite.mockImplementation(async (_d: unknown, _i: unknown, opts: { onProgress?: (s: string) => void }) => {
      for (const step of ['reading', 'planning', 'writing', 'critiquing', 'checking', 'done']) opts.onProgress?.(step)
      return RUN
    })

    await runCoverLetterJob('u1', letterId)

    const steps = spy.mock.calls
      .map((c) => (c[1] as { $set?: { progress?: string } }).$set?.progress)
      .filter(Boolean)
    expect(steps).toEqual(['reading', 'planning', 'writing', 'critiquing', 'checking', 'done'])
  })

  it('survives a failing progress write', async () => {
    const { letterId } = await seed()
    vi.spyOn(CoverLetter, 'updateOne').mockImplementationOnce((() => Promise.reject(new Error('db blip'))) as never)
    mockWrite.mockImplementation(async (_d: unknown, _i: unknown, opts: { onProgress?: (s: string) => void }) => {
      opts.onProgress?.('reading')
      return RUN
    })

    expect(await runCoverLetterJob('u1', letterId)).toBe('written')
  })

  it('does not bring back a letter the stale rule already failed', async () => {
    const { letterId } = await seed()
    mockWrite.mockImplementation(async () => {
      await CoverLetter.updateOne({ _id: letterId }, { $set: { status: 'failed', error: 'Writing this letter took too long. Please try again.' } })
      return RUN
    })

    expect(await runCoverLetterJob('u1', letterId)).toBe('gone')

    const stored = await CoverLetter.findById(letterId).lean()
    expect(stored?.status).toBe('failed')
    expect(stored?.content).toBe('')
  })

  it('leaves a letter deleted mid-write deleted', async () => {
    const { letterId } = await seed()
    mockWrite.mockImplementation(async () => {
      await CoverLetter.deleteOne({ _id: letterId })
      return RUN
    })

    expect(await runCoverLetterJob('u1', letterId)).toBe('gone')
    expect(await CoverLetter.countDocuments()).toBe(0)
  })
})
