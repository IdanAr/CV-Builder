'use client'

import { useState } from 'react'
import { ProfileWizardSteps } from './ProfileWizardSteps'
import {
  WORK_MODES,
  SENIORITY_LEVELS,
  DEFAULT_RECENCY_DAYS,
  DEFAULT_MIN_ATS_SCORE,
  type WorkMode,
  type Seniority,
  type JobLocation,
} from '@/lib/schemas/jobsearch.zod'

const STEP_LABELS = ['Roles', 'Location', 'Focus', 'Threshold', 'Review']

interface ProfileWizardProps {
  onCreated: (profile: { _id: string; name: string }) => void
}

// roles/categories/industries are deliberately absent here — they live only
// in DraftText (below) and are parsed into arrays where needed (the review
// summary, the submit payload), never duplicated into this state.
interface WizardState {
  name: string
  seniority: Seniority[]
  workModes: WorkMode[]
  locations: JobLocation[]
  recencyDays: number
  minAtsScore: number
}

function initialState(): WizardState {
  return {
    name: '',
    seniority: [],
    workModes: [],
    locations: [],
    recencyDays: DEFAULT_RECENCY_DAYS,
    minAtsScore: DEFAULT_MIN_ATS_SCORE,
  }
}

function toTags(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function formatList(tags: string[]): string {
  return tags.length > 0 ? tags.join(', ') : '—'
}

// Turns the API's Zod-issue array (VALIDATION_ERROR's `details`) into a
// readable suffix for the error banner, so a rejected submission is
// self-diagnosing instead of a dead-end "try again" message.
function formatValidationDetails(details: unknown): string {
  if (!Array.isArray(details) || details.length === 0) {
    return ' Please try again.'
  }
  const messages = details
    .map((issue) => {
      if (!issue || typeof issue !== 'object' || !('message' in issue)) return null
      const path = Array.isArray((issue as { path?: unknown[] }).path) ? (issue as { path: unknown[] }).path : []
      const message = String((issue as { message: unknown }).message)
      return path.length > 0 ? `${path.join('.')}: ${message}` : message
    })
    .filter((m): m is string => m !== null)
  return messages.length > 0 ? ` ${messages.join('; ')}` : ' Please try again.'
}

// Draft text for the three free-form tag fields (roles/categories/industries).
// Bound to their own state rather than derived from the parsed array on every
// keystroke — deriving the input's value from state.roles.join(', ') and
// re-parsing on every change stripped spaces and trailing commas the instant
// they were typed, since the display value snapped back to the trimmed,
// re-joined array before the user could keep typing. These fields hold raw
// text and are the single source of truth for their fields: the review
// summary and the submit payload both parse fresh from here via toTags(),
// rather than from a separately-committed array in WizardState.
interface DraftText {
  roles: string
  categories: string
  industries: string
}

function initialDraftText(): DraftText {
  return { roles: '', categories: '', industries: '' }
}

export function ProfileWizard({ onCreated }: ProfileWizardProps) {
  const [step, setStep] = useState(1)
  const [maxUnlocked, setMaxUnlocked] = useState(1)
  const [state, setState] = useState<WizardState>(initialState)
  const [draftText, setDraftText] = useState<DraftText>(initialDraftText)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function goNext() {
    const next = Math.min(step + 1, STEP_LABELS.length)
    setStep(next)
    setMaxUnlocked((m) => Math.max(m, next))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1))
  }

  function toggleWorkMode(mode: WorkMode) {
    setState((s) => ({
      ...s,
      workModes: s.workModes.includes(mode)
        ? s.workModes.filter((m) => m !== mode)
        : [...s.workModes, mode],
    }))
  }

  function toggleSeniority(level: Seniority) {
    setState((s) => ({
      ...s,
      seniority: s.seniority.includes(level)
        ? s.seniority.filter((l) => l !== level)
        : [...s.seniority, level],
    }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    // roles/categories/industries are parsed from draftText here rather than
    // read from state — draftText is the single source of truth for these
    // fields (see DraftText's doc comment above).
    const payload = {
      ...state,
      roles: toTags(draftText.roles),
      categories: toTags(draftText.categories),
      industries: toTags(draftText.industries),
    }
    try {
      const res = await fetch('/api/jobsearch/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (res.ok) {
        onCreated(body.profile)
      } else {
        setError(`Failed to create profile.${formatValidationDetails(body.details)}`)
      }
    } catch {
      setError('An error occurred. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ProfileWizardSteps current={step} maxUnlocked={maxUnlocked} labels={STEP_LABELS} onStepClick={setStep} />
      {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Target roles (comma-separated)
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={draftText.roles}
              onChange={(e) => setDraftText((d) => ({ ...d, roles: e.target.value }))}
            />
          </label>
          <div>
            <div className="text-sm font-medium">Seniority</div>
            <div className="mt-1 flex flex-wrap gap-3">
              {SENIORITY_LEVELS.map((level) => (
                <label key={level} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={state.seniority.includes(level)}
                    onChange={() => toggleSeniority(level)}
                  />
                  {level}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            {WORK_MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={state.workModes.includes(mode)} onChange={() => toggleWorkMode(mode)} />
                {mode}
              </label>
            ))}
          </div>
          <label className="text-sm font-medium">
            City
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={state.locations[0]?.city ?? ''}
              onChange={(e) =>
                setState((s) => ({ ...s, locations: [{ city: e.target.value }] }))
              }
            />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Categories (comma-separated)
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={draftText.categories}
              onChange={(e) => setDraftText((d) => ({ ...d, categories: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium">
            Industries (comma-separated — soft-matched against results, not queried directly)
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={draftText.industries}
              onChange={(e) => setDraftText((d) => ({ ...d, industries: e.target.value }))}
            />
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Only show postings from the last N days
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={state.recencyDays}
              onChange={(e) =>
                // Clamped to >=1 (the schema's floor) at the source, rather than
                // letting a cleared/zeroed field reach the server as an invalid
                // 400 the user has no way to interpret.
                setState((s) => ({ ...s, recencyDays: Math.max(1, Number(e.target.value) || 0) }))
              }
            />
          </label>
          <label className="text-sm font-medium">
            Minimum ATS fit score to auto-draft an application
            <input
              type="number"
              min={0}
              max={100}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={state.minAtsScore}
              onChange={(e) => setState((s) => ({ ...s, minAtsScore: Number(e.target.value) }))}
            />
          </label>
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded border bg-gray-50 px-3 py-2 text-sm">
            <dt className="font-medium text-gray-600">Roles</dt>
            <dd>{formatList(toTags(draftText.roles))}</dd>
            <dt className="font-medium text-gray-600">Seniority</dt>
            <dd>{formatList(state.seniority)}</dd>
            <dt className="font-medium text-gray-600">Work modes</dt>
            <dd>{formatList(state.workModes)}</dd>
            <dt className="font-medium text-gray-600">City</dt>
            <dd>{state.locations[0]?.city || '—'}</dd>
            <dt className="font-medium text-gray-600">Categories</dt>
            <dd>{formatList(toTags(draftText.categories))}</dd>
            <dt className="font-medium text-gray-600">Industries</dt>
            <dd>{formatList(toTags(draftText.industries))}</dd>
            <dt className="font-medium text-gray-600">Recency window</dt>
            <dd>{state.recencyDays} days</dd>
            <dt className="font-medium text-gray-600">ATS threshold</dt>
            <dd>{state.minAtsScore}%</dd>
          </dl>
          <label className="text-sm font-medium">
            Profile name
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={state.name}
              onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            />
          </label>
        </div>
      )}

      <div className="flex justify-between gap-2">
        {step > 1 ? (
          <button type="button" className="rounded border px-4 py-2 text-sm" onClick={goBack}>
            Back
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {step < STEP_LABELS.length && (
            <button type="button" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white" onClick={goNext}>
              Next
            </button>
          )}
          {step === STEP_LABELS.length && (
            <button
              type="button"
              disabled={state.name.trim().length === 0 || submitting}
              className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-40"
              onClick={handleSubmit}
            >
              Create profile
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
