import { describe, it, expect } from 'vitest'
import { evaluateRules, type EvaluatableRule, type RuleEvaluationInput } from '../rules'

const baseInput: RuleEvaluationInput = {
  title: 'Senior Backend Engineer',
  company: 'Acme',
  workMode: 'remote',
  postedAt: new Date(),
  atsScore: 80,
}

function rule(overrides: Partial<EvaluatableRule>): EvaluatableRule {
  return {
    name: 'Test rule',
    isActive: true,
    conditions: [],
    action: 'notify',
    ...overrides,
  }
}

describe('evaluateRules', () => {
  it('returns no matches and takes no action when no rule matches', () => {
    const result = evaluateRules(baseInput, [rule({ conditions: [{ field: 'atsScore', op: 'gte', value: 95 }] })])
    expect(result).toEqual({ suppressed: false, matchedRules: [], resolvedActions: [] })
  })

  it('matches an atsScore gte condition', () => {
    const result = evaluateRules(baseInput, [
      rule({ name: 'High fit', conditions: [{ field: 'atsScore', op: 'gte', value: 75 }] }),
    ])
    expect(result.matchedRules).toEqual(['High fit'])
    expect(result.resolvedActions).toEqual(['notify'])
  })

  it('does not match an atsScore condition when the posting has no score', () => {
    const result = evaluateRules({ ...baseInput, atsScore: undefined }, [
      rule({ conditions: [{ field: 'atsScore', op: 'gte', value: 0 }] }),
    ])
    expect(result.matchedRules).toEqual([])
  })

  it('matches a company allowlist (in) condition case-insensitively', () => {
    const result = evaluateRules(baseInput, [
      rule({ name: 'Acme watch', conditions: [{ field: 'company', op: 'in', value: ['acme', 'globex'] }] }),
    ])
    expect(result.matchedRules).toEqual(['Acme watch'])
  })

  it('matches a company blocklist (notIn) condition', () => {
    const result = evaluateRules(baseInput, [
      rule({ name: 'Not Globex', conditions: [{ field: 'company', op: 'notIn', value: ['Globex'] }] }),
    ])
    expect(result.matchedRules).toEqual(['Not Globex'])
  })

  it('matches a workMode condition', () => {
    const result = evaluateRules(baseInput, [
      rule({ name: 'Remote only', conditions: [{ field: 'workMode', op: 'in', value: ['remote', 'hybrid'] }] }),
    ])
    expect(result.matchedRules).toEqual(['Remote only'])
  })

  it('matches a postedWithinDays condition', () => {
    const result = evaluateRules(baseInput, [
      rule({ name: 'Fresh', conditions: [{ field: 'postedWithinDays', op: 'lte', value: 7 }] }),
    ])
    expect(result.matchedRules).toEqual(['Fresh'])
  })

  it('does not match postedWithinDays when the posting has no postedAt', () => {
    const result = evaluateRules({ ...baseInput, postedAt: undefined }, [
      rule({ conditions: [{ field: 'postedWithinDays', op: 'lte', value: 30 }] }),
    ])
    expect(result.matchedRules).toEqual([])
  })

  it('matches a title contains condition case-insensitively', () => {
    const result = evaluateRules(baseInput, [
      rule({ name: 'Senior roles', conditions: [{ field: 'title', op: 'contains', value: 'senior' }] }),
    ])
    expect(result.matchedRules).toEqual(['Senior roles'])
  })

  it('matches a title notContains condition', () => {
    const result = evaluateRules(baseInput, [
      rule({ name: 'No staff roles', conditions: [{ field: 'title', op: 'notContains', value: 'staff' }] }),
    ])
    expect(result.matchedRules).toEqual(['No staff roles'])
  })

  it('AND-combines multiple conditions within one rule', () => {
    const result = evaluateRules(baseInput, [
      rule({
        name: 'Strict match',
        conditions: [
          { field: 'atsScore', op: 'gte', value: 75 },
          { field: 'title', op: 'contains', value: 'nonexistent-term' },
        ],
      }),
    ])
    expect(result.matchedRules).toEqual([])
  })

  it('ignores inactive rules', () => {
    const result = evaluateRules(baseInput, [
      rule({ isActive: false, conditions: [{ field: 'atsScore', op: 'gte', value: 0 }] }),
    ])
    expect(result.matchedRules).toEqual([])
  })

  it('unions actions from multiple matched rules', () => {
    const result = evaluateRules(baseInput, [
      rule({ name: 'Notify rule', action: 'notify', conditions: [{ field: 'atsScore', op: 'gte', value: 75 }] }),
      rule({ name: 'Draft rule', action: 'draft_and_queue', conditions: [{ field: 'workMode', op: 'in', value: ['remote'] }] }),
    ])
    expect([...result.matchedRules].sort()).toEqual(['Draft rule', 'Notify rule'])
    expect([...result.resolvedActions].sort()).toEqual(['draft_and_queue', 'notify'])
  })

  it('suppresses the posting outright when any matched rule action is ignore, regardless of other matches', () => {
    const result = evaluateRules(baseInput, [
      rule({ name: 'Notify rule', action: 'notify', conditions: [{ field: 'atsScore', op: 'gte', value: 75 }] }),
      rule({ name: 'Block Acme', action: 'ignore', conditions: [{ field: 'company', op: 'in', value: ['Acme'] }] }),
    ])
    expect(result.suppressed).toBe(true)
    expect(result.matchedRules).toEqual([])
    expect(result.resolvedActions).toEqual([])
  })

  it('deduplicates resolvedActions when two matched rules share the same action', () => {
    const result = evaluateRules(baseInput, [
      rule({ name: 'Rule A', action: 'notify', conditions: [{ field: 'atsScore', op: 'gte', value: 75 }] }),
      rule({ name: 'Rule B', action: 'notify', conditions: [{ field: 'workMode', op: 'in', value: ['remote'] }] }),
    ])
    expect(result.resolvedActions).toEqual(['notify'])
  })
})
