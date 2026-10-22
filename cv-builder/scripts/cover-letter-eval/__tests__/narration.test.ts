import { describe, expect, it } from 'vitest'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import {
  NarrationSchema,
  buildNarrationPrompt,
  groundSentences,
  isLetterFile,
  passRate,
  renderShipCheck,
  shipCheck,
  situationCaseIds,
  verdictOf,
  type LetterVerdicts,
  type RunSummary,
} from '../narration'

const SITUATION = ['x01', 'x02']
const OTHER = ['x03', 'x04', 'x05']

/** One run with two samples per case. Every letter passes unless `fail` says otherwise. */
function run(opts: {
  fail?: { caseId: string; sample: number; criterion: string }[]
  na?: { caseId: string; sample: number; criterion: string }[]
  history?: { caseId: string; sample: number }[]
  situationSentences?: Record<string, string[]>
  narration?: boolean
  dropNarrationFor?: string
}): RunSummary {
  const ids = [...SITUATION, ...OTHER]
  const letters = ids.flatMap((caseId) =>
    [1, 2].map((sample) => {
      const verdicts: LetterVerdicts = { situation_addressed: 'pass', no_factual_errors: 'pass' }
      for (const f of opts.fail ?? []) if (f.caseId === caseId && f.sample === sample) verdicts[f.criterion] = 'fail'
      for (const f of opts.na ?? []) if (f.caseId === caseId && f.sample === sample) verdicts[f.criterion] = 'n/a'
      return { caseId, sample, verdicts }
    })
  )
  const narration =
    opts.narration === false
      ? undefined
      : letters
          .filter((l) => l.caseId !== opts.dropNarrationFor)
          .map((l) => ({
            caseId: l.caseId,
            sample: l.sample,
            historySentences: opts.history?.some((h) => h.caseId === l.caseId && h.sample === l.sample) ? ['I worked at Acme, then at Birch.'] : [],
            situationSentences: opts.situationSentences?.[`${l.caseId}.s${l.sample}`] ?? [],
          }))
  return { letters, narration }
}

const check = (o: Partial<Parameters<typeof shipCheck>[0]> & { newRun?: RunSummary; oldRun?: RunSummary }) =>
  shipCheck({
    old: o.oldRun ?? run({ narration: false }),
    new: o.newRun ?? run({}),
    confirmedErrors: o.confirmedErrors ?? { old: 1, new: 1 },
    situationCases: o.situationCases ?? SITUATION,
  })
const rule = (c: ReturnType<typeof shipCheck>, id: string) => c.rules.find((r) => r.id === id)!

