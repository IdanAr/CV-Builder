import { describe, it, expect } from 'vitest'
import {
  JobSearchProfileSchema,
  PatchJobSearchProfileSchema,
  DEFAULT_RECENCY_DAYS,
  DEFAULT_MIN_ATS_SCORE,
  SENIORITY_LEVELS,
  ScrapedJobSchema,
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

  it('rejects an invalid seniority level', () => {
    const result = JobSearchProfileSchema.safeParse({ name: 'Test', seniority: ['intern'] })
    expect(result.success).toBe(false)
  })

  it('accepts every documented seniority level', () => {
    const result = JobSearchProfileSchema.safeParse({
      name: 'Test',
      seniority: [...SENIORITY_LEVELS],
    })
    expect(result.success).toBe(true)
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

describe('PatchJobSearchProfileSchema', () => {
  it('does not backfill defaults for absent fields', () => {
    const result = PatchJobSearchProfileSchema.parse({ isActive: false })
    expect(Object.keys(result)).toEqual(['isActive'])
  })

  it('rejects minAtsScore outside 0-100 when provided', () => {
    const result = PatchJobSearchProfileSchema.safeParse({ minAtsScore: 150 })
    expect(result.success).toBe(false)
  })

  it('accepts an empty patch', () => {
    const result = PatchJobSearchProfileSchema.parse({})
    expect(result).toEqual({})
  })
})

describe('ScrapedJobSchema', () => {
  it('defaults matchedRules, resolvedActions, and status', () => {
    const result = ScrapedJobSchema.parse({
      profileId: 'p1',
      source: 'freehire',
      sourceId: 'abc123',
      title: 'Backend Engineer',
      company: 'Acme',
      url: 'https://freehire.me/jobs/abc123',
      description: 'Build things.',
    })
    expect(result.matchedRules).toEqual([])
    expect(result.resolvedActions).toEqual([])
    expect(result.status).toBe('new')
  })

  it('rejects an invalid source', () => {
    const result = ScrapedJobSchema.safeParse({
      profileId: 'p1',
      source: 'linkedin',
      sourceId: 'abc123',
      title: 'Backend Engineer',
      company: 'Acme',
      url: 'https://example.com',
      description: 'Build things.',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid status', () => {
    const result = ScrapedJobSchema.safeParse({
      profileId: 'p1',
      source: 'freehire',
      sourceId: 'abc123',
      title: 'Backend Engineer',
      company: 'Acme',
      url: 'https://example.com',
      description: 'Build things.',
      status: 'archived',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a fully populated scraped job', () => {
    const result = ScrapedJobSchema.safeParse({
      profileId: 'p1',
      source: 'freehire',
      sourceId: 'abc123',
      title: 'Backend Engineer',
      company: 'Acme',
      location: 'Berlin',
      url: 'https://freehire.me/jobs/abc123',
      description: 'Build things.',
      postedAt: new Date('2026-08-01'),
      workMode: 'remote',
      atsScore: 82,
      matchedRules: ['r1'],
      resolvedActions: ['notify'],
      status: 'notified',
    })
    expect(result.success).toBe(true)
  })
})
