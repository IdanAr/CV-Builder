'use client'

import { useState } from 'react'
import { ProfileWizardSteps } from './ProfileWizardSteps'
import {
  WORK_MODES,
  DEFAULT_RECENCY_DAYS,
  DEFAULT_MIN_ATS_SCORE,
  type WorkMode,
  type JobLocation,
} from '@/lib/schemas/jobsearch.zod'

const STEP_LABELS = ['Roles', 'Location', 'Sources', 'Threshold', 'Review']

interface ProfileWizardProps {
  onCreated: (profile: { _id: string; name: string }) => void
}

interface WizardState {
  name: string
  roles: string[]
  seniority: string[]
  workModes: WorkMode[]
  locations: JobLocation[]
  categories: string[]
  industries: string[]
  recencyDays: number
  minAtsScore: number
}

function initialState(): WizardState {
  return {
    name: '',
    roles: [],
    seniority: [],
    workModes: [],
    locations: [],
    categories: [],
    industries: [],
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

export function ProfileWizard({ onCreated }: ProfileWizardProps) {
  const [step, setStep] = useState(1)
  const [maxUnlocked, setMaxUnlocked] = useState(1)
  const [state, setState] = useState<WizardState>(initialState)
  const [submitting, setSubmitting] = useState(false)

  function goNext() {
    const next = Math.min(step + 1, STEP_LABELS.length)
    setStep(next)
    setMaxUnlocked((m) => Math.max(m, next))
  }

  function toggleWorkMode(mode: WorkMode) {
    setState((s) => ({
      ...s,
      workModes: s.workModes.includes(mode)
        ? s.workModes.filter((m) => m !== mode)
        : [...s.workModes, mode],
    }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/jobsearch/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      })
      const body = await res.json()
      if (res.ok) onCreated(body.profile)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ProfileWizardSteps current={step} maxUnlocked={maxUnlocked} labels={STEP_LABELS} onStepClick={setStep} />

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Target roles (comma-separated)
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={state.roles.join(', ')}
              onChange={(e) => setState((s) => ({ ...s, roles: toTags(e.target.value) }))}
            />
          </label>
          <label className="text-sm font-medium">
            Seniority (comma-separated)
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={state.seniority.join(', ')}
              onChange={(e) => setState((s) => ({ ...s, seniority: toTags(e.target.value) }))}
            />
          </label>
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
              value={state.categories.join(', ')}
              onChange={(e) => setState((s) => ({ ...s, categories: toTags(e.target.value) }))}
            />
          </label>
          <label className="text-sm font-medium">
            Industries (comma-separated — soft-matched against results, not queried directly)
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={state.industries.join(', ')}
              onChange={(e) => setState((s) => ({ ...s, industries: toTags(e.target.value) }))}
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
              onChange={(e) => setState((s) => ({ ...s, recencyDays: Number(e.target.value) }))}
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

      <div className="flex justify-end gap-2">
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
  )
}
