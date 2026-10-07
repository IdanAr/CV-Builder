import { describe, it, expect } from 'vitest'
import { planActions, isOneStep } from '../job-actions'
import type { PipelineJob } from '../pipeline-types'

function job(o: Partial<PipelineJob>): PipelineJob {
  return {
    _id: 'j1', profileId: 'p1', title: 'Eng', company: 'Acme', url: 'https://x.test/1',
    matchedRules: [], pendingApprovals: [], tailoredKeywords: [], status: 'new', stage: 'found',
    createdAt: '2026-10-01T00:00:00.000Z', ...o,
  }
}

describe('planActions (spec 7.4 table)', () => {
  it.each(['found', 'matched'] as const)('%s: open posting, then track and dismiss, delete in overflow', (stage) => {
    expect(planActions(job({ stage }))).toEqual({ primary: 'open-posting', secondary: ['track', 'dismiss'], overflow: ['delete'] })
  })
  it('found without a url makes Track primary', () => {
    expect(planActions(job({ stage: 'found', url: '' }))).toEqual({ primary: 'track', secondary: ['dismiss'], overflow: ['delete'] })
  })
  it('drafted with flagged claims: approve first (R3)', () => {
    expect(planActions(job({ stage: 'drafted', status: 'needs_review', pendingApprovals: ['40%'], draftResumeId: 'r1' })))
      .toEqual({ primary: 'approve', secondary: ['open-cv', 'dismiss'], overflow: ['delete'] })
  })
  it('drafted held back only by score: open the tailored CV (R3)', () => {
    expect(planActions(job({ stage: 'drafted', status: 'needs_review', draftResumeId: 'r1' })))
      .toEqual({ primary: 'open-cv', secondary: ['dismiss'], overflow: ['delete'] })
  })
  it('ready: mark applied, open CV, dismiss', () => {
    expect(planActions(job({ stage: 'ready', status: 'queued', draftResumeId: 'r1' })))
      .toEqual({ primary: 'mark-applied', secondary: ['open-cv', 'dismiss'], overflow: ['delete'] })
  })
  it('applied: only open in applications', () => {
    expect(planActions(job({ stage: 'applied', status: 'submitted' }))).toEqual({ primary: 'open-applications', secondary: [], overflow: [] })
  })
  it('archive: restore a dismissed job, find again for a tombstone', () => {
    expect(planActions(job({ stage: 'archive', status: 'dismissed' }))).toEqual({ primary: 'restore', secondary: [], overflow: [] })
    expect(planActions(job({ stage: 'archive', status: 'new', deletedAt: '2026-10-02T00:00:00.000Z' })))
      .toEqual({ primary: 'find-again', secondary: [], overflow: [] })
  })
})

describe('isOneStep', () => {
  it('is true only for actions that complete without leaving the page', () => {
    for (const id of ['approve', 'mark-applied', 'restore', 'find-again'] as const) expect(isOneStep(id)).toBe(true)
    // track is not idempotent: a repeated A on a no-URL job created duplicate Applications.
    for (const id of ['track', 'open-posting', 'open-cv', 'open-applications', 'dismiss', 'delete'] as const) expect(isOneStep(id)).toBe(false)
  })
})
