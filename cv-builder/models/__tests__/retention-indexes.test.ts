// Retention is expressed as TTL indexes on the schemas, which means it is
// invisible at every call site — nothing in lib/ or app/ mentions it, and a
// deletion of either index would be silent until data stopped expiring
// months later.
//
// These assertions read the compiled schema definitions rather than talking
// to MongoDB: the TTL monitor runs roughly once a minute on a real mongod,
// so observing actual expiry in a test is not practical. What can be pinned
// is that the index exists, targets the right field, and carries the agreed
// duration.
import { describe, it, expect } from 'vitest'
import ScrapedJob from '@/models/ScrapedJob'
import ApplicationActivity from '@/models/ApplicationActivity'

const DAY_SECONDS = 24 * 60 * 60

type IndexDef = [Record<string, unknown>, Record<string, unknown> | undefined]

function findTtlIndex(indexes: IndexDef[], field: string) {
  return indexes.find(
    ([fields, options]) => Object.keys(fields)[0] === field && options?.expireAfterSeconds !== undefined
  )
}

describe('ScrapedJob tombstone retention', () => {
  const indexes = ScrapedJob.schema.indexes() as IndexDef[]

  it('expires tombstones 90 days after deletion', () => {
    const ttl = findTtlIndex(indexes, 'deletedAt')

    expect(ttl).toBeDefined()
    expect(ttl?.[1]?.expireAfterSeconds).toBe(90 * DAY_SECONDS)
  })

  it('keys the TTL on deletedAt so live postings are never expired', () => {
    // A TTL index only expires documents where the field exists and holds a
    // Date. Keying this on createdAt instead would quietly delete postings
    // the user never deleted.
    const ttl = findTtlIndex(indexes, 'deletedAt')

    expect(Object.keys(ttl?.[0] ?? {})).toEqual(['deletedAt'])
  })

  it('keeps the dedup index that makes tombstones worth retaining at all', () => {
    // The tombstone exists to stop a deleted posting being re-fetched and
    // re-tailored at full AI cost. If this index went away the retention
    // policy would be protecting nothing.
    const dedup = indexes.find(
      ([fields]) => Object.keys(fields).join(',') === 'userId,profileId,source,sourceId'
    )

    expect(dedup?.[1]?.unique).toBe(true)
  })
})

describe('ApplicationActivity history retention', () => {
  const indexes = ApplicationActivity.schema.indexes() as IndexDef[]

  it('expires activity rows after 180 days', () => {
    const ttl = findTtlIndex(indexes, 'changedAt')

    expect(ttl).toBeDefined()
    expect(ttl?.[1]?.expireAfterSeconds).toBe(180 * DAY_SECONDS)
  })

  it('keeps the compound index the activity query actually uses', () => {
    // The TTL index is keyed on changedAt alone and cannot serve
    // find({ applicationId, userId }).sort({ changedAt: -1 }).
    const query = indexes.find(
      ([fields]) => Object.keys(fields).join(',') === 'applicationId,userId,changedAt'
    )

    expect(query).toBeDefined()
  })
})
