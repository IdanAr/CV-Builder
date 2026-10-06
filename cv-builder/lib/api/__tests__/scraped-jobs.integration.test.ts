// Exercises countPipelineStages() against a real in-memory MongoDB instead of
// a mocked model, so the $group / $in / $ifNull aggregation, tombstone
// exclusion and per-user scoping actually run.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { connectMemoryMongo, disconnectMemoryMongo, clearMemoryMongo } from '@/test/mongo-memory'

let countPipelineStages: typeof import('../scraped-jobs')['countPipelineStages']
let ScrapedJob: typeof import('@/models/ScrapedJob')['default']

beforeAll(async () => {
  await connectMemoryMongo()
  ;({ countPipelineStages } = await import('../scraped-jobs'))
  ScrapedJob = (await import('@/models/ScrapedJob')).default
}, 30000)

afterAll(async () => {
  await disconnectMemoryMongo()
})

beforeEach(async () => {
  await clearMemoryMongo()
})

let seq = 0
function job(
  userId: string,
  status: string,
  resolvedActions: string[] = [],
  extra: Record<string, unknown> = {}
) {
  seq += 1
  return {
    userId,
    profileId: 'p1',
    source: 'comeet',
    sourceId: `job-${seq}`,
    status,
    resolvedActions,
    ...extra,
  }
}

describe('countPipelineStages (real MongoDB)', () => {
  it('counts per stage for the user only, excluding tombstones and other users', async () => {
    await ScrapedJob.insertMany([
      job('u1', 'new', ['notify']),
      job('u1', 'new', ['notify']),
      job('u1', 'notified', ['notify']),
      job('u1', 'new', []),
      job('u1', 'needs_review', ['draft_and_queue']),
      job('u1', 'queued', ['draft_and_queue']),
      job('u1', 'queued', ['draft_and_queue']),
      job('u1', 'submitted'),
      job('u1', 'dismissed', ['notify']),
      job('u1', 'expired'),
      job('u1', 'queued', ['draft_and_queue'], { deletedAt: new Date() }),
      job('u2', 'queued', ['draft_and_queue']),
    ])

    expect(await countPipelineStages('u1')).toEqual({
      found: 1,
      matched: 3,
      drafted: 1,
      ready: 2,
      applied: 1,
      waiting: 5,
    })
    expect(await countPipelineStages('u2')).toEqual({
      found: 0, matched: 0, drafted: 0, ready: 1, applied: 0, waiting: 1,
    })
    expect(await countPipelineStages('nobody')).toEqual({
      found: 0, matched: 0, drafted: 0, ready: 0, applied: 0, waiting: 0,
    })
  })
})
