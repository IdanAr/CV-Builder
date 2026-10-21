import { describe, expect, it } from 'vitest'
import { HUMAN_READ_TARGET, buildHumanRead, parseAnswers, scoreHumanRead, type HumanReadCase, type HumanReadLetter } from './human-read'

const cases: HumanReadCase[] = [
  { caseId: 'x01', company: 'Acme Robotics', role: 'Data Analyst', cvTitle: 'Jane Doe (invented)' },
  { caseId: 'x02', company: 'Birch Labs', role: 'Support Lead', cvTitle: 'John Roe (invented)' },
  { caseId: 'x03', company: 'Cedar Bank', role: 'Auditor', cvTitle: 'Ann Poe (invented)' },
  { caseId: 'x04', company: 'Delta Foods', role: 'Planner', cvTitle: 'Bo Moe (invented)' },
]

const run = (tag: string, ids: string[], samples = [1]): HumanReadLetter[] =>
  ids.flatMap((caseId) => samples.map((sample) => ({ caseId, sample, content: `${tag} letter for ${caseId} sample ${sample}` })))

const ALL = ['x01', 'x02', 'x03', 'x04']

describe('buildHumanRead', () => {
  it('uses sample 1 of each run and records which side is the new letter', () => {
    const { sheet, key, skipped } = buildHumanRead({ cases, oldRun: run('OLDTEXT', ALL, [1, 2]), newRun: run('NEWTEXT', ALL, [1, 2]), seed: 5 })
    expect(skipped).toEqual([])
    expect(key).toHaveLength(4)
    expect(sheet).not.toMatch(/sample 2/)
    for (const k of key) {
      const section = sheet.split(/^## /m).find((s) => s.startsWith(k.id))!
      const side = (letter: 'A' | 'B') => section.split(`### Letter ${letter}`)[1].split(/### Letter|Prefer:/)[0]
      const newSide = k.newIs
      const oldSide = newSide === 'A' ? 'B' : 'A'
      expect(side(newSide)).toContain(`NEWTEXT letter for ${k.caseId} sample 1`)
      expect(side(oldSide)).toContain(`OLDTEXT letter for ${k.caseId} sample 1`)
    }
  })

  it('is deterministic for a seed, balances the sides and varies with the seed', () => {
    const args = { cases, oldRun: run('o', ALL), newRun: run('n', ALL) }
    const a = buildHumanRead({ ...args, seed: 3 })
    const b = buildHumanRead({ ...args, seed: 3 })
    expect(a.sheet).toBe(b.sheet)
    expect(a.key).toEqual(b.key)
    expect(a.key.filter((k) => k.newIs === 'A')).toHaveLength(2)
    const others = [1, 2, 3, 4, 5, 6].map((seed) => buildHumanRead({ ...args, seed }).key.map((k) => k.newIs).join(''))
    expect(new Set(others).size).toBeGreaterThan(1)
  })

  it('shows company, role and CV title and never reveals which letter is new', () => {
    const { sheet } = buildHumanRead({ cases, oldRun: run('o', ALL), newRun: run('n', ALL), seed: 1 })
    expect(sheet).toContain('Acme Robotics')
    expect(sheet).toContain('Data Analyst')
    expect(sheet).toContain('Jane Doe (invented)')
    expect(sheet).not.toMatch(/baseline|variant|\bnew\b|\bold\b/i)
    expect(sheet.match(/^Prefer: A \| B \| same$/gm)).toHaveLength(4)
  })

  it('lists a case missing from either run as skipped instead of failing', () => {
    const { key, skipped, sheet } = buildHumanRead({ cases, oldRun: run('o', ['x01', 'x02', 'x03']), newRun: run('n', ['x01', 'x03', 'x04']), seed: 1 })
    expect(key.map((k) => k.caseId)).toEqual(['x01', 'x03'])
    expect(skipped.map((s) => s.caseId).sort()).toEqual(['x02', 'x04'])
    expect(skipped.find((s) => s.caseId === 'x02')!.reason).toMatch(/new/)
    expect(sheet).not.toContain('Birch Labs')
  })

  it('skips a case whose sample 1 is empty or errored', () => {
    const old = run('o', ALL)
    old[0] = { ...old[0], content: '   ' }
    const { skipped } = buildHumanRead({ cases, oldRun: old, newRun: run('n', ALL), seed: 1 })
    expect(skipped.map((s) => s.caseId)).toEqual(['x01'])
  })
})

describe('parseAnswers', () => {
  const sheet = '## H01 (Acme)\n\nPrefer: A | B | same\n\n## H02 (Birch)\n\nPrefer: a\n\n## H03 (Cedar)\n\nPrefer: SAME\n\n## H04 (Delta)\n\nPrefer: B\n\n## H05 (Echo)\n\nPrefer: A, because it is shorter\n'
  it('reads A, B and same case-insensitively and ignores the unfilled template line', () => {
    expect([...parseAnswers(sheet)]).toEqual([['H02', 'A'], ['H03', 'same'], ['H04', 'B']])
  })
})

describe('scoreHumanRead', () => {
  const key = ['A', 'B', 'A', 'B', 'A', 'B'].map((newIs, i) => ({ id: `H0${i + 1}`, caseId: `x0${i + 1}`, newIs: newIs as 'A' | 'B' }))

  it('counts the new letter preferred, ignores same and unanswered, and passes at 70%', () => {
    // new wins H01 (A), H02 (B), H03 (A), H04 (B), H05 (A); old wins none; H06 unanswered, so 5 of 5
    const answers = new Map([['H01', 'A'], ['H02', 'B'], ['H03', 'A'], ['H04', 'B'], ['H05', 'same']] as const)
    const s = scoreHumanRead(key, answers)
    expect(s).toMatchObject({ total: 6, answered: 5, unanswered: 1, newPreferred: 4, oldPreferred: 0, same: 1, rate: 1, pass: true })
    expect(HUMAN_READ_TARGET).toBe(0.7)
  })

  it('maps A/B through the key and fails below 70%', () => {
    // 2 new, 1 old = 66.7%
    const answers = new Map([['H01', 'A'], ['H02', 'B'], ['H03', 'B']] as const)
    const s = scoreHumanRead(key, answers)
    expect(s.newPreferred).toBe(2)
    expect(s.oldPreferred).toBe(1)
    expect(s.rate).toBeCloseTo(2 / 3)
    expect(s.pass).toBe(false)
  })

  it('passes exactly at 70% and has no rate when nobody chose a side', () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ id: `H${i + 1}`, caseId: `c${i}`, newIs: 'A' as const }))
    const answers = new Map(ten.map((k, i) => [k.id, i < 7 ? 'A' : 'B'] as const))
    expect(scoreHumanRead(ten, answers)).toMatchObject({ rate: 0.7, pass: true })
    const none = scoreHumanRead(key, new Map())
    expect(none).toMatchObject({ answered: 0, unanswered: 6, rate: null, pass: false })
    expect(scoreHumanRead(key, new Map([['H01', 'same']] as const))).toMatchObject({ answered: 1, same: 1, rate: null, pass: false })
  })

  it('ignores answers for ids not in the key', () => {
    expect(scoreHumanRead(key, new Map([['H99', 'A']] as const)).answered).toBe(0)
  })
})
