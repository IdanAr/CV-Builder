import { describe, it, expect } from 'vitest'
import {
  createEmptyWork, createEmptyEducation, createEmptySkill, createEmptyCertificate,
  createEmptyAward, createEmptyPublication, createEmptyVolunteer, createEmptyLanguage,
  createEmptyInterest, createEmptyProject, EMPTY_ENTRY_FACTORIES,
} from './resume-empty-entries'

describe('resume-empty-entries', () => {
  it('creates an empty work entry with the expected shape', () => {
    expect(createEmptyWork()).toEqual({
      name: '', position: '', url: '', startDate: '', endDate: '', summary: '', highlights: [],
    })
  })

  it('creates an empty education entry with the expected shape', () => {
    expect(createEmptyEducation()).toEqual({
      institution: '', url: '', area: '', studyType: '', startDate: '', endDate: '', score: '', courses: [],
    })
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
    expect(EMPTY_ENTRY_FACTORIES.work()).toEqual(createEmptyWork())
  })
})
