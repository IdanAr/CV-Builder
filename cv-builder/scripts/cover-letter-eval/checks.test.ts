import { describe, expect, it } from 'vitest'
import { checkLetter } from './checks'

const base = {
  jobText: 'We need a data analyst with SQL and Python. Contact Dana Cohen with questions.',
  resumeText: 'Data analyst. Built SQL pipelines and Python tooling.',
  candidateName: 'Noa Levi',
}

const letterOf = (body: string) => `Dear Hiring Manager,\n\n${body}\n\nSincerely,\nNoa Levi`

describe('checkLetter', () => {
  it('passes a formal greeting and a sign-off with the candidate name', () => {
    const r = checkLetter({ ...base, letter: letterOf('I built SQL pipelines.') })
    expect(r.formalGreeting).toBe(true)
    expect(r.hasSignOff).toBe(true)
    expect(r.inventedAddressee).toBeNull()
  })

  it('flags a named addressee who is not in the posting, but not one who is', () => {
    expect(checkLetter({ ...base, letter: 'Dear Ms. Sarah Jones,\n\nHi.\n\nBest,\nNoa' }).inventedAddressee).toBe('Ms. Sarah Jones')
    expect(checkLetter({ ...base, letter: 'Dear Dana Cohen,\n\nHi.\n\nBest,\nNoa' }).inventedAddressee).toBeNull()
  })

  it('does not count "To Whom It May Concern" as formal and lists it as a banned phrase', () => {
    const r = checkLetter({ ...base, letter: 'To Whom It May Concern,\n\nI am a team player.\n\nRegards,\nNoa' })
    expect(r.formalGreeting).toBe(false)
    expect(r.bannedPhrases).toEqual(expect.arrayContaining(['to whom it may concern', 'team player']))
  })

  it('finds placeholders and em-dashes', () => {
    const r = checkLetter({ ...base, letter: letterOf('At [Company Name] I led — well, helped.') })
    expect(r.placeholders).toEqual(['[Company Name]'])
    expect(r.hasEmDash).toBe(true)
  })

  it('measures coverage only over job keywords the résumé supports', () => {
    const r = checkLetter({ ...base, letter: letterOf('My SQL work shipped.') })
    expect(r.supportedKeywords).toEqual(expect.arrayContaining(['sql', 'python']))
    expect(r.coveredKeywords).toContain('sql')
    expect(r.coveredKeywords).not.toContain('python')
  })

  it('applies the word band', () => {
    expect(checkLetter({ ...base, letter: letterOf('word '.repeat(300)) }).inWordBand).toBe(true)
    expect(checkLetter({ ...base, letter: letterOf('short') }).inWordBand).toBe(false)
  })
})
