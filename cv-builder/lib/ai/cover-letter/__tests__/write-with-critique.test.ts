import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockParse = vi.fn()

vi.mock('@/lib/ai/models', () => ({
  getAnthropic: vi.fn(() => ({ messages: { parse: mockParse } })),
  DEFAULT_MODEL: 'claude-haiku-4-5-20251001',
  COVER_LETTER_MODEL: 'claude-haiku-5-5',
  COVER_LETTER_THINKING: { effort: 'low' },
}))

import type { LetterSentence } from '../letter'
import type { LetterPlan, WrittenLetter } from '../schema'
import { NOT_REVIEWED_APPROVAL, NOT_REVIEWED_NOTICE, writeCoverLetterWithCritique } from '../write-with-critique'
import { FIXTURE_CV } from './fixture-cv'

const POSTING = { company: 'Globex', role: 'Data Analyst', jobText: 'Globex needs an analyst who can speed up reporting. You will own the roadmap.' }
const HEBREW_POSTING = { ...POSTING, jobText: 'אנחנו מחפשים אנליסט נתונים שיעזור לנו להאיץ את הדיווח ולהוביל את מפת הדרכים של הצוות.' }

// About 270 words with no numbers, names or stock phrases, so only what a test adds can fail the verifier.
const FILLER: LetterSentence = {
  text: Array.from({ length: 30 }, () => 'Clear reporting helps people decide quickly and calmly.').join(' '),
  facts: [],
  quotes: [],
  bullet: false,
}

const PLAN: LetterPlan = {
  needs: [{ need: 'faster reporting', postingQuote: 'speed up reporting', evidence: 'strong', facts: ['F4'] }],
  situation: null,
  openingAngle: 'reporting speed',
  whyCompany: { source: 'posting', text: 'own the roadmap' },
  sparse: false,
}

function written(sentences: LetterSentence[]): WrittenLetter {
  return { plan: PLAN, letter: { greeting: 'Hello there,', paragraphs: [sentences, [FILLER]], signOff: 'Best regards,\nDana Levi' } }
}

const clean = written([{ text: 'At Acme I cut report time by 40%, which is the speed Globex asks for.', facts: ['F4'], quotes: ['speed up reporting'], bullet: false }])
const uncited = written([{ text: 'At Acme I cut report time by 45%.', facts: ['F4'], quotes: [], bullet: false }])

const reply = (parsed: unknown) => ({ parsed_output: parsed, stop_reason: 'end_turn', content: [], usage: { input_tokens: 1, output_tokens: 1 } })
const planReply = reply(PLAN)
const letterReply = (w: WrittenLetter) => reply(w.letter)
const critiqueReply = (problems: { sentence: string; problem: string }[] = []) => reply({ problems })

const run = (over: Parameters<typeof writeCoverLetterWithCritique>[2] = {}, posting = POSTING) =>
  writeCoverLetterWithCritique(FIXTURE_CV, posting, { today: '2026-10', ...over })

beforeEach(() => mockParse.mockReset())

