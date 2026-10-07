import { describe, it, expect } from 'vitest'
import { defaultStage, parsePipelineView, pipelineHref } from '../pipeline-url'

describe('pipelineHref', () => {
  it('is the bare path with no view', () => {
    expect(pipelineHref()).toBe('/dashboard/jobsearch')
  })
  it('serialises only the non-empty parts', () => {
    expect(pipelineHref({ stage: 'matched' })).toBe('/dashboard/jobsearch?stage=matched')
    expect(pipelineHref({ profile: 'p1' })).toBe('/dashboard/jobsearch?profile=p1')
    expect(pipelineHref({ stage: 'ready', profile: 'p1', q: '  eng ', job: 'j1' })).toBe(
      '/dashboard/jobsearch?stage=ready&profile=p1&q=eng&job=j1'
    )
    expect(pipelineHref({ q: '   ', profile: null, job: null })).toBe('/dashboard/jobsearch')
  })
})

describe('parsePipelineView', () => {
  const params = (s: string) => new URLSearchParams(s)
  it('uses the fallback stage when ?stage is missing or invalid', () => {
    expect(parsePipelineView(params(''), 'found').stage).toBe('found')
    expect(parsePipelineView(params('stage=bogus'), 'drafted').stage).toBe('drafted')
  })
  it('reads every part', () => {
    expect(parsePipelineView(params('stage=archive&profile=p1&q=x&job=j9'), 'found')).toEqual({
      stage: 'archive',
      profile: 'p1',
      q: 'x',
      job: 'j9',
    })
  })
  it('defaults the optional parts', () => {
    expect(parsePipelineView(params(''), 'found')).toEqual({ stage: 'found', profile: null, q: '', job: null })
  })
})

describe('defaultStage (R1)', () => {
  const c = (o: Partial<{ matchedUnread: number; drafted: number; ready: number }>) => ({
    matchedUnread: 0,
    drafted: 0,
    ready: 0,
    ...o,
  })
  it('prefers unread matches, then drafts, then ready', () => {
    expect(defaultStage(c({ matchedUnread: 2, drafted: 1, ready: 1 }))).toBe('matched')
    expect(defaultStage(c({ drafted: 1, ready: 1 }))).toBe('drafted')
    expect(defaultStage(c({ ready: 3 }))).toBe('ready')
  })
  it('falls back to found when nothing is waiting', () => {
    expect(defaultStage(c({}))).toBe('found')
  })
})
