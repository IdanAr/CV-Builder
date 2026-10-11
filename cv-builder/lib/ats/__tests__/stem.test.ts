import { describe, it, expect } from 'vitest'
import { stemWord, stemTokens, tokenize } from '../stem'

function sameStem(words: string[]) {
  const stems = new Set(words.map(stemWord))
  expect([...stems], `${words.join(', ')} -> ${[...stems].join(', ')}`).toHaveLength(1)
}

function differentStems(a: string, b: string) {
  expect(stemWord(a), `${a} vs ${b}`).not.toBe(stemWord(b))
}

describe('stemWord: word families land on one stem', () => {
  it.each([
    [['analysis', 'analyses', 'analyst', 'analysts', 'analyze', 'analyzed', 'analyzing', 'analyse', 'analysed', 'analytics', 'analytical']],
    [['model', 'models', 'modeling', 'modelling', 'modeled']],
    [['manage', 'manages', 'managed', 'managing', 'management']],
    [['optimize', 'optimized', 'optimizing', 'optimization', 'optimise', 'optimisation']],
    [['statistics', 'statistical', 'statistic', 'statistician']],
    [['automate', 'automated', 'automating', 'automation']],
    [['detect', 'detects', 'detected', 'detecting', 'detection']],
    [['engineer', 'engineers', 'engineering']],
    [['process', 'processes', 'processing']],
    [['strategy', 'strategies']],
    [['dataset', 'datasets']],
    [['database', 'databases']],
    [['finance', 'financial']],
    [['security', 'securities', 'secure']],
    [['skill', 'skills', 'skilled']],
    [['plan', 'planning', 'planned']],
    [['business', 'businesses']],
    [['service', 'services']],
  ])('%j', (words) => sameStem(words))
})

describe('stemWord: leaves short and unrelated words apart', () => {
  it('never stems words of 4 characters or fewer', () => {
    for (const w of ['sql', 'aws', 'java', 'data', 'sale', 'logs', 'bill']) expect(stemWord(w)).toBe(w)
  })

  it.each([
    ['engine', 'engineer'],
    ['logic', 'logs'],
    ['executive', 'execution'],
    ['status', 'state'],
    ['fraud', 'fraudulent'],
  ])('%s vs %s', (a, b) => differentStems(a, b))

  it('does not stem tokens that contain digits', () => {
    expect(stemWord('ec2s')).toBe('ec2s')
  })

  it('is case-insensitive', () => {
    expect(stemWord('Analysts')).toBe(stemWord('analysis'))
  })
})

describe('tokenize / stemTokens', () => {
  it('splits on hyphens and punctuation', () => {
    expect(tokenize('Large-scale, multi-million-row datasets.')).toEqual(['large', 'scale', 'multi', 'million', 'row', 'datasets'])
  })

  it('stems every token', () => {
    expect(stemTokens('Data Analyst')).toEqual(stemTokens('data analysis'))
  })
})
