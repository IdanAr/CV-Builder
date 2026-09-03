'use client'

import { useEffect, useRef, useState } from 'react'
import { ProfileWizardSteps } from './ProfileWizardSteps'
import { COUNTRIES } from '@/lib/jobsearch/countries'
import {
  WORK_MODES,
  SENIORITY_LEVELS,
  DEFAULT_RECENCY_DAYS,
  DEFAULT_MIN_ATS_SCORE,
  type WorkMode,
  type Seniority,
  type JobLocation,
  type ComeetCompanyWatch,
} from '@/lib/schemas/jobsearch.zod'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

const STEP_LABELS = ['Roles', 'Location', 'Focus', 'Sources', 'Threshold', 'Review']

interface ExistingProfile {
  _id: string
  name: string
  resumeId?: string
  roles: string[]
  workModes: WorkMode[]
  locations: JobLocation[]
  seniority: Seniority[]
  categories: string[]
  industries: string[]
  // Optional: a profile saved before this field existed comes back from a .lean()
  // read without it at all (Mongoose doesn't backfill schema defaults onto
  // pre-existing documents).
  comeetCompanies?: ComeetCompanyWatch[]
  recencyDays: number
  minAtsScore: number
}

interface ProfileWizardProps {
  // Create mode: pass onCreated. Edit mode: pass existingProfile + onUpdated
  // — the wizard pre-fills from it, PATCHes instead of POSTs, and skips the
  // post-creation "offer a default rule" screen (that only makes sense the
  // first time a profile is set up).
  onCreated?: (profile: { _id: string; name: string }) => void
  onUpdated?: (profile: { _id: string; name: string }) => void
  existingProfile?: ExistingProfile
  // Renders a Cancel control on every step. Without one, a user who opens the
  // wizard and changes their mind can only leave by navigating away (losing
  // everything) or clicking through all six steps to a submit they don't want.
  onCancel?: () => void
}

const DRAFT_STORAGE_KEY = 'cv-builder:jobsearch-profile-wizard-draft'

interface WizardDraft {
  step: number
  maxUnlocked: number
  state: WizardState
  draftText: DraftText
}

/**
 * The six-step wizard previously held every answer — roles, seniority, work
 * mode, locations, categories, industries, watched companies, thresholds — in
 * component state alone, so a refresh, an accidental back gesture or a closed
 * tab discarded the whole flow with no warning.
 *
 * Only create mode is persisted: editing an existing profile already has a
 * server-side source of truth, and writing that into a shared draft key would
 * leak one profile's values into the next new one.
 */
function readDraft(): WizardDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Partial<WizardDraft>
    // A draft written by an older build may not match the current shape; treat
    // anything unrecognisable as absent rather than crashing the wizard.
    if (!candidate.state || !candidate.draftText) return null
    const step = Math.min(Math.max(Number(candidate.step) || 1, 1), STEP_LABELS.length)
    return {
      step,
      maxUnlocked: Math.min(Math.max(Number(candidate.maxUnlocked) || step, step), STEP_LABELS.length),
      state: candidate.state as WizardState,
      draftText: candidate.draftText as DraftText,
    }
  } catch {
    // Private-mode denials, quota errors and malformed JSON all mean "no draft".
    return null
  }
}

function writeDraft(draft: WizardDraft): void {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Persisting is a convenience; a storage failure must never block the flow.
  }
}

export function clearProfileWizardDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // Nothing to recover from — the draft is already unreachable.
  }
}

interface ResumeOption {
  id: string
  title: string
}

// roles/categories/industries are deliberately absent here — they live only
// in DraftText (below) and are parsed into arrays where needed (the review
// summary, the submit payload), never duplicated into this state.
interface WizardState {
  name: string
  resumeId?: string
  seniority: Seniority[]
  workModes: WorkMode[]
  locations: JobLocation[]
  comeetCompanies: ComeetCompanyWatch[]
  recencyDays: number
  minAtsScore: number
}

