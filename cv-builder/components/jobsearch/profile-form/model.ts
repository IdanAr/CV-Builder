import { COUNTRIES } from '@/lib/jobsearch/countries'
import {
  DEFAULT_MIN_ATS_SCORE,
  DEFAULT_RECENCY_DAYS,
  MAX_LOCATIONS,
  type ComeetCompanyWatch,
  type JobLocation,
  type Seniority,
  type WorkMode,
} from '@/lib/schemas/jobsearch.zod'

export const STEPS = ['Role', 'Where', 'Sources', 'Review'] as const
export const RECENCY_PRESETS = [7, 14, 30, 60] as const

export interface ProfileFormValues {
  name: string
  resumeId?: string
  roles: string[]
  seniority: Seniority[]
  workModes: WorkMode[]
  locations: JobLocation[]
  comeetCompanies: ComeetCompanyWatch[]
  categories: string[]
  industries: string[]
  recencyDays: number
  minAtsScore: number
  /** UI-only: create a "Notify on match" rule together with the profile. */
  notifyOnMatch: boolean
}

export interface ExistingProfile {
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
  // read without it at all (Mongoose does not backfill schema defaults).
  comeetCompanies?: ComeetCompanyWatch[]
  recencyDays: number
  minAtsScore: number
}

export function emptyValues(): ProfileFormValues {
  return {
    name: '',
    roles: [],
    seniority: [],
    workModes: [],
    locations: [],
    comeetCompanies: [],
    categories: [],
    industries: [],
    recencyDays: DEFAULT_RECENCY_DAYS,
    minAtsScore: DEFAULT_MIN_ATS_SCORE,
    notifyOnMatch: true,
  }
}

export function valuesFromProfile(p: ExistingProfile): ProfileFormValues {
  return {
    name: p.name,
    resumeId: p.resumeId,
    roles: p.roles,
    seniority: p.seniority,
    workModes: p.workModes,
    locations: p.locations,
    comeetCompanies: p.comeetCompanies ?? [],
    categories: p.categories,
    industries: p.industries,
    recencyDays: p.recencyDays,
    minAtsScore: p.minAtsScore,
    // Editing never creates a rule; the checkbox is hidden in edit mode.
    notifyOnMatch: false,
  }
}

export function toPayload(v: ProfileFormValues) {
  const { notifyOnMatch: _notify, ...rest } = v
  void _notify
  return { ...rest, name: v.name.trim() }
}

export function validateStep(step: number, v: ProfileFormValues): string | null {
  if (step === 0 && v.name.trim().length === 0) return 'Enter a name for this profile.'
  return null
}

export function isDirty(v: ProfileFormValues, initial: ProfileFormValues): boolean {
  return JSON.stringify(v) !== JSON.stringify(initial)
}

export function fitHint(score: number): string {
  if (score >= 85) return 'Strict. Few drafts, high quality.'
  if (score >= 70) return 'Balanced. Drafts only decent matches.'
  return 'Lenient. Expect more drafts to review.'
}

export function locationLabel(l: JobLocation): string {
  const countryName = l.country ? (COUNTRIES.find((c) => c.code === l.country)?.name ?? l.country) : undefined
  return [l.city, l.region, countryName].filter(Boolean).join(', ')
}

function locationKey(l: JobLocation): string {
  return `${l.country ?? ''}|${(l.region ?? '').toLowerCase()}|${(l.city ?? '').toLowerCase()}`
}

export function addLocation(
  list: JobLocation[],
  input: { country?: string; city?: string }
): { ok: true; locations: JobLocation[] } | { ok: false; error: string } {
  const country = input.country || undefined
  const city = input.city?.trim() || undefined
  if (!country && !city) return { ok: false, error: 'Pick a country or enter a city.' }
  if (list.length >= MAX_LOCATIONS) return { ok: false, error: `You can add up to ${MAX_LOCATIONS} locations.` }
  const next: JobLocation = { ...(country ? { country } : {}), ...(city ? { city } : {}) }
  if (list.some((l) => locationKey(l) === locationKey(next))) {
    return { ok: false, error: 'That location is already in the list.' }
  }
  return { ok: true, locations: [...list, next] }
}

// Turns the API's Zod-issue array (VALIDATION_ERROR's `details`) into a
// readable suffix, so a rejected submission is self-diagnosing.
export function formatValidationDetails(details: unknown): string {
  if (!Array.isArray(details) || details.length === 0) return ' Try again.'
  const messages = details
    .map((issue) => {
      if (!issue || typeof issue !== 'object' || !('message' in issue)) return null
      const path = Array.isArray((issue as { path?: unknown[] }).path) ? (issue as { path: unknown[] }).path : []
      const message = String((issue as { message: unknown }).message)
      return path.length > 0 ? `${path.join('.')}: ${message}` : message
    })
    .filter((m): m is string => m !== null)
  return messages.length > 0 ? ` ${messages.join('; ')}` : ' Try again.'
}

const DRAFT_KEY = 'cv-builder:jobsearch-profile-form-draft'
const LEGACY_DRAFT_KEY = 'cv-builder:jobsearch-profile-wizard-draft'

export interface FormDraft {
  version: 2
  step: number
  maxUnlocked: number
  values: ProfileFormValues
}

const LIST_FIELDS = ['roles', 'seniority', 'workModes', 'locations', 'comeetCompanies', 'categories', 'industries'] as const

export function readDraft(): FormDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FormDraft> | null
    if (!parsed || parsed.version !== 2 || !parsed.values || typeof parsed.values !== 'object') return null
    const values = parsed.values as Partial<ProfileFormValues>
    if (typeof values.name !== 'string') return null
    if (!LIST_FIELDS.every((key) => values[key] === undefined || Array.isArray(values[key]))) return null
    const last = STEPS.length - 1
    const step = Math.min(Math.max(Number(parsed.step) || 0, 0), last)
    const maxUnlocked = Math.min(Math.max(Number(parsed.maxUnlocked) || step, step), last)
    return { version: 2, step, maxUnlocked, values: { ...emptyValues(), ...values } }
  } catch {
    // Private-mode denials, quota errors and malformed JSON all mean "no draft".
    return null
  }
}

export function writeDraft(draft: FormDraft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Persisting is a convenience; a storage failure must never block the form.
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
    window.localStorage.removeItem(LEGACY_DRAFT_KEY)
  } catch {
    // Nothing to recover from; the draft is already unreachable.
  }
}
