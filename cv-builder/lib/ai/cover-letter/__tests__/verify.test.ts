import { describe, expect, it } from 'vitest'
import { buildFactSheet } from '../fact-sheet'
import type { LetterSentence, StructuredLetter } from '../letter'
import { verifyLetter, type IssueKind, type VerifyInput } from '../verify'
import { FIXTURE_CV } from './fixture-cv'

// Fact IDs in FIXTURE_CV: F3 Senior Analyst at Acme (2021-03 to present), F4 "Cut report time by 40%",
// F5 "Led a team of 4 analysts", F6 Analyst at Acme (2019-06 to 2021-02), F13 Tableau certificate, F16 skills.
const sheet = buildFactSheet(FIXTURE_CV)

const s = (text: string, facts: string[] = [], quotes: string[] = []): LetterSentence => ({ text, facts, quotes, bullet: false })

function letter(sentences: LetterSentence[], extra: Partial<StructuredLetter> = {}): StructuredLetter {
  return { greeting: 'Dear Globex Hiring Team,', paragraphs: [sentences], signOff: 'Best regards,\nDana Levi', ...extra }
}

function verify(l: StructuredLetter, over: Partial<VerifyInput> = {}) {
  return verifyLetter({ letter: l, sheet, jobText: 'You will own the roadmap.', company: 'Globex', role: 'Data Analyst', today: '2026-10', ...over })
}

const of = (kind: IssueKind, issues: ReturnType<typeof verify>) => issues.filter((i) => i.kind === kind)

describe('verifyLetter: numbers', () => {
  it('accepts a number the cited fact states, however it is written', () => {
    expect(of('number', verify(letter([s('At Acme I cut report time by 40 percent.', ['F4'])])))).toEqual([])
  })

  it('flags a number the cited facts do not state', () => {
    const issues = of('number', verify(letter([s('At Acme I cut report time by 45%.', ['F4'])])))
    expect(issues).toHaveLength(1)
    expect(issues[0].detail).toContain('45%')
  })

  it('accepts durations derivable from the cited roles and rejects longer ones', () => {
    expect(of('number', verify(letter([s('I have over 5 years of analytics experience at Acme.', ['F3', 'F6'])])))).toEqual([])
    expect(of('number', verify(letter([s('I have 7 years of analytics experience at Acme.', ['F3', 'F6'])])))).toEqual([])
    expect(of('number', verify(letter([s('I have over 9 years of analytics experience at Acme.', ['F3', 'F6'])])))).toHaveLength(1)
  })

  it('allows one year of slack for approximate durations', () => {
    // Career in FIXTURE_CV: 2017 to 2026-10, at most 10 years.
    expect(of('number', verify(letter([s('I bring about 11 years of analysis behind me.', ['F3'])])))).toEqual([])
    expect(of('number', verify(letter([s('I bring about 13 years of analysis behind me.', ['F3'])])))).toHaveLength(1)
  })

  it('accepts a year from the cited fact dates', () => {
    expect(of('number', verify(letter([s('I have been a senior analyst at Acme since 2021.', ['F3'])])))).toEqual([])
  })

  it('ignores number words that are not a count of something', () => {
    expect(of('number', verify(letter([s('I was one of the first analysts at Acme.', ['F3'])])))).toEqual([])
  })

  it('checks number words that count something', () => {
    expect(of('number', verify(letter([s('At Acme I led a team of four analysts.', ['F5'])])))).toEqual([])
    expect(of('number', verify(letter([s('At Acme I led a team of six analysts.', ['F5'])])))).toHaveLength(1)
  })

  it('skips the greeting and the sign-off', () => {
    const l = letter([s('At Acme I cut report time by 40%.', ['F4'])], { signOff: 'Best regards,\nDana Levi\n054-555-0101' })
    expect(of('number', verify(l))).toEqual([])
    expect(of('guard', verify(l))).toEqual([])
  })
})

