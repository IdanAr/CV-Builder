import { describe, expect, it } from 'vitest'
import { buildFactSheet } from '@/lib/ai/cover-letter/fact-sheet'
import { verifyLetter } from '@/lib/ai/cover-letter/verify'
import { FIXTURE_CV } from '@/lib/ai/cover-letter/__tests__/fixture-cv'
import { inferCitations, inferQuotes, parsePlainLetter } from './infer-citations'

const sheet = buildFactSheet(FIXTURE_CV)

describe('parsePlainLetter', () => {
  it('splits greeting, body paragraphs and sign-off', () => {
    const parsed = parsePlainLetter(
      'Dear Hiring Manager,\n\nI build reporting. It saves time for teams.\n\nI would like to talk about the role.\n\nSincerely,\nDana Levi',
    )
    expect(parsed.greeting).toBe('Dear Hiring Manager,')
    expect(parsed.paragraphs.map((p) => p.map((s) => s.text))).toEqual([
      ['I build reporting.', 'It saves time for teams.'],
      ['I would like to talk about the role.'],
    ])
    expect(parsed.signOff).toBe('Sincerely,\nDana Levi')
    expect(parsed.paragraphs.flat().every((s) => s.facts.length === 0 && s.quotes.length === 0)).toBe(true)
  })

  it('keeps a long closing sentence that starts with "Thank you" in the body', () => {
    const parsed = parsePlainLetter('Dear Team,\n\nThank you for considering my application for this role at your company.\n\nBest regards,\nDana')
    expect(parsed.paragraphs).toHaveLength(1)
    expect(parsed.signOff).toBe('Best regards,\nDana')
  })
})

describe('inferQuotes', () => {
  it('quotes the posting line for a posting term in a sentence about the employer', () => {
    const job = 'About us\nWe run Databricks at scale for 200 customers.\nBenefits'
    expect(inferQuotes('I want to help your team grow its Databricks platform.', job, sheet)).toEqual(['We run Databricks at scale for 200 customers.'])
  })

  it('quotes nothing for a sentence about the candidate alone', () => {
    expect(inferQuotes('I ran Databricks jobs every day.', 'We run Databricks at scale.', sheet)).toEqual([])
  })
})

describe('inferCitations', () => {
  const nameIssues = (text: string) => {
    const facts = inferCitations(text, sheet, ['Globex'])
    const issues = verifyLetter({
      letter: { greeting: 'Dear Globex Hiring Team,', paragraphs: [[{ text, facts, quotes: [], bullet: false }]], signOff: 'Best,\nDana' },
      sheet,
      jobText: '',
      company: 'Globex',
      role: 'Analyst',
      today: '2026-10',
    })
    return issues.filter((i) => i.kind === 'name' || i.kind === 'number')
  }

  it('cites the fact a sentence restates, not the employer it names', () => {
    expect(inferCitations('At Israel Electric Corporation I cut report time by 40% for the whole team.', sheet, ['Globex'])).toEqual(['F3', 'F4'])
    expect(nameIssues('At Israel Electric Corporation I cut report time by 40% for the whole team.')).toHaveLength(1)
  })

  it('finds nothing wrong when the employer named is the fact source', () => {
    expect(nameIssues('At Acme I cut report time by 40% for the whole team.')).toEqual([])
  })

  it("cites another employer's fact when the sentence carries words only that fact has", () => {
    const text = 'At Acme I built the weekly sales dashboard and cleaned meter data.'
    expect(inferCitations(text, sheet, ['Globex'])).toContain('F9')
    expect(nameIssues(text).map((i) => i.detail)).toEqual([
      'Part of this sentence comes from Israel Electric Corporation (F8, F9), but only Acme Analytics Ltd is named.',
    ])
  })

  it("does not cite another employer's fact for wording both jobs share", () => {
    const twoJobs = buildFactSheet({
      work: [
        { name: 'Acme Analytics', position: 'Analyst', startDate: '2021', highlights: ['Built SQL reporting pipelines for finance'] },
        { name: 'Globex Retail', position: 'Analyst', startDate: '2018', endDate: '2020', highlights: ['Built SQL reporting pipelines for stores'] },
      ],
    })
    expect(inferCitations('At Acme I built SQL reporting pipelines for the finance team.', twoJobs)).toEqual(['F1', 'F2'])
  })

  it('cites a certificate or project the sentence names outright', () => {
    const text = 'My SQL, Python and analytics work, combined with my Tableau Desktop Specialist certificate, prepared me for this.'
    expect(inferCitations(text, sheet, ['Globex'])).toContain('F16')
    expect(inferCitations(text, sheet, ['Globex'])).toContain('F13')
    expect(nameIssues(text)).toEqual([])
  })

  it('cites each institution a credentials sentence names', () => {
    const text = 'I hold a B.A. in Economics from Tel Aviv University and completed the Tableau Desktop Specialist certificate.'
    expect(inferCitations(text, sheet, ['Globex'])).toEqual(expect.arrayContaining(['F12', 'F13']))
    expect(nameIssues(text)).toEqual([])
  })

  it('cites the named employer when the content only matches the summary or skills', () => {
    const text = 'Throughout my years at Acme I kept my retail data analysis sharp in SQL and Python.'
    expect(inferCitations(text, sheet, ['Globex'])).toContain('F3')
    expect(nameIssues(text)).toEqual([])
  })

  it('cites the named entries when a sentence attributes no content', () => {
    const text = 'My years at Acme and Israel Electric Corporation taught me to work carefully.'
    expect(inferCitations(text, sheet, ['Globex'])).toEqual(['F3', 'F6', 'F8'])
    expect(nameIssues(text)).toEqual([])
  })
})
