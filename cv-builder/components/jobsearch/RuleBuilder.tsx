'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  WORK_MODES,
  RULE_ACTIONS,
  type WorkMode,
  type RuleAction,
  type RuleCondition,
} from '@/lib/schemas/jobsearch.zod'

type RuleField = RuleCondition['field']
const RULE_FIELDS: RuleField[] = ['atsScore', 'company', 'workMode', 'postedWithinDays', 'title']

const FIELD_LABELS: Record<RuleField, string> = {
  atsScore: 'ATS fit score',
  company: 'Company',
  workMode: 'Work mode',
  postedWithinDays: 'Posted within (days)',
  title: 'Title',
}

const ACTION_LABELS: Record<RuleAction, string> = {
  notify: 'Notify me',
  draft_and_queue: 'Draft & queue',
  ignore: 'Ignore',
}

interface RuleSummary {
  _id: string
  name: string
  isActive: boolean
  action: RuleAction
  conditions: RuleCondition[]
}

interface RuleBuilderProps {
  profileId: string
}

// Draft state for the single-condition builder below. `companyText` is a
// comma-separated free-text field bound to its own raw string, not derived
// from a parsed-then-rejoined array — the same anti-pattern that stripped
// spaces/commas mid-typing in ProfileWizard's tag fields applies here too.
interface ConditionDraft {
  field: RuleField
  atsOp: 'gte' | 'lte'
  atsValue: number
  companyOp: 'in' | 'notIn'
  companyText: string
  workModeValues: WorkMode[]
  postedWithinDaysValue: number
  titleOp: 'contains' | 'notContains'
  titleValue: string
}

function initialConditionDraft(): ConditionDraft {
  return {
    field: 'atsScore',
    atsOp: 'gte',
    atsValue: 75,
    companyOp: 'in',
    companyText: '',
    workModeValues: [],
    postedWithinDaysValue: 7,
    titleOp: 'contains',
    titleValue: '',
  }
}

