import { describe, it, expect } from 'vitest'
import {
  JobSearchProfileSchema,
  DEFAULT_RECENCY_DAYS,
  DEFAULT_MIN_ATS_SCORE,
} from '../jobsearch.zod'

describe('JobSearchProfileSchema', () => {
  it('applies defaults for optional fields', () => {
    const result = JobSearchProfileSchema.parse({ name: 'Frontend, Remote EU' })
    expect(result.recencyDays).toBe(DEFAULT_RECENCY_DAYS)
    expect(result.minAtsScore).toBe(DEFAULT_MIN_ATS_SCORE)
    expect(result.isActive).toBe(true)
    expect(result.roles).toEqual([])
    expect(result.locations).toEqual([])
  })

  it('rejects an empty name', () => {
    const result = JobSearchProfileSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects minAtsScore outside 0-100', () => {
    const result = JobSearchProfileSchema.safeParse({ name: 'Test', minAtsScore: 150 })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid work mode', () => {
    const result = JobSearchProfileSchema.safeParse({ name: 'Test', workModes: ['flexible'] })
    expect(result.success).toBe(false)
  })

  it('accepts a fully populated profile', () => {
    const result = JobSearchProfileSchema.safeParse({
      name: 'Data Science, Israel',
      resumeId: 'r1',
      roles: ['Data Scientist', 'ML Engineer'],
      workModes: ['remote', 'hybrid'],
      locations: [{ country: 'IL', city: 'Tel Aviv' }],
      seniority: ['senior'],
      categories: ['ml_ai'],
      industries: ['fintech'],
      recencyDays: 7,
      minAtsScore: 80,
      isActive: false,
    })
    expect(result.success).toBe(true)
  })
})
