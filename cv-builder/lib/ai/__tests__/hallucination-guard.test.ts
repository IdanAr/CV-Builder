// lib/ai/__tests__/hallucination-guard.test.ts
import { describe, it, expect } from 'vitest'
import { detectHallucinations } from '../hallucination-guard'

describe('detectHallucinations', () => {
  it('detects percentage not in original', () => {
    const result = detectHallucinations(
      'built react dashboard for users',
      'Built React dashboard used by 500 users, increasing retention by 40%'
    )
    expect(result).toContain('40%')
  })

  it('detects standalone numbers not in original', () => {
    const result = detectHallucinations(
      'built react dashboard for users',
      'Built React dashboard used by 500 users'
    )
    expect(result).toContain('500')
  })

  it('does not flag numbers that were in the original', () => {
    const result = detectHallucinations(
      'built react dashboard 500 users 40%',
      'Built React dashboard used by 500 users, increasing retention by 40%'
    )
    expect(result).toHaveLength(0)
  })

  it('detects dollar amounts not in original', () => {
    const result = detectHallucinations(
      'managed team projects',
      'Managed $2M budget across 3 projects'
    )
    expect(result).toContain('$2M')
  })

  it('detects multipliers not in original', () => {
    const result = detectHallucinations(
      'improved performance',
      'Improved performance by 3x in production'
    )
    expect(result).toContain('3x')
  })

  it('returns empty array when no numbers in generated text', () => {
    const result = detectHallucinations('', 'Developed software solutions for clients')
    expect(result).toHaveLength(0)
  })

  it('returns unique values only (no duplicates)', () => {
    const result = detectHallucinations(
      'some work',
      'Achieved 40% improvement and then another 40% improvement'
    )
    expect(result.filter(v => v === '40%')).toHaveLength(1)
  })

  it('does not flag single-digit standalone numbers', () => {
    const result = detectHallucinations(
      'led team',
      'Led a team of 5 engineers'
    )
    expect(result).not.toContain('5')
  })
})