describe('writeCoverLetterWithCritique', () => {
  it('plans, writes and critiques in three calls and returns a clean letter unrefined', async () => {
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(clean)).mockResolvedValueOnce(critiqueReply())
    const result = await run()
    expect(mockParse).toHaveBeenCalledTimes(3)
    expect(result.calls).toBe(3)
    expect(result.refined).toBe(false)
    expect(result.pendingApprovals).toEqual([])
  })

  it('forces the plan situation to null when there is no gap and no explanation', async () => {
    // FIXTURE_CV has no employment gap; the model still names a "career change".
    const model: LetterPlan = { ...PLAN, situation: 'career change' }
    mockParse.mockResolvedValueOnce(reply(model)).mockResolvedValueOnce(letterReply(clean)).mockResolvedValueOnce(critiqueReply())
    const result = await run()
    expect(result.plan.situation).toBeNull()
    expect(JSON.stringify(mockParse.mock.calls[1][0].messages)).not.toContain('"situation":"career change"')
  })

  it('keeps a situation the candidate asked to explain', async () => {
    const model: LetterPlan = { ...PLAN, situation: 'a move from nursing' }
    mockParse.mockResolvedValueOnce(reply(model)).mockResolvedValueOnce(letterReply(clean)).mockResolvedValueOnce(critiqueReply())
    const result = await run({ notes: { explain: 'I moved from nursing to analytics' } })
    expect(result.plan.situation).toBe('a move from nursing')
  })

  it('uses the cover letter model with its thinking tuning by default', async () => {
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(clean)).mockResolvedValueOnce(critiqueReply())
    await run()
    const first = mockParse.mock.calls[0][0]
    expect(first.model).toBe('claude-haiku-5-5')
    expect(first.thinking).toEqual({ type: 'adaptive' })
    expect(first.output_config.effort).toBe('low')
  })

  it('refines once when the critique finds a problem, naming the sentence', async () => {
    mockParse
      .mockResolvedValueOnce(planReply)
      .mockResolvedValueOnce(letterReply(clean))
      .mockResolvedValueOnce(critiqueReply([{ sentence: 'A sentence only the critique quotes.', problem: 'Reads like a stock opening.' }]))
      .mockResolvedValueOnce(reply(clean))
    const result = await run()
    expect(mockParse).toHaveBeenCalledTimes(4)
    const refinePrompt = JSON.stringify(mockParse.mock.calls[3][0].messages)
    expect(refinePrompt).toContain('A sentence only the critique quotes.')
    expect(refinePrompt).toContain('Reads like a stock opening.')
    expect(result.refined).toBe(true)
    expect(result.calls).toBe(4)
  })

  it('skips the refine with 19 seconds left after the critique, and leaves verifier issues for approval', async () => {
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(uncited)).mockResolvedValueOnce(critiqueReply())
    let t = 0
    const result = await run({
      now: () => t,
      onProgress: (step) => {
        if (step === 'checking') t = 41_000
      },
    })
    expect(mockParse).toHaveBeenCalledTimes(3)
    expect(result.refined).toBe(false)
    expect(result.pendingApprovals).toHaveLength(1)
    expect(result.pendingApprovals[0]).toContain('45%')
  })

  it('holds the critique problems for approval when the refine is skipped for time', async () => {
    mockParse
      .mockResolvedValueOnce(planReply)
      .mockResolvedValueOnce(letterReply(clean))
      .mockResolvedValueOnce(critiqueReply([{ sentence: 'A sentence only the critique quotes.', problem: 'Reads like a stock opening.' }]))
    let t = 0
    const result = await run({
      now: () => t,
      onProgress: (step) => {
        if (step === 'checking') t = 41_000
      },
    })
    expect(mockParse).toHaveBeenCalledTimes(3)
    expect(result.refined).toBe(false)
    expect(result.reviewed).toBe(true)
    expect(result.pendingApprovals).toEqual(['A sentence only the critique quotes.: Reads like a stock opening.'])
  })

  it('still refines with exactly 20 seconds left', async () => {
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(uncited)).mockResolvedValueOnce(critiqueReply()).mockResolvedValueOnce(reply(clean))
    let t = 0
    const result = await run({
      now: () => t,
      onProgress: (step) => {
        if (step === 'checking') t = 40_000
      },
    })
    expect(mockParse).toHaveBeenCalledTimes(4)
    expect(result.refined).toBe(true)
  })

  it('skips the critique with too little time left, and holds the letter for approval', async () => {
    let t = 0
    mockParse
      .mockImplementationOnce(async () => ((t = 20_000), planReply))
      .mockImplementationOnce(async () => ((t = 49_000), letterReply(clean)))
    const steps: string[] = []
    const result = await run({ now: () => t, onProgress: (s) => steps.push(s) })
    expect(mockParse).toHaveBeenCalledTimes(2)
    expect(steps).not.toContain('critiquing')
    expect(result.reviewed).toBe(false)
    expect(result.refined).toBe(false)
    expect(result.content).toContain('40%')
    expect(result.notices).toContain(NOT_REVIEWED_NOTICE)
    expect(result.pendingApprovals).toEqual([NOT_REVIEWED_APPROVAL])
  })

  it('keeps the written letter when the critique call fails', async () => {
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(clean)).mockRejectedValueOnce(new Error('Request timed out.'))
    const result = await run()
    expect(mockParse).toHaveBeenCalledTimes(3)
    expect(result.content).toContain('40%')
    expect(result.reviewed).toBe(false)
    expect(result.notices).toContain(NOT_REVIEWED_NOTICE)
    expect(result.pendingApprovals).toEqual([NOT_REVIEWED_APPROVAL])
  })

  it('keeps the written letter when the critique is cut off twice', async () => {
    const cutOff = { parsed_output: null, stop_reason: 'max_tokens', content: [], usage: {} }
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(clean)).mockResolvedValueOnce(cutOff).mockResolvedValueOnce(cutOff)
    const result = await run()
    expect(mockParse).toHaveBeenCalledTimes(4)
    expect(result.reviewed).toBe(false)
    expect(result.pendingApprovals).toEqual([NOT_REVIEWED_APPROVAL])
  })

  it('still refines verifier problems when the critique did not run', async () => {
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(uncited)).mockRejectedValueOnce(new Error('overloaded')).mockResolvedValueOnce(reply(clean))
    const result = await run()
    expect(result.refined).toBe(true)
    expect(result.pendingApprovals).toEqual([NOT_REVIEWED_APPROVAL])
  })

  it('keeps the letter before the refine when the refine call fails', async () => {
    mockParse
      .mockResolvedValueOnce(planReply)
      .mockResolvedValueOnce(letterReply(clean))
      .mockResolvedValueOnce(critiqueReply([{ sentence: 'A sentence only the critique quotes.', problem: 'Reads like a stock opening.' }]))
      .mockRejectedValueOnce(new Error('Request timed out.'))
    const result = await run()
    expect(mockParse).toHaveBeenCalledTimes(4)
    expect(result.refined).toBe(false)
    expect(result.content).toContain('40%')
    expect(result.pendingApprovals).toEqual(['A sentence only the critique quotes.: Reads like a stock opening.'])
  })

  it('never gives a call after the first more time than is left', async () => {
    let t = 0
    const seen: { timeout: number; left: number }[] = []
    const deadlineAt = 55_000
    const record = (out: unknown, after: number) => async (_body: unknown, opts: { timeout: number }) => {
      seen.push({ timeout: opts.timeout, left: deadlineAt - t })
      t = after
      return out
    }
    mockParse.mockImplementationOnce(record(planReply, 50_000)).mockImplementationOnce(record(letterReply(clean), 51_000))
    await run({ now: () => t, deadlineAt })
    expect(seen).toHaveLength(2)
    expect(seen[0].timeout).toBe(55_000)
    expect(seen[1]).toEqual({ timeout: 5_000, left: 5_000 })
  })

  it('counts the budget from an absolute deadline, keeping a floor for the first call only', async () => {
    let t = 100_000
    const timeouts: number[] = []
    const record = (out: unknown) => async (_body: unknown, opts: { timeout: number }) => (timeouts.push(opts.timeout), out)
    mockParse.mockImplementationOnce(record(planReply)).mockImplementationOnce(record(letterReply(clean)))
    // 5 s left at the start: the plan still gets 10 s, the letter only what is left.
    await expect(run({ now: () => t, deadlineAt: 105_000, onProgress: (s) => { if (s === 'writing') t = 103_000 } })).resolves.toBeDefined()
    expect(timeouts).toEqual([10_000, 2_000])
  })

  it('retries a cut-off plan call once without thinking', async () => {
    mockParse
      .mockResolvedValueOnce({ parsed_output: null, stop_reason: 'max_tokens', content: [], usage: {} })
      .mockResolvedValueOnce(planReply)
      .mockResolvedValueOnce(letterReply(clean))
      .mockResolvedValueOnce(critiqueReply())
    const result = await run()
    expect(mockParse).toHaveBeenCalledTimes(4)
    expect(mockParse.mock.calls[1][0].thinking).toEqual({ type: 'disabled' })
    expect(result.calls).toBe(4)
    expect(result.refined).toBe(false)
  })

  it('reports progress in order', async () => {
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(clean)).mockResolvedValueOnce(critiqueReply())
    const steps: string[] = []
    await run({ onProgress: (s) => steps.push(s) })
    expect(steps).toEqual(['reading', 'planning', 'writing', 'critiquing', 'checking', 'done'])
  })

  it('includes refining before done when it refines', async () => {
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(uncited)).mockResolvedValueOnce(critiqueReply()).mockResolvedValueOnce(reply(clean))
    const steps: string[] = []
    await run({ onProgress: (s) => steps.push(s) })
    expect(steps).toEqual(['reading', 'planning', 'writing', 'critiquing', 'checking', 'refining', 'done'])
  })

  it('sets the greeting and the sign-off itself, as variant A does', async () => {
    const odd = { ...clean, letter: { ...clean.letter, signOff: 'Sincerely,\nD. Levi' } }
    mockParse.mockResolvedValue(critiqueReply())
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(odd))
    const result = await run({ notes: { hiringManager: 'Dana Cohen' } })
    expect(result.letter.greeting).toBe('Dear Dana Cohen,')
    expect(result.letter.signOff).toBe('Sincerely,\nDana Levi')
    mockParse.mockReset()
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(clean)).mockResolvedValueOnce(critiqueReply())
    expect((await run()).letter.greeting).toBe('Dear Globex Hiring Team,')
  })

  it('detects the language from the text of the posting, not from its markup', async () => {
    const html = {
      ...POSTING,
      jobText: `<div class="job-description" data-section="description"><p style="margin:0"><span class="text">אנחנו מחפשים אנליסט נתונים</span></p><ul class="list"><li class="item"><span>להאיץ את הדיווח</span></li></ul></div>`,
    }
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(clean)).mockResolvedValueOnce(critiqueReply()).mockResolvedValueOnce(reply(clean))
    expect((await run({}, html)).language).toBe('he')
  })

  it('reports the language of the posting', async () => {
    // The quote is not in the Hebrew posting, so the verifier sends the letter to a refine.
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(clean)).mockResolvedValueOnce(critiqueReply()).mockResolvedValueOnce(reply(clean))
    expect((await run({}, HEBREW_POSTING)).language).toBe('he')
    mockParse.mockReset()
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(clean)).mockResolvedValueOnce(critiqueReply())
    expect((await run()).language).toBe('en')
  })
})
