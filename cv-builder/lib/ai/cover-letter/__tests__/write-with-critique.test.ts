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
import { writeCoverLetterWithCritique } from '../write-with-critique'
import { FIXTURE_CV } from './fixture-cv'

const POSTING = { company: 'Globex', role: 'Data Analyst', jobText: 'Globex needs an analyst who can speed up reporting. You will own the roadmap.' }
const HEBREW_POSTING = { ...POSTING, jobText: 'אנחנו מחפשים אנליסט נתונים שיעזור לנו להאיץ את הדיווח ולהוביל את מפת הדרכים של הצוות.' }

// About 270 words with no numbers, names or stock phrases, so only what a test adds can fail the verifier.
const FILLER: LetterSentence = {
  text: Array.from({ length: 30 }, () => 'Clear reporting helps people decide quickly and calmly.').join(' '),
  facts: [],
  quotes: [],
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

const clean = written([{ text: 'At Acme I cut report time by 40%, which is the speed Globex asks for.', facts: ['F4'], quotes: ['speed up reporting'] }])
const uncited = written([{ text: 'At Acme I cut report time by 45%.', facts: ['F4'], quotes: [] }])

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
      .mockResolvedValueOnce(critiqueReply([{ sentence: 'At Acme I cut report time by 40%, which is the speed Globex asks for.', problem: 'Reads like a stock opening.' }]))
      .mockResolvedValueOnce(reply(clean))
    const result = await run()
    expect(mockParse).toHaveBeenCalledTimes(4)
    expect(JSON.stringify(mockParse.mock.calls[3][0].messages)).toContain('At Acme I cut report time by 40%, which is the speed Globex asks for.')
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

  it('reports the language of the posting', async () => {
    // The quote is not in the Hebrew posting, so the verifier sends the letter to a refine.
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(clean)).mockResolvedValueOnce(critiqueReply()).mockResolvedValueOnce(reply(clean))
    expect((await run({}, HEBREW_POSTING)).language).toBe('he')
    mockParse.mockReset()
    mockParse.mockResolvedValueOnce(planReply).mockResolvedValueOnce(letterReply(clean)).mockResolvedValueOnce(critiqueReply())
    expect((await run()).language).toBe('en')
  })
})
