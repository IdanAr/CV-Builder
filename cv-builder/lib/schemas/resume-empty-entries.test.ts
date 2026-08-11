import { describe, it, expect } from 'vitest'
import {
  createEmptyWork, createEmptyEducation, createEmptySkill, createEmptyCertificate,
  createEmptyAward, createEmptyPublication, createEmptyVolunteer, createEmptyLanguage,
  createEmptyInterest, createEmptyProject, EMPTY_ENTRY_FACTORIES,
} from './resume-empty-entries'

describe('resume-empty-entries', () => {
  it('creates an empty work entry seeded with one empty role', () => {
    const work = createEmptyWork()
    expect(work.name).toBe('')
    expect(work.url).toBe('')
    expect(work.roles).toHaveLength(1)
    expect(work.roles?.[0]).toMatchObject({ position: '', startDate: '', endDate: '', summary: '', highlights: [] })
    expect(work.roles?.[0].id).toBeTruthy()
  })

  it('creates an empty education entry seeded with one empty role', () => {
    const education = createEmptyEducation()
    expect(education.institution).toBe('')
    expect(education.url).toBe('')
    expect(education.roles).toHaveLength(1)
    expect(education.roles?.[0]).toMatchObject({ studyType: '', area: '', startDate: '', endDate: '', score: '', courses: [] })
    expect(education.roles?.[0].id).toBeTruthy()
  })

  it('creates an empty skill entry with the expected shape', () => {
    expect(createEmptySkill()).toEqual({ name: '', level: '', keywords: [] })
  })

  it('creates an empty certificate entry with the expected shape', () => {
    expect(createEmptyCertificate()).toEqual({ name: '', date: '', issuer: '', url: '' })
  })

  it('creates an empty award entry with the expected shape', () => {
    expect(createEmptyAward()).toEqual({ title: '', date: '', awarder: '', summary: '' })
  })

  it('creates an empty publication entry with the expected shape', () => {
    expect(createEmptyPublication()).toEqual({ name: '', publisher: '', releaseDate: '', url: '', summary: '' })
  })

  it('creates an empty volunteer entry with the expected shape', () => {
    expect(createEmptyVolunteer()).toEqual({
      organization: '', position: '', url: '', startDate: '', endDate: '', summary: '', highlights: [],
    })
  })

  it('creates an empty language entry with the expected shape', () => {
    expect(createEmptyLanguage()).toEqual({ language: '', fluency: '' })
  })

  it('creates an empty interest entry with the expected shape', () => {
    expect(createEmptyInterest()).toEqual({ name: '', keywords: [] })
  })

  it('creates an empty project entry with the expected shape', () => {
    expect(createEmptyProject()).toEqual({
      name: '', description: '', highlights: [], keywords: [], startDate: '', endDate: '', url: '',
    })
  })

  it('exposes every built-in list section in EMPTY_ENTRY_FACTORIES', () => {
    expect(Object.keys(EMPTY_ENTRY_FACTORIES).sort()).toEqual([
      'awards', 'certificates', 'education', 'interests', 'languages',
      'projects', 'publications', 'skills', 'volunteer', 'work',
    ])
    expect(EMPTY_ENTRY_FACTORIES.work()).toMatchObject({ name: '', url: '' })
  })
})
