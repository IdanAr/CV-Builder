import { describe, it, expect } from 'vitest'
import { extractKeywords, keywordOverlap, matchesKeyword } from '../keywords'

describe('extractKeywords', () => {
  it('removes literal stop words like articles and conjunctions', () => {
    const result = extractKeywords('the React framework and the Node.js runtime')
    expect(result).not.toContain('the')
    expect(result).not.toContain('and')
    expect(result).toContain('react')
    expect(result).toContain('node.js')
  })

  it('excludes generic connective and objective JD language, even words that are not literal stop words', () => {
    const result = extractKeywords(
      'We are looking for a strong candidate with excellent communication skills and React experience'
    )
    expect(result).not.toContain('strong')
    expect(result).not.toContain('excellent')
    expect(result).not.toContain('communication')
    expect(result).not.toContain('candidate')
    expect(result).not.toContain('looking')
    expect(result).toContain('react')
  })

  it('excludes generic single-mention nouns that are not technologies, acronyms, or repeated', () => {
    const result = extractKeywords('A wonderful opportunity to grow in a friendly workplace')
    expect(result).not.toContain('wonderful')
    expect(result).not.toContain('friendly')
    expect(result).not.toContain('workplace')
  })

  it('includes known technology terms even in lowercase', () => {
    const result = extractKeywords('experience with kubernetes and terraform required')
    expect(result).toContain('kubernetes')
    expect(result).toContain('terraform')
  })

  it('includes Pascal-case product names not in the static dictionary via internal capitalization', () => {
    const result = extractKeywords('Familiarity with LaunchDarkly and PagerDuty preferred')
    expect(result).toContain('launchdarkly')
    expect(result).toContain('pagerduty')
  })

  it('includes all-caps acronyms not in the static dictionary', () => {
    const result = extractKeywords('SOC2 compliance experience is a plus')
    expect(result).toContain('soc2')
  })

  it('includes a generic-looking word when it is emphasized by repetition in the JD', () => {
    const result = extractKeywords('Onboarding is key. We run onboarding sessions weekly and track onboarding metrics.')
    expect(result).toContain('onboarding')
  })

  it('excludes a generic word mentioned only once', () => {
    const result = extractKeywords('This role focuses on onboarding new hires smoothly')
    expect(result).not.toContain('onboarding')
  })

  it('lowercases all keywords', () => {
    const result = extractKeywords('React TypeScript Node.js')
    expect(result).toContain('react')
    expect(result).toContain('typescript')
    expect(result).toContain('node.js')
  })

  it('returns unique keywords', () => {
    const result = extractKeywords('react react react typescript react')
    expect(result.filter(k => k === 'react').length).toBe(1)
  })

  it('filters out words shorter than 3 characters', () => {
    const result = extractKeywords('we do it at go')
    expect(result.every(w => w.length >= 3)).toBe(true)
  })

  it('handles punctuation without breaking tech tokens', () => {
    const result = extractKeywords('Python, Java, and C++')
    expect(result).toContain('python')
    expect(result).toContain('java')
  })

  it('returns empty array for empty input', () => {
    expect(extractKeywords('')).toEqual([])
  })

  it('returns empty array for whitespace-only input', () => {
    expect(extractKeywords('   ')).toEqual([])
  })
})

describe('keywordOverlap', () => {
  it('identifies matched keywords present in resume text', () => {
    const { matched, missing } = keywordOverlap(
      'experienced react developer with typescript and node.js skills',
      ['react', 'typescript', 'python', 'kubernetes']
    )
    expect(matched).toContain('react')
    expect(matched).toContain('typescript')
    expect(missing).toContain('python')
    expect(missing).toContain('kubernetes')
  })

  it('returns all missing when resume text is empty', () => {
    const { matched, missing } = keywordOverlap('', ['react', 'python'])
    expect(matched).toEqual([])
    expect(missing).toEqual(['react', 'python'])
  })

  it('returns all matched when all keywords are present', () => {
    const { matched, missing } = keywordOverlap('react python typescript', ['react', 'python'])
    expect(matched).toHaveLength(2)
    expect(missing).toHaveLength(0)
  })
})

describe('matchesKeyword', () => {
  it('does not match a keyword embedded in a longer word', () => {
    expect(matchesKeyword('senior javascript developer', 'java')).toBe(false)
    expect(matchesKeyword('built reactive pipelines', 'react')).toBe(false)
  })

  it('matches exact whole words case-insensitively', () => {
    expect(matchesKeyword('Senior Java developer', 'java')).toBe(true)
    expect(matchesKeyword('React and Node.js', 'react')).toBe(true)
  })

  it('handles keywords with regex-special characters', () => {
    expect(matchesKeyword('expert in c++ and c#', 'c++')).toBe(true)
    expect(matchesKeyword('worked with node.js daily', 'node.js')).toBe(true)
    expect(matchesKeyword('used nodexjs once', 'node.js')).toBe(false)
  })

  it('matches at string boundaries and around punctuation', () => {
    expect(matchesKeyword('python', 'python')).toBe(true)
    expect(matchesKeyword('skills: python, sql.', 'python')).toBe(true)
  })
})

describe('keywordOverlap word boundaries', () => {
  it('does not count substring-only matches', () => {
    const { matched, missing } = keywordOverlap('senior javascript developer', ['java', 'javascript'])
    expect(matched).toEqual(['javascript'])
    expect(missing).toEqual(['java'])
  })
})
