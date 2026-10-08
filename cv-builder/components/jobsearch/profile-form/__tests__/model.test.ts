// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  STEPS,
  RECENCY_PRESETS,
  emptyValues,
  valuesFromProfile,
  toPayload,
  validateStep,
  isDirty,
  locationLabel,
  addLocation,
  fitHint,
  readDraft,
  writeDraft,
  clearDraft,
  formatValidationDetails,
} from '../model'

beforeEach(() => window.localStorage.clear())

describe('model basics', () => {
  it('has four steps and the recency presets', () => {
    expect(STEPS).toEqual(['Role', 'Where', 'Sources', 'Review'])
    expect(RECENCY_PRESETS).toEqual([7, 14, 30, 60])
  })

  it('starts empty with schema defaults and the notify rule on', () => {
    const v = emptyValues()
    expect(v).toMatchObject({ name: '', roles: [], locations: [], recencyDays: 14, minAtsScore: 75, notifyOnMatch: true })
  })

  it('fills from an existing profile, tolerating missing comeetCompanies, with notify off', () => {
    const v = valuesFromProfile({
      _id: 'p1', name: 'N', roles: ['A'], workModes: ['remote'], locations: [{ city: 'Tel Aviv', country: 'IL' }],
      seniority: ['senior'], categories: [], industries: [], recencyDays: 30, minAtsScore: 80,
    })
    expect(v.comeetCompanies).toEqual([])
    expect(v.locations).toHaveLength(1)
    expect(v.notifyOnMatch).toBe(false)
  })

  it('builds the API payload without UI-only fields', () => {
    const v = { ...emptyValues(), name: '  Frontend  ', roles: ['React developer'] }
    const payload = toPayload(v)
    expect(payload.name).toBe('Frontend')
    expect(payload.roles).toEqual(['React developer'])
    expect('notifyOnMatch' in payload).toBe(false)
  })

  it('requires a name on step 0 only', () => {
    expect(validateStep(0, emptyValues())).toBe('Enter a name for this profile.')
    expect(validateStep(0, { ...emptyValues(), name: 'x' })).toBeNull()
    expect(validateStep(1, emptyValues())).toBeNull()
  })

  it('detects edits against the initial values', () => {
    const a = emptyValues()
    expect(isDirty(a, a)).toBe(false)
    expect(isDirty({ ...a, roles: ['x'] }, a)).toBe(true)
  })

  it('bands the fit threshold into lenient, balanced and strict', () => {
    expect(fitHint(60)).toMatch(/^Lenient/)
    expect(fitHint(75)).toMatch(/^Balanced/)
    expect(fitHint(90)).toMatch(/^Strict/)
  })
})

describe('locations', () => {
  it('labels as "City, Country" using the country name', () => {
    expect(locationLabel({ city: 'Tel Aviv', country: 'IL' })).toBe('Tel Aviv, Israel')
    expect(locationLabel({ country: 'IL' })).toBe('Israel')
    expect(locationLabel({ city: 'Herzliya' })).toBe('Herzliya')
  })

  it('adds a location and trims the city', () => {
    const r = addLocation([], { country: 'IL', city: '  Tel Aviv ' })
    expect(r).toEqual({ ok: true, locations: [{ country: 'IL', city: 'Tel Aviv' }] })
  })

  it('rejects an empty location', () => {
    expect(addLocation([], { country: '', city: ' ' })).toEqual({ ok: false, error: 'Pick a country or enter a city.' })
  })

  it('rejects duplicates ignoring city case', () => {
    const list = [{ country: 'IL', city: 'Tel Aviv' }]
    const r = addLocation(list, { country: 'IL', city: 'tel aviv' })
    expect(r).toEqual({ ok: false, error: 'That location is already in the list.' })
  })

  it('rejects a sixth location', () => {
    const list = Array.from({ length: 5 }, (_, i) => ({ city: `C${i}` }))
    const r = addLocation(list, { city: 'Extra' })
    expect(r).toEqual({ ok: false, error: 'You can add up to 5 locations.' })
  })
})

describe('draft', () => {
  const draft = () => ({ version: 2 as const, step: 2, maxUnlocked: 2, values: { ...emptyValues(), name: 'Saved' } })

  it('round-trips a draft', () => {
    writeDraft(draft())
    expect(readDraft()?.values.name).toBe('Saved')
    expect(readDraft()?.step).toBe(2)
  })

  it('ignores a draft from the six-step wizard (no version)', () => {
    window.localStorage.setItem('cv-builder:jobsearch-profile-form-draft', JSON.stringify({ step: 3, state: {}, draftText: {} }))
    expect(readDraft()).toBeNull()
  })

  it('ignores corrupt JSON and wrongly shaped values', () => {
    window.localStorage.setItem('cv-builder:jobsearch-profile-form-draft', '{nope')
    expect(readDraft()).toBeNull()
    window.localStorage.setItem(
      'cv-builder:jobsearch-profile-form-draft',
      JSON.stringify({ version: 2, step: 1, maxUnlocked: 1, values: { name: 'x', roles: 'not-an-array' } })
    )
    expect(readDraft()).toBeNull()
  })

  it('clears both the current and the legacy draft keys', () => {
    window.localStorage.setItem('cv-builder:jobsearch-profile-wizard-draft', '{}')
    writeDraft(draft())
    clearDraft()
    expect(window.localStorage.getItem('cv-builder:jobsearch-profile-form-draft')).toBeNull()
    expect(window.localStorage.getItem('cv-builder:jobsearch-profile-wizard-draft')).toBeNull()
  })
})

describe('formatValidationDetails', () => {
  it('turns Zod issues into a readable suffix', () => {
    expect(formatValidationDetails([{ path: ['locations'], message: 'Too big' }])).toBe(' locations: Too big')
    expect(formatValidationDetails(undefined)).toBe(' Try again.')
  })
})

describe('valuesFromProfile locations', () => {
  it('drops empty location entries left behind by the old wizard', () => {
    const v = valuesFromProfile({
      _id: 'p', name: 'N', roles: [], workModes: [], seniority: [], categories: [], industries: [],
      recencyDays: 14, minAtsScore: 75,
      locations: [{}, { city: '' }, { country: 'IL' }, { city: 'Haifa' }, { region: 'Bavaria' }],
    })
    expect(v.locations).toEqual([{ country: 'IL' }, { city: 'Haifa' }, { region: 'Bavaria' }])
  })
})