describe('verifyLetter: names', () => {
  it('flags an achievement credited to a different employer than its fact', () => {
    const issues = of('name', verify(letter([s('At Israel Electric Corporation I cut report time by 40%.', ['F4'])])))
    expect(issues).toHaveLength(1)
    expect(issues[0].detail).toBe('"Israel Electric Corporation" is named, but the cited facts are from Acme Analytics Ltd.')
  })

  it('flags content from another employer blended into a sentence that names one employer', () => {
    const issues = of('name', verify(letter([s('At Acme I cut report time by 40% and cleaned meter data.', ['F4', 'F9'])])))
    expect(issues.map((i) => i.detail)).toEqual([
      'Part of this sentence comes from Israel Electric Corporation (F9), but only Acme Analytics Ltd is named.',
    ])
  })

  it('allows a degree or certificate alongside the named employer', () => {
    expect(of('name', verify(letter([s('At Acme I cut report time by 40%, building on my economics degree.', ['F4', 'F12'])])))).toEqual([])
  })

  it('requires a named CV entry to be the source of, or appear in, a cited fact', () => {
    expect(of('name', verify(letter([s('I build dashboards in Tableau.', ['F16'])])))).toHaveLength(1)
    expect(of('name', verify(letter([s('I am a certified Tableau Desktop Specialist.', ['F13'])])))).toEqual([])
  })

  it('treats a name the skills list carries as a tool, not an employer claim', () => {
    const withTool = buildFactSheet({ ...FIXTURE_CV, skills: [{ name: 'Tools', keywords: ['SQL', 'Tableau'] }] })
    const issues = verify(letter([s('I build dashboards in SQL and Tableau.', ['F4'])]), { sheet: withTool })
    expect(of('name', issues)).toEqual([])
  })

  it("flags a CV credential credited to the posting company", () => {
    const issues = of('name', verify(letter([s("I earned Globex's Tableau Desktop Specialist certificate.", ['F13'])])))
    expect(issues.map((i) => i.detail)).toEqual(['This credits Globex with a credential the CV lists from Tableau.'])
    expect(of('name', verify(letter([s("My Tableau Desktop Specialist certificate prepares me for Globex's analytics work.", ['F13'])])))).toEqual([])
  })

  it('does not treat the posting company as a CV name', () => {
    expect(of('name', verify(letter([s('I want to bring that to Tableau.', [], ['You will own the roadmap'])]), { company: 'Tableau' }))).toEqual([])
  })
})

describe('verifyLetter: posting quotes', () => {
  it('matches quotes across typographic apostrophes, case and spacing', () => {
    const l = letter([s('You will own the roadmap, which is the part I want.', [], ['you’ll own the roadmap'])])
    expect(of('quote', verify(l, { jobText: "You'll  own the roadmap from day one." }))).toEqual([])
  })

  it('flags a quote the posting does not contain', () => {
    const l = letter([s('Your team values speed.', [], ['we value speed above all'])])
    expect(of('quote', verify(l))).toHaveLength(1)
  })
})

describe('verifyLetter: form', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'steady').join(' ') + '.'

  it('flags stock phrases and em-dashes', () => {
    const details = of('form', verify(letter([s('I am passionate about data — truly.')]))).map((i) => i.detail)
    expect(details.some((d) => d.includes('passionate about'))).toBe(true)
    expect(details.some((d) => d.includes('em-dash'))).toBe(true)
  })

  it('applies the 250-word floor unless the CV is sparse', () => {
    const l = letter([s(words(214))])
    expect(of('form', verify(l)).some((i) => i.detail.includes('words'))).toBe(true)
    expect(of('form', verify(l, { sparse: true })).some((i) => i.detail.includes('words'))).toBe(false)
  })

  it('flags a missing greeting', () => {
    expect(of('form', verify(letter([s(words(260))], { greeting: '' }))).some((i) => i.detail.includes('greeting'))).toBe(true)
  })
})

