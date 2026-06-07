import { describe, it, expect } from 'vitest'
import { scoreResume } from '../scorer'
import type { ResumeData } from '@/lib/schemas/resume.zod'

const fullData: ResumeData = {
  basics: {
    name: 'Jane Smith',
    label: 'Senior React Developer',
    email: 'jane@example.com',
    summary: 'Expert TypeScript and React developer with 5 years building REST APIs and Node.js microservices.',
  },
  work: [{
    name: 'Acme Corp',
    position: 'Frontend Engineer',
    startDate: '2020-01',
    highlights: [
      'Built React dashboard used by 500 users, increasing retention by 40%',
      'Reduced API response time by 60% through Node.js optimizations',
      'Led a team of 5 developers across 3 projects',
    ],
  }],
  skills: [{ name: 'TypeScript', keywords: ['React', 'Node.js', 'REST APIs'] }],
  education: [{ institution: 'MIT', area: 'Computer Science', studyType: 'BSc', startDate: '2016-09', endDate: '2020-06' }],
}

const jd = 'We are looking for a React developer with TypeScript experience building REST APIs and Node.js microservices.'

describe('scoreResume', () => {
  it('returns zero total for empty data and empty job description', () => {
    const result = scoreResume({}, '')
    expect(result.total).toBe(0)
  })

  it('format score is 0 for empty data', () => {
    const result = scoreResume({}, jd)
    expect(result.breakdown.format).toBe(0)
  })

  it('format score is 5 for name only', () => {
    const result = scoreResume({ basics: { name: 'Alice' } }, '')
    expect(result.breakdown.format).toBe(5)
  })

  it('format score is 10 for name + email', () => {
    const result = scoreResume({ basics: { name: 'Alice', email: 'alice@test.com' } }, '')
    expect(result.breakdown.format).toBe(10)
  })

  it('format score is 25 for data with all required fields and highlights', () => {
    const result = scoreResume(fullData, jd)
    expect(result.breakdown.format).toBe(25)
  })

  it('keyword density and placement are 0 when no job description provided', () => {
    const result = scoreResume(fullData, '')
    expect(result.breakdown.keywordDensity).toBe(0)
    expect(result.breakdown.keywordPlacement).toBe(0)
  })

  it('keyword density score is > 0 when resume contains JD keywords', () => {
    const result = scoreResume(fullData, jd)
    expect(result.breakdown.keywordDensity).toBeGreaterThan(0)
  })

  it('keyword placement score is > 0 when high-value sections contain JD keywords', () => {
    const result = scoreResume(fullData, jd)
    expect(result.breakdown.keywordPlacement).toBeGreaterThan(0)
  })

  it('metrics score is 0 when no highlights exist', () => {
    const result = scoreResume({ basics: { name: 'Joe' } }, jd)
    expect(result.breakdown.metrics).toBe(0)
  })

  it('metrics score is > 0 when highlights contain numbers', () => {
    const result = scoreResume(fullData, jd)
    expect(result.breakdown.metrics).toBeGreaterThan(0)
  })

  it('total equals sum of breakdown values capped at 100', () => {
    const result = scoreResume(fullData, jd)
    const sum = result.breakdown.format + result.breakdown.keywordDensity +
      result.breakdown.keywordPlacement + result.breakdown.metrics
    expect(result.total).toBe(Math.min(100, sum))
  })

  it('missing keywords listed when JD keywords absent from resume', () => {
    const result = scoreResume({ basics: { name: 'Joe' } }, 'Kubernetes Docker AWS experience required')
    expect(result.missingKeywords.length).toBeGreaterThan(0)
  })

  it('matched keywords listed when JD keywords present in resume', () => {
    const result = scoreResume(fullData, 'React TypeScript Node.js developer needed')
    expect(result.matchedKeywords).toContain('react')
  })

  it('total never exceeds 100', () => {
    const result = scoreResume(fullData, jd)
    expect(result.total).toBeLessThanOrEqual(100)
  })
})
