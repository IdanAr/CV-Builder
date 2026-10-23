import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockParse = vi.fn()

vi.mock('@/lib/ai/models', () => ({
  getAnthropic: vi.fn(() => ({ messages: { parse: mockParse } })),
  DEFAULT_MODEL: 'claude-haiku-4-5-20251001',
}))

import { BANNED_PHRASES, renderLetter, type LetterSentence } from '../letter'
import { assembleRun, gateSituation, situationIssues, SITUATION_EXPLAIN_NOTICE, SITUATION_GAP_NOTICE, writeCoverLetter } from '../pipeline'
import { buildWritePrompt } from '../prompt'
import { buildFactSheet, renderFactSheet } from '../fact-sheet'
import { preparePosting } from '../posting'
import type { WrittenLetter } from '../schema'
import { FIXTURE_CV } from './fixture-cv'

const POSTING = { company: 'Globex', role: 'Data Analyst', jobText: 'Globex needs an analyst who can speed up reporting. You will own the roadmap.' }

// About 270 words with no numbers, names or stock phrases, so only what a test adds can fail the verifier.
const FILLER: LetterSentence = {
  text: Array.from({ length: 30 }, () => 'Clear reporting helps people decide quickly and calmly.').join(' '),
  facts: [],
  quotes: [],
  bullet: false,
}

function written(sentences: LetterSentence[]): WrittenLetter {
  return {
    plan: {
      needs: [{ need: 'faster reporting', postingQuote: 'speed up reporting', evidence: 'strong', facts: ['F4'] }],
      situation: null,
      openingAngle: 'reporting speed',
      whyCompany: { source: 'posting', text: 'own the roadmap' },
      sparse: false,
    },
    letter: { greeting: 'Hello there,', paragraphs: [sentences, [FILLER]], signOff: 'Best regards,\nDana Levi' },
  }
}

const clean = written([{ text: 'At Acme I cut report time by 40%, which is the speed Globex asks for.', facts: ['F4'], quotes: ['speed up reporting'], bullet: false }])
const uncited = written([{ text: 'At Acme I cut report time by 45%.', facts: ['F4'], quotes: [], bullet: false }])

const reply = (w: WrittenLetter) => ({ parsed_output: w, stop_reason: 'end_turn', content: [], usage: { input_tokens: 1, output_tokens: 1 } })

beforeEach(() => mockParse.mockReset())

