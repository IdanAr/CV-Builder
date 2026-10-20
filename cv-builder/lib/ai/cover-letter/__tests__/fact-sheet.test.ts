import { describe, expect, it } from 'vitest'
import { buildFactSheet, factById, renderFactSheet } from '../fact-sheet'
import { FIXTURE_CV } from './fixture-cv'

describe('buildFactSheet', () => {
  const sheet = buildFactSheet(FIXTURE_CV)
  const texts = sheet.facts.map((f) => f.text)

  it('numbers facts in document order', () => {
    expect(sheet.facts.map((f) => f.id).slice(0, 3)).toEqual(['F1', 'F2', 'F3'])
    expect(texts).toEqual([
      'Analyst with six years in retail data.',
      'I build reporting that teams use.',
      'Senior Analyst at Acme Analytics Ltd, 2021-03 to present',
      'Cut report time by 40%',
      'Led a team of 4 analysts',
      'Analyst at Acme Analytics Ltd, 2019-06 to 2021-02',
      'Built the weekly sales dashboard',
      'Intern at Israel Electric Corporation (IEC), 2018 to 2018',
      'Cleaned meter data',
      'Freelance Analyst, 2017 to 2018',
      'Built pricing models for 3 clients',
      'B.A. Economics, Tel Aviv University, 2014 to 2017',
      'Tableau Desktop Specialist, issued by Tableau, 2022',
      'Price Watch: A price tracking tool',
      'Tracked 2,000 products daily',
      'Analytics: SQL, Python',
      'Career break: Parental leave, 2016 to 2016',
      'Full-time parent.',
    ])
  })

  it('tags each role fact with its employer, title and dates', () => {
    const header = factById(sheet, 'F3')!
    expect(header).toMatchObject({ header: true, source: { section: 'work', names: ['Acme Analytics Ltd'], title: 'Senior Analyst', start: '2021-03' } })
    expect(header.source.end).toBeUndefined()
    expect(factById(sheet, 'F4')).toMatchObject({ header: false, source: { names: ['Acme Analytics Ltd'], title: 'Senior Analyst' } })
    expect(factById(sheet, 'F7')?.source).toMatchObject({ title: 'Analyst', start: '2019-06', end: '2021-02' })
  })

  it('keeps summary sentences without a source name', () => {
    expect(factById(sheet, 'F1')?.source).toEqual({ section: 'summary', names: [] })
  })

  it('names institutions, issuers and certificates on their facts', () => {
    expect(factById(sheet, 'F12')?.source).toMatchObject({ section: 'education', names: ['Tel Aviv University'] })
    expect(factById(sheet, 'F13')?.source).toMatchObject({ section: 'certificate', names: ['Tableau Desktop Specialist', 'Tableau'] })
  })

  it('lists every known name once, never an empty one', () => {
    expect(sheet.knownNames.map((k) => k.name)).toEqual([
      'Acme Analytics Ltd',
      'Israel Electric Corporation (IEC)',
      'Tel Aviv University',
      'Tableau Desktop Specialist',
      'Tableau',
      'Price Watch',
      'Parental leave',
    ])
    expect(sheet.knownNames.every((k) => k.variants.length > 0 && !k.variants.includes(''))).toBe(true)
    expect(sheet.knownNames.find((k) => k.name.startsWith('Israel'))?.variants).toContain('IEC')
  })

  it('keeps facts from a work entry with no employer name', () => {
    expect(factById(sheet, 'F11')?.source).toMatchObject({ section: 'work', names: [], title: 'Freelance Analyst' })
  })

  it('leaves out custom-section fields the CV hides', () => {
    expect(texts).not.toContain('Hidden highlight')
  })

  it('records the candidate name', () => {
    expect(sheet.candidateName).toBe('Dana Levi')
  })

  it('handles an empty CV', () => {
    expect(buildFactSheet({})).toEqual({ facts: [], knownNames: [], candidateName: undefined })
  })
})

describe('renderFactSheet', () => {
  it('prints one line per fact with its source', () => {
    const lines = renderFactSheet(buildFactSheet(FIXTURE_CV)).split('\n')
    expect(lines[0]).toBe('F1 [summary] Analyst with six years in retail data.')
    expect(lines[3]).toBe('F4 [work: Senior Analyst, Acme Analytics Ltd, 2021-03 to present] Cut report time by 40%')
    expect(lines[10]).toBe('F11 [work: Freelance Analyst, 2017 to 2018] Built pricing models for 3 clients')
  })
})