describe('verifyLetter: lists', () => {
  const b = (text: string): LetterSentence => ({ text, facts: [], quotes: [], bullet: true })
  const lead = s('Several results matter for this team.')
  const NAMES = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']
  const item = (n: number) => b(`The ${NAMES[n - 1]} result shows steady careful analytical work.`)
  const lists = (issues: ReturnType<typeof verify>) => of('form', issues).filter((i) => /list|bullet/i.test(i.detail))

  it('accepts one list of three full sentences', () => {
    expect(lists(verify(letter([lead, item(1), item(2), item(3)])))).toEqual([])
  })

  it('flags a one-item list', () => {
    expect(lists(verify(letter([lead, item(1)])))).toHaveLength(1)
  })

  it('flags a five-item list', () => {
    expect(lists(verify(letter([lead, item(1), item(2), item(3), item(4), item(5)])))).toHaveLength(1)
  })

  it('flags a second list, in another paragraph or after prose', () => {
    expect(lists(verify({ ...letter([lead, item(1), item(2)]), paragraphs: [[lead, item(1), item(2)], [item(3), item(4)]] }))).toHaveLength(1)
    expect(lists(verify(letter([item(1), item(2), s('Then more prose follows.'), item(3), item(4)])))).toHaveLength(1)
  })

  it('flags a bullet under six words, naming the sentence', () => {
    const issues = lists(verify(letter([lead, item(1), item(2), b('Cut report time by 40%.')])))
    expect(issues).toHaveLength(1)
    expect(issues[0].sentence).toBe('Cut report time by 40%.')
  })

  it('does not count the "- " marker as a word, in the length floor or the 6-word floor', () => {
    const words = (n: number) => Array.from({ length: n }, () => 'steady').join(' ') + '.'
    // 4 (greeting) + 4 (sign-off) + 221 + 3 x 6 = 247 real words; counting the three markers would make 250.
    const l = letter([s(words(221)), b(words(6)), b(words(6)), b(words(6))])
    expect(of('form', verify(l)).some((i) => /^The letter has 247 words/.test(i.detail))).toBe(true)
    // "- five word item here" is five words once the marker is gone.
    const typed = lists(verify(letter([lead, item(1), item(2), b('- five word item here')])))
    expect(typed).toHaveLength(1)
    expect(typed[0].sentence).toBe('- five word item here')
  })

  it('still checks a bullet like any sentence', () => {
    expect(of('number', verify(letter([lead, item(1), item(2), { ...b('At Acme I cut report time by 45% with the finance team.'), facts: ['F4'] }])))).toHaveLength(1)
  })
})

describe('verifyLetter: hallucination guard', () => {
  it('flags a technology the CV never mentions', () => {
    expect(of('guard', verify(letter([s('I also run Kubernetes clusters.', ['F16'])]))).map((i) => i.detail)).toEqual([
      'The CV does not mention "kubernetes".',
    ])
  })

  it('checks a possessive name as the name itself', () => {
    expect(of('guard', verify(letter([s("I completed KTNX's analytics program.", ['F12'])]))).map((i) => i.detail)).toEqual([
      'The CV does not mention "ktnx".',
    ])
  })

  it('accepts a posting term in a sentence that cites the posting line it comes from', () => {
    const l = letter([s('Your team works across SIEM and EDR platforms.', [], ['across SIEM and EDR platforms'])])
    expect(of('guard', verify(l, { jobText: 'You will work across SIEM and EDR platforms.' }))).toEqual([])
    expect(of('guard', verify(letter([s('I work across SIEM platforms daily.', ['F16'])])))).toHaveLength(1)
  })

  it('accepts initials of a CV title, common business acronyms and GenAI for generative AI', () => {
    const cv = {
      ...FIXTURE_CV,
      work: [{ name: 'Tavor Devices', position: 'Chief Financial Officer', startDate: '2017', highlights: ['Built generative AI reporting tools'] }],
    }
    const l = letter([s('As CFO I built GenAI-powered reporting with measurable ROI.', ['F4'])])
    expect(of('guard', verify(l, { sheet: buildFactSheet(cv) }))).toEqual([])
  })

  it('does not flag the posting company or a number taken from a cited quote', () => {
    const l = letter([s('Snowflake runs a 24/7 data platform, which is what I want to work on.', [], ['runs a 24/7 data platform'])])
    expect(of('guard', verify(l, { company: 'Snowflake', jobText: 'Snowflake runs a 24/7 data platform.' }))).toEqual([])
  })
})