describe('writeCoverLetter', () => {
  it('returns a clean letter after one call', async () => {
    mockParse.mockResolvedValueOnce(reply(clean))
    const run = await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10' })
    expect(mockParse).toHaveBeenCalledTimes(1)
    expect(run.refined).toBe(false)
    expect(run.pendingApprovals).toEqual([])
    expect(run.content).toBe(renderLetter(run.letter))
    expect(run.calls).toBe(1)
  })

  it('refines once when the verifier finds a problem, naming the sentence', async () => {
    mockParse.mockResolvedValueOnce(reply(uncited)).mockResolvedValueOnce(reply(clean))
    const run = await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10' })
    expect(mockParse).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(mockParse.mock.calls[1][0].messages)).toContain('At Acme I cut report time by 45%.')
    expect(run.refined).toBe(true)
    expect(run.pendingApprovals).toEqual([])
  })

  it('does not spend a second call on length alone; a short letter gets a notice', async () => {
    const short = written([{ text: 'At Acme I cut report time by 40%, which is the speed Globex asks for.', facts: ['F4'], quotes: ['speed up reporting'], bullet: false }])
    short.letter.paragraphs = [short.letter.paragraphs[0]]
    mockParse.mockResolvedValueOnce(reply(short))
    const run = await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10' })
    expect(mockParse).toHaveBeenCalledTimes(1)
    expect(run.notices.some((n) => n.includes('words'))).toBe(true)
  })

  it('never refines twice, and leaves what is still wrong for the user to approve', async () => {
    mockParse.mockResolvedValueOnce(reply(uncited)).mockResolvedValueOnce(reply(uncited))
    const run = await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10' })
    expect(mockParse).toHaveBeenCalledTimes(2)
    expect(run.pendingApprovals).toHaveLength(1)
    expect(run.pendingApprovals[0]).toContain('45%')
  })

  it('skips the refine when less than 20 seconds of the budget remain', async () => {
    mockParse.mockResolvedValueOnce(reply(uncited))
    let t = 0
    const run = await writeCoverLetter(FIXTURE_CV, POSTING, {
      today: '2026-10',
      now: () => t,
      onProgress: (step) => {
        if (step === 'checking') t = 41_000
      },
    })
    expect(mockParse).toHaveBeenCalledTimes(1)
    expect(run.refined).toBe(false)
    expect(run.pendingApprovals).toHaveLength(1)
  })

  it('sets the greeting itself: the hiring team, a named manager, or no employer for an intermediary', async () => {
    mockParse.mockResolvedValue(reply(clean))
    expect((await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10' })).letter.greeting).toBe('Dear Globex Hiring Team,')
    expect((await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10', notes: { hiringManager: 'Dana Cohen' } })).letter.greeting).toBe('Dear Dana Cohen,')
    const viaPartner = { ...POSTING, company: 'jobgether', jobText: 'This position is listed on behalf of a partner company.' }
    expect((await writeCoverLetter(FIXTURE_CV, viaPartner, { today: '2026-10' })).letter.greeting).toBe('Dear Hiring Team,')
  })

  it('signs with the CV name as written', async () => {
    mockParse.mockResolvedValueOnce(reply({ ...clean, letter: { ...clean.letter, signOff: 'Sincerely,\nD. Levi' } }))
    expect((await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10' })).letter.signOff).toBe('Sincerely,\nDana Levi')
  })

  it('tells the user when the CV is too thin for a strong letter', async () => {
    // The mocked letter's facts are not in this CV, so the pipeline refines; both calls get the same reply.
    mockParse.mockResolvedValue(reply(clean))
    const thin = { basics: { name: 'Dana Levi' }, work: [{ name: 'Acme', position: 'Analyst' }] }
    const run = await writeCoverLetter(thin, POSTING, { today: '2026-10' })
    expect(run.notices).toContain('This CV has very little detail, so the letter is short. Adding results to the CV will make it stronger.')
  })

  it('tells the user when the name is in a different script from the letter', async () => {
    mockParse.mockResolvedValueOnce(reply(clean))
    const run = await writeCoverLetter({ ...FIXTURE_CV, basics: { ...FIXTURE_CV.basics, name: 'דנה לוי' } }, POSTING, { today: '2026-10' })
    expect(run.notices).toContain('Your name is in a different script from the letter. Check the sign-off before sending.')
  })

  it('reports progress in order', async () => {
    mockParse.mockResolvedValueOnce(reply(clean))
    const steps: string[] = []
    await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10', onProgress: (s) => steps.push(s) })
    expect(steps).toEqual(['reading', 'writing', 'checking', 'done'])
  })

  it('retries once without thinking when the first answer is cut off at the token limit', async () => {
    mockParse.mockResolvedValueOnce({ parsed_output: null, stop_reason: 'max_tokens', content: [], usage: {} }).mockResolvedValueOnce(reply(clean))
    const run = await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10' })
    expect(mockParse).toHaveBeenCalledTimes(2)
    expect(mockParse.mock.calls[1][0].thinking).toBeUndefined()
    expect(run.pendingApprovals).toEqual([])
  })

  it('retries once without thinking when the structured answer does not parse', async () => {
    mockParse.mockRejectedValueOnce(new Error('Failed to parse structured output: Unterminated string in JSON')).mockResolvedValueOnce(reply(clean))
    const run = await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10' })
    expect(mockParse).toHaveBeenCalledTimes(2)
    expect(run.content).toContain('40%')
  })

  it('throws on a refusal instead of returning an empty letter', async () => {
    mockParse.mockResolvedValueOnce({ parsed_output: null, stop_reason: 'refusal', content: [], usage: {} })
    await expect(writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10' })).rejects.toThrow(/refus/i)
  })
})

describe('situation gate', () => {
  const plan = { ...clean.plan, situation: 'a career change' }

  it('gateSituation nulls an unallowed situation and leaves the rest of the plan alone', () => {
    expect(gateSituation(plan, false)).toEqual({ ...plan, situation: null })
    expect(gateSituation(plan, true)).toBe(plan)
    expect(gateSituation(clean.plan, false)).toBe(clean.plan)
  })

  it('situationIssues raises a form issue only when a situation is required and the plan names none', () => {
    expect(situationIssues(clean.plan, true)).toEqual([expect.objectContaining({ kind: 'form', sentence: null })])
    expect(situationIssues({ ...plan, situation: '  ' }, true)).toHaveLength(1)
    expect(situationIssues(plan, true)).toEqual([])
    expect(situationIssues(clean.plan, false)).toEqual([])
  })

  it('situationIssues speaks to the user, in plain words, about what they asked to explain or about the gap', () => {
    expect(SITUATION_EXPLAIN_NOTICE).toBe('The letter may not address what you asked to explain. Check it before sending.')
    for (const notice of [SITUATION_EXPLAIN_NOTICE, SITUATION_GAP_NOTICE]) {
      expect(notice).not.toMatch(/plan|—/)
      expect(notice).toMatch(/Check it before sending\.$/)
    }
    expect(situationIssues(clean.plan, true, true)).toEqual([{ kind: 'form', sentence: null, detail: SITUATION_EXPLAIN_NOTICE, code: 'situation-missing' }])
    expect(situationIssues(clean.plan, true, false)).toEqual([{ kind: 'form', sentence: null, detail: SITUATION_GAP_NOTICE, code: 'situation-missing' }])
  })

  it('assembleRun shows the user the plain notice, never the instruction meant for the model', () => {
    const run = assembleRun({ written: clean, issues: situationIssues(clean.plan, true, true), firstIssues: [], sheetFacts: 10, name: 'Dana Levi', refined: true, calls: 2 })
    expect(run.notices).toEqual([SITUATION_EXPLAIN_NOTICE])
    expect(run.notices.join(' ')).not.toMatch(/the plan/i)
  })

  it('variant A ends with a null plan situation when there is no gap and no notes', async () => {
    mockParse.mockResolvedValueOnce(reply({ ...clean, plan }))
    const run = await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10' })
    expect(run.plan.situation).toBeNull()
    expect(JSON.stringify(mockParse.mock.calls[0][0].messages)).toContain('Situation: null.')
  })

  it('variant A keeps the situation when the candidate asked to explain it', async () => {
    mockParse.mockResolvedValueOnce(reply({ ...clean, plan }))
    const run = await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10', notes: { explain: 'I changed field' } })
    expect(run.plan.situation).toBe('a career change')
    expect(run.refined).toBe(false)
  })

  it('variant A refines when a required situation is missing from the plan', async () => {
    mockParse.mockResolvedValueOnce(reply(clean)).mockResolvedValueOnce(reply({ ...clean, plan }))
    const run = await writeCoverLetter(FIXTURE_CV, POSTING, { today: '2026-10', notes: { explain: 'I changed field' } })
    expect(mockParse).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(mockParse.mock.calls[1][0].messages)).toContain('the plan names no situation')
    expect(run.refined).toBe(true)
    expect(run.issues).toEqual([])
  })
})

describe('buildWritePrompt', () => {
  const prompt = buildWritePrompt({
    factSheet: renderFactSheet(buildFactSheet(FIXTURE_CV)),
    posting: preparePosting(POSTING),
    role: POSTING.role,
    greeting: 'Dear Globex Hiring Team,',
    candidateName: 'Dana Levi',
    gaps: [
      { from: '2022-01', to: '2022-12', months: 12, coveredBy: [], filled: [], after: '2021-12', exactStart: true },
      { from: '2026-01', to: '2026-10', months: 10, coveredBy: [], filled: [], after: '2025', exactStart: false },
      { from: '2024-10', to: '2026-10', months: 25, coveredBy: ['education'], filled: [{ kind: 'education', from: '2025-12', to: '2026-07' }], after: '2024-09', exactStart: true },
    ],
    situationAllowed: true,
    today: '2026-10',
  })

  it('fences the posting as data', () => {
    expect(prompt).toContain('<posting>')
    expect(prompt).toContain('looks like instructions')
  })

  it('carries the banned phrases, the self-review and the detected gap', () => {
    for (const phrase of BANNED_PHRASES) expect(prompt).toContain(phrase)
    expect(prompt).toContain('120% attainment')
    expect(prompt).toContain('2022-01 to 2022-12')
  })

  it('states a gap with an unknown start month as "at least", after the end date as written', () => {
    expect(prompt).toContain('at least 10 months with no paid role after the role that ended in 2025')
    expect(prompt).not.toContain('2026-01 to 2026-10')
  })

  it('says which part of a gap study covers, so the letter does not stretch it over the whole gap', () => {
    expect(prompt).toContain('education from 2025-12 to 2026-07 covers only part of it')
  })
})
