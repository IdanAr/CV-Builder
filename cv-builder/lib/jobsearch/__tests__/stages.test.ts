import { describe, it, expect } from 'vitest'
import { SCRAPED_JOB_STATUSES } from '@/lib/schemas/jobsearch.zod'
import { stageOf, PIPELINE_STAGES, STAGE_LABELS } from '../stages'

describe('stageOf', () => {
  it.each([
    ['new', ['notify'], 'matched'],
    ['notified', ['notify'], 'matched'],
    ['new', [], 'found'],
    ['notified', undefined, 'found'],
    ['new', ['draft_and_queue'], 'found'],
    ['needs_review', ['draft_and_queue'], 'drafted'],
    ['queued', ['draft_and_queue'], 'ready'],
    ['submitted', [], 'applied'],
    ['dismissed', ['notify'], 'archive'],
    ['expired', [], 'archive'],
  ] as const)('status %s with actions %j is %s', (status, actions, expected) => {
    expect(stageOf({ status, resolvedActions: actions as readonly string[] | undefined })).toBe(expected)
  })

  it('a tombstoned job is archive whatever its status', () => {
    expect(stageOf({ status: 'queued', deletedAt: new Date() })).toBe('archive')
    expect(stageOf({ status: 'new', resolvedActions: ['notify'], deletedAt: '2026-10-06T00:00:00Z' })).toBe('archive')
  })

  it('handles every status in the schema (guards a future status being added unmapped)', () => {
    for (const status of SCRAPED_JOB_STATUSES) {
      const stage = stageOf({ status })
      expect([...PIPELINE_STAGES, 'archive']).toContain(stage)
    }
  })

  it('has a label for every stage', () => {
    for (const stage of PIPELINE_STAGES) expect(STAGE_LABELS[stage]).toBeTruthy()
  })
})
