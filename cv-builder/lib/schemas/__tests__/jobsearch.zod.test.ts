import { describe, it, expect } from 'vitest'
import {
  JobSearchProfileSchema,
  PatchJobSearchProfileSchema,
  DEFAULT_RECENCY_DAYS,
  DEFAULT_MIN_ATS_SCORE,
  SENIORITY_LEVELS,
  ScrapedJobSchema,
  JobSearchRuleSchema,
  PatchJobSearchRuleSchema,
  RuleConditionSchema,
  RULE_ACTIONS,
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

describe('RuleConditionSchema', () => {
  it('accepts an atsScore condition', () => {
    const result = RuleConditionSchema.safeParse({ field: 'atsScore', op: 'gte', value: 75 })
    expect(result.success).toBe(true)
  })

  it('accepts a company condition', () => {
    const result = RuleConditionSchema.safeParse({ field: 'company', op: 'in', value: ['Acme'] })
    expect(result.success).toBe(true)
  })

  it('accepts a workMode condition', () => {
    const result = RuleConditionSchema.safeParse({ field: 'workMode', op: 'in', value: ['remote'] })
    expect(result.success).toBe(true)
  })

  it('accepts a postedWithinDays condition', () => {
    const result = RuleConditionSchema.safeParse({ field: 'postedWithinDays', op: 'lte', value: 14 })
    expect(result.success).toBe(true)
  })

  it('accepts a title condition', () => {
    const result = RuleConditionSchema.safeParse({ field: 'title', op: 'contains', value: 'senior' })
    expect(result.success).toBe(true)
  })

  it('rejects an op that does not belong to its field (e.g. postedWithinDays with gte)', () => {
    const result = RuleConditionSchema.safeParse({ field: 'postedWithinDays', op: 'gte', value: 14 })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown field', () => {
    const result = RuleConditionSchema.safeParse({ field: 'salary', op: 'gte', value: 100 })
    expect(result.success).toBe(false)
  })

  it('rejects an empty company value array', () => {
    const result = RuleConditionSchema.safeParse({ field: 'company', op: 'in', value: [] })
    expect(result.success).toBe(false)
  })
})

describe('JobSearchRuleSchema', () => {
  it('defaults isActive, order, and profileId', () => {
    const result = JobSearchRuleSchema.parse({
      name: 'High fit',
      conditions: [{ field: 'atsScore', op: 'gte', value: 75 }],
      action: 'notify',
    })
    expect(result.isActive).toBe(true)
    expect(result.order).toBe(0)
    expect(result.profileId).toBeNull()
  })

  it('accepts an explicit profileId', () => {
    const result = JobSearchRuleSchema.safeParse({
      profileId: 'p1',
      name: 'High fit',
      conditions: [{ field: 'atsScore', op: 'gte', value: 75 }],
      action: 'notify',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = JobSearchRuleSchema.safeParse({
      name: '',
      conditions: [{ field: 'atsScore', op: 'gte', value: 75 }],
      action: 'notify',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty conditions array', () => {
    const result = JobSearchRuleSchema.safeParse({ name: 'Test', conditions: [], action: 'notify' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid action', () => {
    const result = JobSearchRuleSchema.safeParse({
      name: 'Test',
      conditions: [{ field: 'atsScore', op: 'gte', value: 75 }],
      action: 'auto_submit',
    })
    expect(result.success).toBe(false)
  })

  it('accepts every documented action', () => {
    for (const action of RULE_ACTIONS) {
      const result = JobSearchRuleSchema.safeParse({
        name: 'Test',
        conditions: [{ field: 'atsScore', op: 'gte', value: 75 }],
        action,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts multiple AND-combined conditions', () => {
    const result = JobSearchRuleSchema.safeParse({
      name: 'Strict',
      conditions: [
        { field: 'atsScore', op: 'gte', value: 75 },
        { field: 'title', op: 'contains', value: 'senior' },
      ],
      action: 'notify',
    })
    expect(result.success).toBe(true)
  })
})

describe('PatchJobSearchRuleSchema', () => {
  it('does not backfill defaults for absent fields', () => {
    const result = PatchJobSearchRuleSchema.parse({ isActive: false })
    expect(Object.keys(result)).toEqual(['isActive'])
  })

  it('accepts an empty patch', () => {
    const result = PatchJobSearchRuleSchema.parse({})
    expect(result).toEqual({})
  })

  it('accepts patching profileId to null (making a rule global)', () => {
    const result = PatchJobSearchRuleSchema.safeParse({ profileId: null })
    expect(result.success).toBe(true)
  })

  it('rejects an empty conditions array when provided', () => {
    const result = PatchJobSearchRuleSchema.safeParse({ conditions: [] })
    expect(result.success).toBe(false)
  })
})
