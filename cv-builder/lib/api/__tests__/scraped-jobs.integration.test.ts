// Exercises countPipelineStages() against a real in-memory MongoDB instead of
// a mocked model, so the $group / $in / $ifNull aggregation, tombstone
// exclusion and per-user scoping actually run.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { SCRAPED_JOB_STATUSES } from '@/lib/schemas/jobsearch.zod'
import { PIPELINE_FILTERS, stageOf } from '@/lib/jobsearch/stages'
import { connectMemoryMongo, disconnectMemoryMongo, clearMemoryMongo } from '@/test/mongo-memory'

let countPipelineStages: typeof import('../scraped-jobs')['countPipelineStages']
let listPipelineJobs: typeof import('../scraped-jobs')['listPipelineJobs']
let InvalidCursorError: typeof import('../scraped-jobs')['InvalidCursorError']
let ScrapedJob: typeof import('@/models/ScrapedJob')['default']

beforeAll(async () => {
  await connectMemoryMongo()
  ;({ countPipelineStages, listPipelineJobs, InvalidCursorError } = await import('../scraped-jobs'))
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
      archive: 3,
      matchedUnread: 2,
      waiting: 5,
    })
    expect(await countPipelineStages('u2')).toEqual({
      found: 0, matched: 0, drafted: 0, ready: 1, applied: 0, archive: 0, matchedUnread: 0, waiting: 1,
    })
    expect(await countPipelineStages('nobody')).toEqual({
      found: 0, matched: 0, drafted: 0, ready: 0, applied: 0, archive: 0, matchedUnread: 0, waiting: 0,
    })
  })
})

describe('listPipelineJobs', () => {
  it('returns, for every filter, exactly the jobs stageOf assigns to it (all status x notify x tombstone combos)', async () => {
    const docs: Record<string, unknown>[] = []
    for (const status of SCRAPED_JOB_STATUSES) {
      for (const notify of [false, true]) {
        for (const deleted of [false, true]) {
          docs.push(job('u1', status, notify ? ['notify'] : [], deleted ? { deletedAt: new Date() } : {}))
        }
      }
    }
    await ScrapedJob.insertMany(docs)
    const all = (await ScrapedJob.find({ userId: 'u1' }).lean()) as unknown as Array<{ _id: unknown; status: never; resolvedActions: string[]; deletedAt?: Date }>

    for (const filter of PIPELINE_FILTERS) {
      const { items } = await listPipelineJobs('u1', { stage: filter, limit: 50 })
      const expected = all.filter((d) => stageOf(d) === filter).map((d) => String(d._id)).sort()
      expect(items.map((i) => i._id).sort()).toEqual(expected)
      for (const item of items) expect(item.stage).toBe(filter)
    }
  })

  it('never returns another user\'s jobs, with or without a profile filter', async () => {
    await ScrapedJob.insertMany([job('u1', 'new'), job('u2', 'new'), job('u2', 'new', ['notify'])])
    const mine = await listPipelineJobs('u1', { stage: 'found' })
    expect(mine.items).toHaveLength(1)
    expect((await listPipelineJobs('u1', { stage: 'matched' })).items).toHaveLength(0)
    expect((await listPipelineJobs('u1', { stage: 'found', profileId: 'p1' })).items).toHaveLength(1)
    expect((await listPipelineJobs('u3', { stage: 'found' })).items).toHaveLength(0)
  })

  it('filters by profile', async () => {
    await ScrapedJob.insertMany([job('u1', 'new', [], { profileId: 'pA' }), job('u1', 'new', [], { profileId: 'pB' })])
    const { items } = await listPipelineJobs('u1', { stage: 'found', profileId: 'pA' })
    expect(items.map((i) => i.profileId)).toEqual(['pA'])
  })

  it('searches title and company case-insensitively and survives regex characters', async () => {
    await ScrapedJob.insertMany([
      job('u1', 'new', [], { title: 'Senior Engineer', company: 'Acme' }),
      job('u1', 'new', [], { title: 'Designer', company: 'Engine Co' }),
      job('u1', 'new', [], { title: 'C++ Dev', company: 'Zed' }),
    ])
    expect((await listPipelineJobs('u1', { stage: 'found', q: 'engin' })).items).toHaveLength(2)
    expect((await listPipelineJobs('u1', { stage: 'found', q: 'c++' })).items).toHaveLength(1)
    expect((await listPipelineJobs('u1', { stage: 'found', q: '(' })).items).toHaveLength(0)
  })

  it('paginates newest-first with a stable cursor, ties broken by _id', async () => {
    const t = (n: number) => new Date(Date.UTC(2026, 9, n))
    const rows = [t(1), t(2), t(3), t(3), t(4)].map((createdAt, i) => ({
      ...job('u1', 'new', [], { title: `J${i}` }), createdAt, updatedAt: createdAt,
    }))
    await ScrapedJob.collection.insertMany(rows as never)

    const seen: string[] = []
    let cursor: string | undefined
    for (let guard = 0; guard < 5; guard += 1) {
      const page = await listPipelineJobs('u1', { stage: 'found', limit: 2, cursor })
      seen.push(...page.items.map((i) => i._id))
      if (!page.nextCursor) break
      cursor = page.nextCursor
    }
    expect(seen).toHaveLength(5)
    expect(new Set(seen).size).toBe(5)
    const createdOrder = (await ScrapedJob.find({ _id: { $in: seen } }).lean()) as unknown as Array<{ _id: unknown; createdAt: Date }>
    const byId = new Map(createdOrder.map((d) => [String(d._id), d.createdAt.getTime()]))
    const times = seen.map((id) => byId.get(id)!)
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('does not return the description and rejects a malformed cursor', async () => {
    await ScrapedJob.insertMany([job('u1', 'new', [], { description: 'long text' })])
    const { items } = await listPipelineJobs('u1', { stage: 'found' })
    expect(items[0]).not.toHaveProperty('description')
    await expect(listPipelineJobs('u1', { stage: 'found', cursor: 'not-a-cursor' })).rejects.toBeInstanceOf(InvalidCursorError)
  })

  it('rejects a cursor whose timestamp is out of Date range or whose id is not a 24-hex ObjectId', async () => {
    const enc = (raw: string) => Buffer.from(raw).toString('base64url')
    const id = '507f1f77bcf86cd799439011'
    await expect(listPipelineJobs('u1', { stage: 'found', cursor: enc(`1e20:${id}`) })).rejects.toBeInstanceOf(InvalidCursorError)
    await expect(listPipelineJobs('u1', { stage: 'found', cursor: enc('1700000000000:short12chars') })).rejects.toBeInstanceOf(InvalidCursorError)
  })
})

describe('countPipelineStages options and archive', () => {
  it('counts the archive (dismissed, expired, tombstones) and honours profileId', async () => {
    await ScrapedJob.insertMany([
      job('u1', 'new', [], { profileId: 'pA' }),
      job('u1', 'dismissed', [], { profileId: 'pA' }),
      job('u1', 'expired', [], { profileId: 'pB' }),
      job('u1', 'new', [], { profileId: 'pB', deletedAt: new Date() }),
      job('u2', 'dismissed'),
    ])
    const all = await countPipelineStages('u1')
    expect(all.archive).toBe(3)
    expect(all.found).toBe(1)
    const a = await countPipelineStages('u1', { profileId: 'pA' })
    expect(a.archive).toBe(1)
    expect(a.found).toBe(1)
  })
})
