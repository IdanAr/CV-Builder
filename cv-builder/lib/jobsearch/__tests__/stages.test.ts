import { describe, it, expect } from 'vitest'
import { SCRAPED_JOB_STATUSES } from '@/lib/schemas/jobsearch.zod'
import { stageOf, PIPELINE_STAGES, STAGE_LABELS, PIPELINE_FILTERS, parsePipelineFilter, stageQuery, FILTER_LABELS } from '../stages'

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

describe('pipeline filters', () => {
  it('lists the five stages then archive', () => {
    expect(PIPELINE_FILTERS).toEqual(['found', 'matched', 'drafted', 'ready', 'applied', 'archive'])
    for (const f of PIPELINE_FILTERS) expect(FILTER_LABELS[f]).toBeTruthy()
  })
  it('parses only known filters', () => {
    expect(parsePipelineFilter('ready')).toBe('ready')
    expect(parsePipelineFilter('archive')).toBe('archive')
    expect(parsePipelineFilter('nope')).toBeNull()
    expect(parsePipelineFilter(null)).toBeNull()
    expect(parsePipelineFilter(undefined)).toBeNull()
  })
  it('builds a live-only query for every stage and an or-query for archive', () => {
    expect(stageQuery('found')).toEqual({
      status: { $in: ['new', 'notified'] },
      resolvedActions: { $ne: 'notify' },
      deletedAt: { $exists: false },
    })
    expect(stageQuery('matched')).toEqual({
      status: { $in: ['new', 'notified'] },
      resolvedActions: 'notify',
      deletedAt: { $exists: false },
    })
    expect(stageQuery('drafted')).toEqual({ status: 'needs_review', deletedAt: { $exists: false } })
    expect(stageQuery('ready')).toEqual({ status: 'queued', deletedAt: { $exists: false } })
    expect(stageQuery('applied')).toEqual({ status: 'submitted', deletedAt: { $exists: false } })
    expect(stageQuery('archive')).toEqual({
      $or: [{ status: { $in: ['dismissed', 'expired'] } }, { deletedAt: { $exists: true } }],
    })
  })
})