describe('shipCheck', () => {
  it('passes a clean fixture on all five rules', () => {
    const c = check({})
    expect(c.rules.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(c.rules.every((r) => r.pass === true)).toBe(true)
    expect(c.pass).toBe(true)
    expect(verdictOf(c)).toBe('PASS')
  })

  it('rule a fails when the new run has more confirmed errors', () => {
    const c = check({ confirmedErrors: { old: 1, new: 2 } })
    expect(rule(c, 'a').pass).toBe(false)
    expect(c.pass).toBe(false)
    expect(verdictOf(c)).toBe('FAIL')
  })

  it('rule a allows equal or fewer confirmed errors', () => {
    expect(rule(check({ confirmedErrors: { old: 1, new: 1 } }), 'a').pass).toBe(true)
    expect(rule(check({ confirmedErrors: { old: 1, new: 0 } }), 'a').pass).toBe(true)
  })

  it('rule b fails when no_factual_errors is 10 or more points lower, passes at 9', () => {
    // 10 letters: one failing letter in the new run is exactly 10 points.
    const oldRun = run({ narration: false })
    const c = check({ oldRun, newRun: run({ fail: [{ caseId: 'x03', sample: 1, criterion: 'no_factual_errors' }] }) })
    expect(rule(c, 'b').pass).toBe(false)
    expect(c.pass).toBe(false)
    // Old run already has one failing letter: the gap is then 0 points.
    const oldWithFail = run({ narration: false, fail: [{ caseId: 'x03', sample: 1, criterion: 'no_factual_errors' }] })
    expect(rule(check({ oldRun: oldWithFail, newRun: run({ fail: [{ caseId: 'x04', sample: 1, criterion: 'no_factual_errors' }] }) }), 'b').pass).toBe(true)
  })

  it('rule c fails when situation_addressed is lower on the situation cases', () => {
    const c = check({ newRun: run({ fail: [{ caseId: 'x01', sample: 1, criterion: 'situation_addressed' }] }) })
    expect(rule(c, 'c').pass).toBe(false)
    expect(c.pass).toBe(false)
  })

  it('rule c ignores situation_addressed on non-situation cases', () => {
    const c = check({ newRun: run({ fail: [{ caseId: 'x03', sample: 1, criterion: 'situation_addressed' }] }) })
    expect(rule(c, 'c').pass).toBe(true)
  })

  it('rule c leaves n/a scores out of the rate, as report does', () => {
    const oldRun = run({ narration: false, fail: [{ caseId: 'x01', sample: 1, criterion: 'situation_addressed' }] })
    // New run: the one letter that failed in the old run is n/a, the other three pass.
    const newRun = run({ na: [{ caseId: 'x01', sample: 1, criterion: 'situation_addressed' }] })
    expect(rule(check({ oldRun, newRun }), 'c').pass).toBe(true)
    // Old 3/4 = 75%; new 2/3 = 67% with a real fail instead of n/a.
    const worse = run({ na: [{ caseId: 'x01', sample: 1, criterion: 'situation_addressed' }], fail: [{ caseId: 'x01', sample: 2, criterion: 'situation_addressed' }] })
    expect(rule(check({ oldRun, newRun: worse }), 'c').pass).toBe(false)
  })

  it('rule d fails when 5 of 30 letters have a history sentence, passes at 4', () => {
    const letters30 = (history: number) => {
      const ids = Array.from({ length: 15 }, (_, i) => `y${String(i + 1).padStart(2, '0')}`)
      const letters = ids.flatMap((caseId) => [1, 2].map((sample) => ({ caseId, sample, verdicts: { situation_addressed: 'pass', no_factual_errors: 'pass' } as LetterVerdicts })))
      return {
        letters,
        narration: letters.map((l, i) => ({ caseId: l.caseId, sample: l.sample, historySentences: i < history ? ['I worked at Acme.'] : [], situationSentences: [] })),
      } satisfies RunSummary
    }
    const old = { letters: letters30(0).letters }
    const five = shipCheck({ old, new: letters30(5), confirmedErrors: { old: 1, new: 1 }, situationCases: [] })
    expect(rule(five, 'd').pass).toBe(false)
    expect(rule(five, 'd').detail).toContain('5 of 30')
    const four = shipCheck({ old, new: letters30(4), confirmedErrors: { old: 1, new: 1 }, situationCases: [] })
    expect(rule(four, 'd').pass).toBe(true)
  })

  it('rule d counts letters, not sentences', () => {
    const newRun = run({})
    newRun.narration![0].historySentences = ['One.', 'Two.', 'Three.']
    expect(rule(check({ newRun }), 'd').detail).toContain('1 of 10')
  })

  it('rule e fails when a non-situation letter has two situation sentences', () => {
    const c = check({ newRun: run({ situationSentences: { 'x03.s1': ['I am changing fields.', 'I took a break.'] } }) })
    expect(rule(c, 'e').pass).toBe(false)
    expect(rule(c, 'e').detail).toContain('x03.s1')
    expect(c.pass).toBe(false)
  })

  it('rule e allows one situation sentence on a non-situation letter and any number on a situation case', () => {
    const c = check({ newRun: run({ situationSentences: { 'x03.s1': ['One only.'], 'x01.s1': ['A.', 'B.', 'C.'] } }) })
    expect(rule(c, 'e').pass).toBe(true)
  })

  it('a missing confirmed count gives PENDING on rule a and a verdict that is not PASS', () => {
    for (const confirmedErrors of [{ old: null, new: 1 }, { old: 1, new: null }, { old: null, new: null }]) {
      const c = check({ confirmedErrors })
      expect(rule(c, 'a').pass).toBe('pending')
      expect(c.pass).toBe(false)
      expect(verdictOf(c)).toBe('PENDING')
    }
  })

  it('missing narration gives PENDING on rules d and e', () => {
    const c = check({ newRun: run({ narration: false }) })
    expect(rule(c, 'd').pass).toBe('pending')
    expect(rule(c, 'e').pass).toBe('pending')
    expect(c.pass).toBe(false)
    expect(verdictOf(c)).toBe('PENDING')
  })

  it('narration that does not cover every letter is PENDING, not a pass', () => {
    const c = check({ newRun: run({ dropNarrationFor: 'x03' }) })
    expect(rule(c, 'd').pass).toBe('pending')
    expect(rule(c, 'd').detail).toContain('2 letters')
  })

  it('a failing rule outranks a pending one in the verdict', () => {
    const c = check({ confirmedErrors: { old: null, new: 1 }, newRun: run({ fail: [{ caseId: 'x01', sample: 1, criterion: 'situation_addressed' }] }) })
    expect(verdictOf(c)).toBe('FAIL')
  })
})

describe('passRate', () => {
  it('excludes n/a and returns 0 for no scored letters', () => {
    expect(passRate(['pass', 'fail', 'n/a', 'pass'])).toEqual({ rate: (100 * 2) / 3, n: 3 })
    expect(passRate(['n/a'])).toEqual({ rate: 0, n: 0 })
  })
})

describe('renderShipCheck', () => {
  it('prints every rule with PASS, FAIL or PENDING and the overall verdict', () => {
    const text = renderShipCheck('b3', 'b4', check({ confirmedErrors: { old: 1, new: null }, newRun: run({ situationSentences: { 'x03.s1': ['A.', 'B.'] } }) }))
    expect(text).toMatch(/\(a\).*PENDING/)
    expect(text).toMatch(/\(e\).*FAIL/)
    expect(text).toMatch(/\(b\).*PASS/)
    expect(text).toContain('Verdict: FAIL')
    expect(text).toContain('b3')
    expect(text).toContain('b4')
  })
})

const resume = (work: { startDate: string; endDate?: string }[]): ResumeData =>
  ({ basics: { name: 'Jane Doe' }, work: work.map((w, i) => ({ name: `Acme ${i}`, position: 'Analyst', ...w })) }) as unknown as ResumeData

describe('situationCaseIds', () => {
  it('always includes the named cases and adds any case whose dates show a gap', () => {
    const cases = [
      { id: 'p07', resume: resume([{ startDate: '2018-01', endDate: 'present' }]) },
      { id: 'z01', resume: resume([{ startDate: '2018-01', endDate: '2020-01' }, { startDate: '2022-06', endDate: 'present' }]) },
      { id: 'z02', resume: resume([{ startDate: '2018-01', endDate: '2020-01' }, { startDate: '2020-02', endDate: 'present' }]) },
    ]
    expect(situationCaseIds(cases, '2026-10')).toEqual(['p07', 's02', 's04', 's07', 's08', 'z01'])
  })
})

describe('buildNarrationPrompt', () => {
  it('embeds the letter, asks for exact sentences and treats the letter as data', () => {
    const prompt = buildNarrationPrompt('Dear Hiring Manager,\n\nI worked at Acme from 2019 to 2021.')
    expect(prompt).toContain('I worked at Acme from 2019 to 2021.')
    expect(prompt).toMatch(/exact/i)
    expect(prompt).toMatch(/only narrates? (the candidate's )?career history/i)
    expect(prompt).toMatch(/gap|career change|stretch|overqualif/i)
    expect(prompt).toMatch(/instructions/i)
  })
})

describe('NarrationSchema', () => {
  it('accepts the two arrays and rejects anything else', () => {
    expect(NarrationSchema.parse({ historySentences: ['A.'], situationSentences: [] })).toEqual({ historySentences: ['A.'], situationSentences: [] })
    expect(() => NarrationSchema.parse({ historySentences: 'A.' })).toThrow()
  })
})

describe('groundSentences', () => {
  it('keeps only sentences that really appear in the letter, ignoring whitespace', () => {
    const letter = 'I led the team.\nThen I moved to  Birch\nin 2020.'
    expect(groundSentences(letter, ['I led the team.', 'Then I moved to Birch in 2020.', 'Invented sentence.'])).toEqual({
      kept: ['I led the team.', 'Then I moved to Birch in 2020.'],
      dropped: 1,
    })
  })
})

describe('isLetterFile', () => {
  it('matches letter files and not the narration file', () => {
    expect(isLetterFile('p01.s1.json')).toBe(true)
    expect(isLetterFile('s09.s2.json')).toBe(true)
    expect(isLetterFile('narration.json')).toBe(false)
  })
})
