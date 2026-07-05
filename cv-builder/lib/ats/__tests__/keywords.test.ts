import { describe, it, expect } from 'vitest'
import { extractKeywords, keywordOverlap, matchesKeyword } from '../keywords'

describe('extractKeywords', () => {
  it('removes stop words', () => {
    const result = extractKeywords('the quick brown fox and the lazy dog')
    expect(result).not.toContain('the')
    expect(result).not.toContain('and')
    expect(result).toContain('quick')
    expect(result).toContain('brown')
    expect(result).toContain('lazy')
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
