import { describe, expect, it } from 'vitest'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import {
  NarrationSchema,
  buildNarrationPrompt,
  confirmedCount,
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
const OTHER = Array.from({ length: 13 }, (_, i) => `x${String(i + 3).padStart(2, '0')}`)
const ALL_IDS = [...SITUATION, ...OTHER]

const PROSE = `Dear Hiring Manager,

I built the reporting pipeline at Acme and cut the weekly close from five days to two. That is the kind of work your analytics team describes.

Sincerely,
Jane Doe`

const LIST_LETTER = (items: string[]) => `Dear Hiring Manager,

Three results from my last role matter most here:
${items.map((i) => `- ${i}`).join('\n')}
They are the closest match to your posting.

Sincerely,
Jane Doe`

type Mark = { caseId: string; sample: number; criterion?: string }

/** One run: 15 cases, 2 samples each (30 letters). Every letter passes and is fast and clean unless an option says otherwise. */
function run(opts: {
  fail?: Mark[]
  na?: Mark[]
  unscored?: Mark[]
  history?: Mark[]
  situationSentences?: Record<string, string[]>
  texts?: Record<string, string>
  ms?: number | ((caseId: string, sample: number) => number | undefined)
  dropped?: Record<string, number>
  narration?: boolean
  dropNarrationFor?: string
  caseIds?: string[]
}): RunSummary {
  const letters = (opts.caseIds ?? ALL_IDS).flatMap((caseId) =>
    [1, 2].map((sample) => {
      const verdicts: LetterVerdicts = { situation_addressed: 'pass', no_factual_errors: 'pass' }
      for (const f of opts.fail ?? []) if (f.caseId === caseId && f.sample === sample) verdicts[f.criterion!] = 'fail'
      for (const f of opts.na ?? []) if (f.caseId === caseId && f.sample === sample) verdicts[f.criterion!] = 'n/a'
      const unscored = opts.unscored?.some((u) => u.caseId === caseId && u.sample === sample)
      const ms = typeof opts.ms === 'function' ? opts.ms(caseId, sample) : (opts.ms ?? 30_000)
      return { caseId, sample, verdicts: unscored ? {} : verdicts, text: opts.texts?.[`${caseId}.s${sample}`] ?? PROSE, ms }
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
            dropped: opts.dropped?.[`${l.caseId}.s${l.sample}`],
          }))
  return { letters, narration }
}

/** n letters scoring `passes` passes on no_factual_errors; everything else clean. */
function factsRun(passes: number, n: number): RunSummary {
  return {
    letters: Array.from({ length: n }, (_, i) => ({ caseId: `f${i}`, sample: 1, verdicts: { no_factual_errors: i < passes ? 'pass' : 'fail', situation_addressed: 'pass' } as LetterVerdicts, text: PROSE, ms: 1000 })),
  }
}

const check = (o: Partial<Parameters<typeof shipCheck>[0]> & { newRun?: RunSummary; oldRun?: RunSummary }) =>
  shipCheck({
    old: o.oldRun ?? run({ narration: false }),
    new: o.newRun ?? run({}),
    confirmedErrors: o.confirmedErrors ?? { old: 1, new: 1 },
    situationCases: o.situationCases ?? SITUATION,
  })
const rule = (c: ReturnType<typeof shipCheck>, id: string) => c.rules.find((r) => r.id === id)!
const factFail = (n: number): Mark[] => Array.from({ length: n }, (_, i) => ({ caseId: OTHER[i], sample: 1, criterion: 'no_factual_errors' }))

describe('shipCheck', () => {
  it('passes a clean fixture on all seven rules', () => {
    const c = check({})
    expect(c.rules.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
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

  it('rule b fails at exactly 10 points below (3 of 30 letters) and passes at 6.7 (2 of 30)', () => {
    expect(rule(check({ newRun: run({ fail: factFail(3) }) }), 'b').pass).toBe(false)
    expect(rule(check({ newRun: run({ fail: factFail(3) }) }), 'b').detail).toContain('-10.0 points')
    expect(check({ newRun: run({ fail: factFail(3) }) }).pass).toBe(false)
    expect(rule(check({ newRun: run({ fail: factFail(2) }) }), 'b').pass).toBe(true)
  })

  it('rule b passes at a real 9-point drop and fails at 10, with no float edge', () => {
    expect(rule(check({ oldRun: factsRun(100, 100), newRun: factsRun(91, 100) }), 'b').pass).toBe(true)
    expect(rule(check({ oldRun: factsRun(100, 100), newRun: factsRun(90, 100) }), 'b').pass).toBe(false)
    // 7/10 and 6/10 differ by 10 points in exact arithmetic; the float 100*7/10 - 100*6/10 does not.
    expect(rule(check({ oldRun: factsRun(7, 10), newRun: factsRun(6, 10) }), 'b').pass).toBe(false)
    // 29/30 against 26/30 is 10 points; 29/30 against 27/30 is 6.7.
    expect(rule(check({ oldRun: factsRun(29, 30), newRun: factsRun(26, 30) }), 'b').pass).toBe(false)
    expect(rule(check({ oldRun: factsRun(29, 30), newRun: factsRun(27, 30) }), 'b').pass).toBe(true)
  })

  it('rules b and c are PENDING, never decided, when a run has no scores', () => {
    const none = run({ narration: false, unscored: ALL_IDS.flatMap((caseId) => [1, 2].map((sample) => ({ caseId, sample }))) })
    for (const c of [check({ oldRun: none }), check({ newRun: none })]) {
      expect(rule(c, 'b').pass).toBe('pending')
      expect(rule(c, 'c').pass).toBe('pending')
      expect(verdictOf(c)).toBe('PENDING')
    }
  })

  it('rules b and c are PENDING when the new run scored fewer letters than it generated', () => {
    const c = check({ newRun: run({ unscored: [{ caseId: 'x01', sample: 1 }, { caseId: 'x03', sample: 1 }] }) })
    expect(rule(c, 'b').pass).toBe('pending')
    expect(rule(c, 'b').detail).toContain('scored 28 of 30')
    expect(rule(c, 'c').pass).toBe('pending')
    expect(c.pass).toBe(false)
  })

  it('rule c is PENDING when every situation letter is n/a', () => {
    const allNa = SITUATION.flatMap((caseId) => [1, 2].map((sample) => ({ caseId, sample, criterion: 'situation_addressed' })))
    expect(rule(check({ newRun: run({ na: allNa }) }), 'c').pass).toBe('pending')
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
    const history = (n: number) => ALL_IDS.flatMap((caseId) => [1, 2].map((sample) => ({ caseId, sample }))).slice(0, n)
    const five = check({ newRun: run({ history: history(5) }) })
    expect(rule(five, 'd').pass).toBe(false)
    expect(rule(five, 'd').detail).toContain('5 of 30')
    expect(rule(check({ newRun: run({ history: history(4) }) }), 'd').pass).toBe(true)
  })

  it('rule d counts letters, not sentences', () => {
    const newRun = run({})
    newRun.narration![0].historySentences = ['One.', 'Two.', 'Three.']
    expect(rule(check({ newRun }), 'd').detail).toContain('1 of 30')
  })

  it('rule d keeps the bar at 26 clean of 30: a short run is PENDING and names its count', () => {
    const short = run({ caseIds: ALL_IDS.slice(0, 10), history: [] })
    const c = check({ newRun: short })
    expect(rule(c, 'd').pass).toBe('pending')
    expect(rule(c, 'd').detail).toContain('only 20 letters judged')
    expect(rule(c, 'd').detail).toContain('30 are needed')
    expect(verdictOf(c)).toBe('PENDING')
    // A short run is not let through even when every letter is clean, and not failed on a looser bar either.
    const dirty = run({ caseIds: ALL_IDS.slice(0, 10), history: [{ caseId: 'x01', sample: 1 }] })
    expect(rule(check({ newRun: dirty }), 'd').pass).toBe('pending')
  })

  it('rule d reports how many judge quotes were dropped as not in the letter', () => {
    const c = check({ newRun: run({ dropped: { 'x01.s1': 2, 'x03.s2': 1 } }) })
    expect(rule(c, 'd').detail).toContain('3 judge-quoted sentences were not found')
    expect(rule(check({}), 'd').detail).not.toContain('judge-quoted')
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

  it('rule f counts letters with a list and passes a 3-item list of full sentences', () => {
    const items = ['I cut the weekly close from five days to two.', 'I moved the reports onto one shared model.', 'I trained six analysts on the new process.']
    const c = check({ newRun: run({ texts: { 'x03.s1': LIST_LETTER(items) } }) })
    expect(rule(c, 'f').pass).toBe(true)
    expect(rule(c, 'f').detail).toContain('1 of 30 letters have a list')
  })

  it('rule f fails a one-item list, a five-item list, a fragment item and two lists', () => {
    const full = (n: number) => Array.from({ length: n }, (_, i) => `I delivered result number ${i + 1} for the team.`)
    const cases: Record<string, string> = {
      one: LIST_LETTER(full(1)),
      five: LIST_LETTER(full(5)),
      fragment: LIST_LETTER(['I cut the close time.', 'Reporting automation', 'I trained six analysts on the process.']),
      two: `Dear Hiring Manager,\n\nFirst, two results:\n- ${full(2).join('\n- ')}\n\nSecond, two more results:\n- ${full(2).join('\n- ')}\n\nSincerely,\nJane Doe`,
    }
    for (const [name, text] of Object.entries(cases)) {
      const c = check({ newRun: run({ texts: { 'x03.s1': text } }) })
      expect(rule(c, 'f').pass, name).toBe(false)
      expect(rule(c, 'f').detail, name).toContain('x03.s1')
      expect(c.pass, name).toBe(false)
    }
  })

  it('rule f is PENDING when letter text is missing', () => {
    const newRun = run({})
    delete newRun.letters[0].text
    expect(rule(check({ newRun }), 'f').pass).toBe('pending')
  })

  it('rule g fails when the new p95 is above the old p95 and passes at equal', () => {
    const slow = run({ ms: (caseId, sample) => (caseId === 'x01' && sample === 1 ? 90_000 : 30_000) })
    // One 90 s letter in 30 is above the 95th percentile rank (29th of 30), so p95 stays 30 s.
    expect(rule(check({ newRun: slow }), 'g').pass).toBe(true)
    const slower = run({ ms: (caseId) => (caseId === 'x01' || caseId === 'x02' ? 90_000 : 30_000) })
    const c = check({ newRun: slower })
    expect(rule(c, 'g').pass).toBe(false)
    expect(rule(c, 'g').detail).toContain('old 30.0 s, new 90.0 s')
    expect(c.pass).toBe(false)
    expect(rule(check({ newRun: run({ ms: 30_000 }) }), 'g').pass).toBe(true)
  })

  it('rule g is PENDING when any generation time is missing on either side', () => {
    const missing = run({ ms: (caseId, sample) => (caseId === 'x05' && sample === 2 ? undefined : 1000) })
    expect(rule(check({ newRun: missing }), 'g').pass).toBe('pending')
    expect(rule(check({ oldRun: { ...missing, narration: undefined } }), 'g').pass).toBe('pending')
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

describe('confirmedCount', () => {
  it('is the sum of the counts once every flagged item is resolved', () => {
    expect(confirmedCount({ 'p01.s1': 1, 'p02.s2': 2 }, { flagged: 5, unresolved: 0 })).toBe(3)
    expect(confirmedCount({}, { flagged: 0, unresolved: 0 })).toBe(0)
  })

  it('is null for an unlabelled sheet, a missing counts file or a missing status record', () => {
    expect(confirmedCount({}, { flagged: 4, unresolved: 4 })).toBeNull()
    expect(confirmedCount({ 'p01.s1': 1 }, { flagged: 4, unresolved: 1 })).toBeNull()
    expect(confirmedCount(undefined, { flagged: 0, unresolved: 0 })).toBeNull()
    expect(confirmedCount({}, undefined)).toBeNull()
  })

  it('makes rule a PENDING through the ship check when the sheet is unlabelled', () => {
    const c = check({ confirmedErrors: { old: confirmedCount({}, { flagged: 3, unresolved: 3 }), new: 0 } })
    expect(rule(c, 'a').pass).toBe('pending')
    expect(verdictOf(c)).toBe('PENDING')
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
