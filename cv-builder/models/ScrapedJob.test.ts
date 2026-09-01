import { describe, it, expect } from 'vitest'
import ScrapedJob from './ScrapedJob'

describe('ScrapedJob indexes', () => {
  it('has an index covering listScrapedJobs\' query shape ({userId, profileId}, sorted by createdAt desc)', () => {
    const indexes = ScrapedJob.schema.indexes()
    const hasIt = indexes.some(([spec]) =>
      spec.userId === 1 && spec.profileId === 1 && spec.createdAt === -1
    )
    expect(hasIt).toBe(true)
  })

  it('has an index covering status-filtered queries ({userId, profileId, status})', () => {
    const indexes = ScrapedJob.schema.indexes()
    const hasIt = indexes.some(([spec]) =>
      spec.userId === 1 && spec.profileId === 1 && spec.status === 1
    )
    expect(hasIt).toBe(true)
  })
})