function toTags(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function buildCondition(draft: ConditionDraft): RuleCondition | null {
  switch (draft.field) {
    case 'atsScore':
      return { field: 'atsScore', op: draft.atsOp, value: draft.atsValue }
    case 'company': {
      const companies = toTags(draft.companyText)
      return companies.length > 0 ? { field: 'company', op: draft.companyOp, value: companies } : null
    }
    case 'workMode':
      return draft.workModeValues.length > 0 ? { field: 'workMode', op: 'in', value: draft.workModeValues } : null
    case 'postedWithinDays':
      return { field: 'postedWithinDays', op: 'lte', value: draft.postedWithinDaysValue }
    case 'title':
      return draft.titleValue.trim().length > 0
        ? { field: 'title', op: draft.titleOp, value: draft.titleValue.trim() }
        : null
  }
}

function describeCondition(condition: RuleCondition): string {
  switch (condition.field) {
    case 'atsScore':
      return `ATS score ${condition.op === 'gte' ? '≥' : '≤'} ${condition.value}`
    case 'company':
      return `Company ${condition.op === 'in' ? 'is one of' : 'is not'} ${condition.value.join(', ')}`
    case 'workMode':
      return `Work mode is one of ${condition.value.join(', ')}`
    case 'postedWithinDays':
      return `Posted within ${condition.value} days`
    case 'title':
      return `Title ${condition.op === 'contains' ? 'contains' : 'does not contain'} "${condition.value}"`
  }
}

export function RuleBuilder({ profileId }: RuleBuilderProps) {
  const [rules, setRules] = useState<RuleSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [action, setAction] = useState<RuleAction>('notify')
  const [draft, setDraft] = useState<ConditionDraft>(initialConditionDraft)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/jobsearch/rules?profileId=${encodeURIComponent(profileId)}`)
      if (!res.ok) {
        setError('Failed to load rules.')
        return
      }
      const body = await res.json()
      setRules(body.rules)
    } catch {
      setError('Failed to load rules.')
    }
  }, [profileId])

  useEffect(() => {
    // Initial fetch-on-mount, same pattern/suppression as ScrapedJobsList.tsx's load effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function toggleActive(rule: RuleSummary) {
    setError(null)
    try {
      const res = await fetch(`/api/jobsearch/rules/${rule._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      })
      if (res.ok) {
        await load()
      } else {
        setError('Failed to update rule. Please try again.')
      }
    } catch {
      setError('An error occurred. Please check your connection and try again.')
    }
  }

  async function deleteRule(rule: RuleSummary) {
    setError(null)
    try {
      const res = await fetch(`/api/jobsearch/rules/${rule._id}`, { method: 'DELETE' })
      if (res.ok) {
        await load()
      } else {
        setError('Failed to delete rule. Please try again.')
      }
    } catch {
      setError('An error occurred. Please check your connection and try again.')
    }
  }

  async function handleCreate() {
    const condition = buildCondition(draft)
    if (!condition || name.trim().length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/jobsearch/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          name: name.trim(),
          isActive: true,
          order: rules?.length ?? 0,
          conditions: [condition],
          action,
        }),
      })
      if (res.ok) {
        setShowForm(false)
        setName('')
        setDraft(initialConditionDraft())
        setAction('notify')
        await load()
      } else {
        setError('Failed to create rule. Please try again.')
      }
    } catch {
      setError('An error occurred. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Only fully replace the view with an error screen when the very first
  // load failed and there's nothing to show yet — mirrors ProfileList.tsx
  // and ScrapedJobsList.tsx's convention.
  if (error && rules === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        <button type="button" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => load()}>
          Try again
        </button>
      </div>
    )
  }

  if (rules === null) return null

  const condition = buildCondition(draft)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Notification rules</h2>
        {!showForm && (
          <button type="button" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => setShowForm(true)}>
            Add rule
          </button>
        )}
      </div>
      {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {rules.length === 0 && !showForm && (
        <p className="text-sm text-gray-500">No rules yet - postings will be stored but won&apos;t trigger notifications.</p>
      )}

      {rules.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => (
            <li key={rule._id} className="flex items-center justify-between rounded border px-4 py-2">
              <div>
                <div className="font-medium">{rule.name}</div>
                <div className="text-xs text-gray-500">
                  {ACTION_LABELS[rule.action]} - {rule.conditions.map(describeCondition).join('; ')}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" aria-label={`${rule.name} active`} checked={rule.isActive} onChange={() => toggleActive(rule)} />
                  Active
                </label>
                <button type="button" className="text-sm text-red-600" onClick={() => deleteRule(rule)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div className="flex flex-col gap-3 rounded border px-3 py-3">
          <label className="text-sm font-medium">
            Rule name
            <input className="mt-1 w-full rounded border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="text-sm font-medium">
            When a posting matches
            <select
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={draft.field}
              onChange={(e) => setDraft((d) => ({ ...d, field: e.target.value as RuleField }))}
            >
              {RULE_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {FIELD_LABELS[field]}
                </option>
              ))}
            </select>
          </label>

          {draft.field === 'atsScore' && (
            <div className="flex gap-2">
              <select
                aria-label="ATS score comparison"
                className="rounded border px-3 py-2 text-sm"
                value={draft.atsOp}
                onChange={(e) => setDraft((d) => ({ ...d, atsOp: e.target.value as 'gte' | 'lte' }))}
              >
                <option value="gte">≥</option>
                <option value="lte">≤</option>
              </select>
              <input
                aria-label="ATS score value"
                type="number"
                min={0}
                max={100}
                className="w-24 rounded border px-3 py-2 text-sm"
                value={draft.atsValue}
                onChange={(e) => setDraft((d) => ({ ...d, atsValue: Number(e.target.value) }))}
              />
            </div>
          )}

          {draft.field === 'company' && (
            <div className="flex gap-2">
              <select
                aria-label="Company comparison"
                className="rounded border px-3 py-2 text-sm"
                value={draft.companyOp}
                onChange={(e) => setDraft((d) => ({ ...d, companyOp: e.target.value as 'in' | 'notIn' }))}
              >
                <option value="in">is one of</option>
                <option value="notIn">is not</option>
              </select>
              <input
                aria-label="Company names"
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="Comma-separated company names"
                value={draft.companyText}
                onChange={(e) => setDraft((d) => ({ ...d, companyText: e.target.value }))}
              />
            </div>
          )}

          {draft.field === 'workMode' && (
            <div className="flex gap-3">
              {WORK_MODES.map((mode) => (
                <label key={mode} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.workModeValues.includes(mode)}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        workModeValues: d.workModeValues.includes(mode)
                          ? d.workModeValues.filter((m) => m !== mode)
                          : [...d.workModeValues, mode],
                      }))
                    }
                  />
                  {mode}
                </label>
              ))}
            </div>
          )}

          {draft.field === 'postedWithinDays' && (
            <input
              aria-label="Posted within days"
              type="number"
              min={1}
              className="w-24 rounded border px-3 py-2 text-sm"
              value={draft.postedWithinDaysValue}
              onChange={(e) => setDraft((d) => ({ ...d, postedWithinDaysValue: Math.max(1, Number(e.target.value) || 0) }))}
            />
          )}

          {draft.field === 'title' && (
            <div className="flex gap-2">
              <select
                aria-label="Title comparison"
                className="rounded border px-3 py-2 text-sm"
                value={draft.titleOp}
                onChange={(e) => setDraft((d) => ({ ...d, titleOp: e.target.value as 'contains' | 'notContains' }))}
              >
                <option value="contains">contains</option>
                <option value="notContains">does not contain</option>
              </select>
              <input
                aria-label="Title text"
                className="flex-1 rounded border px-3 py-2 text-sm"
                value={draft.titleValue}
                onChange={(e) => setDraft((d) => ({ ...d, titleValue: e.target.value }))}
              />
            </div>
          )}

          <label className="text-sm font-medium">
            Then
            <select
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={action}
              onChange={(e) => setAction(e.target.value as RuleAction)}
            >
              {RULE_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABELS[a]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!condition || name.trim().length === 0 || submitting}
              className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-40"
              onClick={handleCreate}
            >
              Save rule
            </button>
            <button type="button" className="rounded border px-4 py-2 text-sm" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
