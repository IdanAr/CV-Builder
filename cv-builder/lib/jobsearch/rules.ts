// Rule condition evaluator for job-search matching (design spec §4).
// Pure and synchronous — scan.ts fetches the profile's rules once per scan
// and calls evaluateRules() per posting.
import type { RuleCondition, RuleAction, WorkMode } from '@/lib/schemas/jobsearch.zod'

export interface RuleEvaluationInput {
  title: string
  company: string
  workMode?: WorkMode
  postedAt?: Date
  atsScore?: number
}

// The minimal shape evaluateRules needs from a stored rule — deliberately
// narrower than the full JobSearchRuleSchema/Mongoose document so callers
// (e.g. scan.ts, working from a .lean() document) don't need to satisfy
// every model field just to evaluate matching.
export interface EvaluatableRule {
  name: string
  isActive: boolean
  conditions: RuleCondition[]
  action: RuleAction
}

export interface RuleEvaluationResult {
  // true when a matched rule's action is 'ignore' — the posting must not be
  // persisted at all (design spec §4 step 2, "full stop"). matchedRules and
  // resolvedActions are both empty in this case since the caller never gets
  // far enough to record them anywhere.
  suppressed: boolean
  matchedRules: string[]
  resolvedActions: Exclude<RuleAction, 'ignore'>[]
}

function conditionMatches(condition: RuleCondition, input: RuleEvaluationInput): boolean {
  switch (condition.field) {
    case 'atsScore':
      if (input.atsScore === undefined) return false
      return condition.op === 'gte' ? input.atsScore >= condition.value : input.atsScore <= condition.value
    case 'company': {
      const companies = condition.value.map((c) => c.trim().toLowerCase())
      const isMember = companies.includes(input.company.trim().toLowerCase())
      return condition.op === 'in' ? isMember : !isMember
    }
    case 'workMode':
      return input.workMode !== undefined && condition.value.includes(input.workMode)
    case 'postedWithinDays':
      if (input.postedAt === undefined) return false
      return Date.now() - input.postedAt.getTime() <= condition.value * 86_400_000
    case 'title': {
      // Deliberately a plain case-insensitive substring match, not the
      // word-boundary matchesKeyword() used elsewhere for ATS scoring — a
      // rule author typing "senior" as a title filter expects it to match
      // "Senior Engineer II" the same way a text search would.
      const contains = input.title.toLowerCase().includes(condition.value.toLowerCase())
      return condition.op === 'contains' ? contains : !contains
    }
  }
}

function ruleMatches(rule: EvaluatableRule, input: RuleEvaluationInput): boolean {
  return rule.conditions.every((condition) => conditionMatches(condition, input))
}

export function evaluateRules(input: RuleEvaluationInput, rules: EvaluatableRule[]): RuleEvaluationResult {
  const matched = rules.filter((rule) => rule.isActive && ruleMatches(rule, input))

  // Ignore-veto: if any matched rule says 'ignore', the posting is
  // suppressed outright regardless of what else matched (design spec §4).
  if (matched.some((rule) => rule.action === 'ignore')) {
    return { suppressed: true, matchedRules: [], resolvedActions: [] }
  }

  const matchedRules = matched.map((rule) => rule.name)
  const resolvedActions = [...new Set(matched.map((rule) => rule.action))] as Exclude<RuleAction, 'ignore'>[]

  return { suppressed: false, matchedRules, resolvedActions }
}