function initialState(existingProfile?: ExistingProfile): WizardState {
  if (existingProfile) {
    return {
      name: existingProfile.name,
      resumeId: existingProfile.resumeId,
      seniority: existingProfile.seniority,
      workModes: existingProfile.workModes,
      locations: existingProfile.locations,
      // A profile saved before this field existed comes back from a .lean() read
      // without comeetCompanies at all (Mongoose doesn't backfill schema defaults
      // onto pre-existing documents) — fall back to an empty list.
      comeetCompanies: existingProfile.comeetCompanies ?? [],
      recencyDays: existingProfile.recencyDays,
      minAtsScore: existingProfile.minAtsScore,
    }
  }
  return {
    name: '',
    seniority: [],
    workModes: [],
    locations: [],
    comeetCompanies: [],
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
  return tags.length > 0 ? tags.join(', ') : '-'
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

function initialDraftText(existingProfile?: ExistingProfile): DraftText {
  return {
    roles: existingProfile?.roles.join(', ') ?? '',
    categories: existingProfile?.categories.join(', ') ?? '',
    industries: existingProfile?.industries.join(', ') ?? '',
  }
}

export function ProfileWizard({ onCreated, onUpdated, existingProfile, onCancel }: ProfileWizardProps) {
  const isEditing = !!existingProfile
  const [step, setStep] = useState(1)
  const [maxUnlocked, setMaxUnlocked] = useState(1)
  const [state, setState] = useState<WizardState>(() => initialState(existingProfile))
  const [draftText, setDraftText] = useState<DraftText>(() => initialDraftText(existingProfile))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdProfile, setCreatedProfile] = useState<{ _id: string; name: string } | null>(null)
  const [creatingRule, setCreatingRule] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [resumeOptions, setResumeOptions] = useState<ResumeOption[]>([])
  const [comeetUrlInput, setComeetUrlInput] = useState('')
  const [comeetResolving, setComeetResolving] = useState(false)
  const [comeetResolveError, setComeetResolveError] = useState<string | null>(null)
  // Gates the save effect below so it can't overwrite a stored draft with the
  // component's blank initial state before that draft has been read back.
  const [draftHydrated, setDraftHydrated] = useState(false)

  useEffect(() => {
    if (isEditing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftHydrated(true)
      return
    }
    const saved = readDraft()
    if (saved) {
      setState(saved.state)
      setDraftText(saved.draftText)
      setStep(saved.step)
      setMaxUnlocked(saved.maxUnlocked)
    }
    setDraftHydrated(true)
  }, [isEditing])

  useEffect(() => {
    // Stop persisting once the profile exists — the wizard has moved on to its
    // post-creation screen and the draft has already been cleared.
    if (!draftHydrated || isEditing || createdProfile) return
    writeDraft({ step, maxUnlocked, state, draftText })
  }, [draftHydrated, isEditing, createdProfile, step, maxUnlocked, state, draftText])

  useEffect(() => {
    let cancelled = false
    async function loadResumes() {
      try {
        const res = await fetch('/api/resumes')
        if (!res.ok) throw new Error('failed to load resumes')
        const body = await res.json()
        const options = Array.isArray(body.resumes)
          ? body.resumes.map((r: { _id: string; title: string }) => ({ id: r._id, title: r.title }))
          : []
        if (!cancelled) setResumeOptions(options)
      } catch {
        // Not fatal — the resume picker just shows no options, and scanning
        // falls back to the user's most recently updated resume server-side.
        if (!cancelled) setResumeOptions([])
      }
    }
    loadResumes()
    return () => {
      cancelled = true
    }
  }, [])

  const panelRef = useRef<HTMLDivElement>(null)
  // Move focus into the new step's panel on Back/Next/tab-click, mirroring
  // the ARIA Tabs authoring pattern's focus-management requirement —
  // without this, a screen-reader user's focus stays on the button they
  // just pressed while the panel content silently swaps behind them.
  // Compares against the previous step (not a one-shot "first render" flag)
  // so it stays correct under React Strict Mode's dev-mode double-invoke of
  // effects on mount — a one-shot flag flips on the first invocation and
  // then fires on the second, stealing focus on load; this comparison
  // produces the same no-op result both times since prevStep.current still
  // equals step on the second invocation too.
  const prevStep = useRef(step)
  useEffect(() => {
    if (prevStep.current !== step) {
      panelRef.current?.focus()
    }
    prevStep.current = step
  }, [step])

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

  // Resolves the pasted careers-page URL server-side (POST /api/jobsearch/comeet/resolve)
  // into a full {name, uid, token} entry — the user never sees or types the UID/token
  // themselves, unlike the earlier three-field form this replaced.
  async function handleResolveComeetUrl() {
    const url = comeetUrlInput.trim()
    if (!url) return
    if (state.comeetCompanies.some((c) => c.uid && url.includes(c.uid))) {
      setComeetResolveError('That company is already in the list.')
      return
    }
    setComeetResolving(true)
    setComeetResolveError(null)
    try {
      const res = await fetch('/api/jobsearch/comeet/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const body = await res.json()
      if (!res.ok) {
        setComeetResolveError(body.error ?? 'Could not resolve that URL. Please try again.')
        return
      }
      const company = body.company as ComeetCompanyWatch
      setState((s) => ({ ...s, comeetCompanies: [...s.comeetCompanies, company] }))
      setComeetUrlInput('')
    } catch {
      setComeetResolveError('Could not resolve that URL. Please try again.')
    } finally {
      setComeetResolving(false)
    }
  }

  function removeComeetCompany(index: number) {
    setState((s) => ({ ...s, comeetCompanies: s.comeetCompanies.filter((_, i) => i !== index) }))
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
      const res = await fetch(
        isEditing ? `/api/jobsearch/profiles/${existingProfile._id}` : '/api/jobsearch/profiles',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const body = await res.json()
      if (res.ok) {
        if (isEditing) {
          onUpdated?.(body.profile)
        } else {
          // The answers are now persisted server-side, so the local draft has
          // done its job; leaving it would prefill the *next* new profile.
          clearProfileWizardDraft()
          setCreatedProfile(body.profile)
        }
      } else {
        setError(`Failed to ${isEditing ? 'save changes' : 'create profile'}.${formatValidationDetails(body.details)}`)
      }
    } catch {
      setError('An error occurred. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateDefaultRule() {
    if (!createdProfile) return
    setCreatingRule(true)
    setRuleError(null)
    try {
      const res = await fetch('/api/jobsearch/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: createdProfile._id,
          name: 'Notify on match',
          isActive: true,
          order: 0,
          conditions: [{ field: 'atsScore', op: 'gte', value: state.minAtsScore }],
          action: 'notify',
        }),
      })
      if (res.ok) {
        onCreated?.(createdProfile)
        return
      }
      // fetch() only throws on a network failure — a 400/404/500 resolves
      // normally, so res.ok must be checked explicitly or a failed rule
      // creation looks identical to a successful one. The profile itself
      // was already created successfully, so this is best-effort: surface
      // the failure but let the user leave via "Skip" rather than stranding
      // them here or silently proceeding as if the rule was created.
      setRuleError("Couldn't create the notify rule. You can add one later from the profile page.")
    } catch {
      setRuleError("Couldn't create the notify rule. You can add one later from the profile page.")
    } finally {
      setCreatingRule(false)
    }
  }

  if (createdProfile) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded border bg-gray-50 px-4 py-3 text-sm">
          <p className="font-medium">Profile created!</p>
          <p className="mt-1 text-gray-600">
            Want us to notify you whenever a match scores ≥ {state.minAtsScore}% against this profile?
          </p>
        </div>
        {ruleError && <ErrorBanner>{ruleError}</ErrorBanner>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={creatingRule}
            className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-40"
            onClick={handleCreateDefaultRule}
          >
            Yes, notify me
          </button>
          <button type="button" className="rounded border px-4 py-2 text-sm" onClick={() => onCreated?.(createdProfile)}>
            Skip
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ProfileWizardSteps current={step} maxUnlocked={maxUnlocked} labels={STEP_LABELS} onStepClick={setStep} />
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {step === 1 && (
        <div ref={panelRef} role="tabpanel" id={`wizard-panel-${step}`} aria-labelledby={`wizard-tab-${step}`} tabIndex={-1} className="flex flex-col gap-3">
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
        <div ref={panelRef} role="tabpanel" id={`wizard-panel-${step}`} aria-labelledby={`wizard-tab-${step}`} tabIndex={-1} className="flex flex-col gap-3">
          <div className="flex gap-3">
            {WORK_MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={state.workModes.includes(mode)} onChange={() => toggleWorkMode(mode)} />
                {mode}
              </label>
            ))}
          </div>
          <label className="text-sm font-medium">
            Country
            <select
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={state.locations[0]?.country ?? ''}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  locations: [{ ...s.locations[0], country: e.target.value || undefined }],
                }))
              }
            >
              <option value="">Any country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            City
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={state.locations[0]?.city ?? ''}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  locations: [{ ...s.locations[0], city: e.target.value || undefined }],
                }))
              }
            />
          </label>
        </div>
      )}

      {step === 3 && (
        <div ref={panelRef} role="tabpanel" id={`wizard-panel-${step}`} aria-labelledby={`wizard-tab-${step}`} tabIndex={-1} className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Categories (comma-separated)
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={draftText.categories}
              onChange={(e) => setDraftText((d) => ({ ...d, categories: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium">
            Industries (comma-separated - soft-matched against results, not queried directly)
            <input
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={draftText.industries}
              onChange={(e) => setDraftText((d) => ({ ...d, industries: e.target.value }))}
            />
          </label>
        </div>
      )}

      {step === 4 && (
        <div ref={panelRef} role="tabpanel" id={`wizard-panel-${step}`} aria-labelledby={`wizard-tab-${step}`} tabIndex={-1} className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            Optional: track specific companies that use Comeet for hiring (common among
            Israeli high-tech employers). Comeet has no keyword search across companies,
            so postings are fetched per company — paste that company&apos;s own public
            Comeet careers page URL (e.g. comeet.com/jobs/company-name/uid) and we&apos;ll
            look it up for you.
          </p>
          {state.comeetCompanies.map((company, index) => (
            <div key={index} className="flex items-center justify-between gap-2 rounded border p-2">
              <span className="text-sm font-medium">{company.name}</span>
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm text-red-600"
                onClick={() => removeComeetCompany(index)}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-start gap-2">
            <label className="flex-1 text-sm font-medium">
              Company careers page URL
              <input
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                placeholder="https://www.comeet.com/jobs/company-name/uid"
                value={comeetUrlInput}
                onChange={(e) => setComeetUrlInput(e.target.value)}
                disabled={comeetResolving}
              />
            </label>
            <button
              type="button"
              className="mt-6 rounded border px-3 py-2 text-sm disabled:opacity-50"
              onClick={handleResolveComeetUrl}
              disabled={comeetResolving || !comeetUrlInput.trim()}
            >
              {comeetResolving ? 'Looking up…' : '+ Add company'}
            </button>
          </div>
          {comeetResolveError && <p role="alert" className="text-sm text-red-600">{comeetResolveError}</p>}
        </div>
      )}

      {step === 5 && (
        <div ref={panelRef} role="tabpanel" id={`wizard-panel-${step}`} aria-labelledby={`wizard-tab-${step}`} tabIndex={-1} className="flex flex-col gap-3">
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
          <label className="text-sm font-medium">
            Résumé to tailor from
            <select
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={state.resumeId ?? ''}
              onChange={(e) => setState((s) => ({ ...s, resumeId: e.target.value || undefined }))}
            >
              <option value="">Use my most recently updated résumé</option>
              {resumeOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {step === 6 && (
        <div ref={panelRef} role="tabpanel" id={`wizard-panel-${step}`} aria-labelledby={`wizard-tab-${step}`} tabIndex={-1} className="flex flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded border bg-gray-50 px-3 py-2 text-sm">
            <dt className="font-medium text-gray-600">Roles</dt>
            <dd>{formatList(toTags(draftText.roles))}</dd>
            <dt className="font-medium text-gray-600">Seniority</dt>
            <dd>{formatList(state.seniority)}</dd>
            <dt className="font-medium text-gray-600">Work modes</dt>
            <dd>{formatList(state.workModes)}</dd>
            <dt className="font-medium text-gray-600">Country</dt>
            <dd>{COUNTRIES.find((c) => c.code === state.locations[0]?.country)?.name || '-'}</dd>
            <dt className="font-medium text-gray-600">City</dt>
            <dd>{state.locations[0]?.city || '-'}</dd>
            <dt className="font-medium text-gray-600">Categories</dt>
            <dd>{formatList(toTags(draftText.categories))}</dd>
            <dt className="font-medium text-gray-600">Industries</dt>
            <dd>{formatList(toTags(draftText.industries))}</dd>
            <dt className="font-medium text-gray-600">Watched companies</dt>
            <dd>{formatList(state.comeetCompanies.map((c) => c.name).filter(Boolean))}</dd>
            <dt className="font-medium text-gray-600">Résumé</dt>
            <dd>{resumeOptions.find((r) => r.id === state.resumeId)?.title || 'Most recently updated'}</dd>
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
        <div className="flex gap-2">
          {onCancel && (
            // Leaves the saved draft in place deliberately: cancelling is a
            // "not now", and reopening the wizard resumes where you left off.
            // The draft is only discarded once the profile is actually created.
            <button type="button" className="rounded border px-4 py-2 text-sm" onClick={onCancel}>
              Cancel
            </button>
          )}
          {step > 1 && (
            <button type="button" className="rounded border px-4 py-2 text-sm" onClick={goBack}>
              Back
            </button>
          )}
        </div>
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
              {isEditing ? 'Save changes' : 'Create profile'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
