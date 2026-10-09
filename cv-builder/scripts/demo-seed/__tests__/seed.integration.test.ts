// Runs the demo seed against a real (in-memory) MongoDB next to another
// user's data, then reads it back through the app's own data-access layer.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import mongoose, { Types } from 'mongoose'
import { connectMemoryMongo, disconnectMemoryMongo, clearMemoryMongo } from '@/test/mongo-memory'
import { seedDemoUser, SeedAbort } from '../seed'

const DEMO_ID = '6ac88905b880e0a741e35ef3'
const DEMO_EMAIL = 'idantest3@gmail.com'
const OTHER_ID = '5f0000000000000000000001'

let api: {
  listResumes: typeof import('@/lib/api/resumes')['listResumes']
  listApplications: typeof import('@/lib/api/applications')['listApplications']
  countPipelineStages: typeof import('@/lib/api/scraped-jobs')['countPipelineStages']
  listJobSearchProfiles: typeof import('@/lib/api/jobsearch-profiles')['listJobSearchProfiles']
  convertScrapedJobToApplication: typeof import('@/lib/api/scraped-jobs')['convertScrapedJobToApplication']
}

beforeAll(async () => {
  await connectMemoryMongo()
  const [r, a, s, p] = await Promise.all([
    import('@/lib/api/resumes'),
    import('@/lib/api/applications'),
    import('@/lib/api/scraped-jobs'),
    import('@/lib/api/jobsearch-profiles'),
  ])
  api = {
    listResumes: r.listResumes,
    listApplications: a.listApplications,
    countPipelineStages: s.countPipelineStages,
    listJobSearchProfiles: p.listJobSearchProfiles,
    convertScrapedJobToApplication: s.convertScrapedJobToApplication,
  }
}, 60000)

afterAll(async () => {
  await disconnectMemoryMongo()
})

beforeEach(async () => {
  await clearMemoryMongo()
  const db = mongoose.connection.db!
  await db.collection('users').insertMany([
    { _id: new Types.ObjectId(DEMO_ID), email: DEMO_EMAIL },
    { _id: new Types.ObjectId(OTHER_ID), email: 'someone@else.com' },
  ])
  await db.collection('resumes').insertOne({ userId: OTHER_ID, title: 'Not yours', data: {}, meta: {} })
  await db.collection('applications').insertOne({ userId: OTHER_ID, company: 'X', role: 'Y', status: 'applied' })
})

const run = (overrides: Partial<Parameters<typeof seedDemoUser>[0]> = {}) =>
  seedDemoUser({
    connection: mongoose.connection,
    userId: DEMO_ID,
    expectedEmail: DEMO_EMAIL,
    apply: true,
    reset: false,
    ...overrides,
  })

describe('seedDemoUser', () => {
  it('writes nothing on a dry run', async () => {
    const report = await run({ apply: false })
    expect(report.applied).toBe(false)
    expect(await mongoose.connection.db!.collection('resumes').countDocuments({ userId: DEMO_ID })).toBe(0)
  })

  it('refuses a user whose email does not match', async () => {
    await expect(run({ expectedEmail: 'wrong@example.com' })).rejects.toBeInstanceOf(SeedAbort)
  })

  it('refuses a user that does not exist', async () => {
    await expect(run({ userId: '5f00000000000000000000ff' })).rejects.toBeInstanceOf(SeedAbort)
  })

  it('seeds data the app reads back, and leaves other users alone', async () => {
    const report = await run()
    expect(report.applied).toBe(true)
    expect(report.otherUsersAfter).toEqual(report.otherUsersBefore)

    const resumes = await api.listResumes(DEMO_ID)
    expect(resumes).toHaveLength(7)
    const apps = await api.listApplications(DEMO_ID)
    expect(apps).toHaveLength(13)
    expect(apps.every((a) => a.resumeTitle)).toBe(true)
    expect(await api.listJobSearchProfiles(DEMO_ID)).toHaveLength(3)

    const counts = await api.countPipelineStages(DEMO_ID)
    for (const stage of ['found', 'matched', 'drafted', 'ready', 'applied'] as const) {
      expect(counts[stage]).toBeGreaterThan(0)
    }

    const db = mongoose.connection.db!
    expect(await db.collection('resumes').countDocuments({ userId: OTHER_ID })).toBe(1)
    expect(await db.collection('applications').countDocuments({ userId: OTHER_ID })).toBe(1)
  })

  it('lets the demo walk the Ready posting through "Mark as applied"', async () => {
    await run()
    const ready = await mongoose.connection.db!.collection('scrapedjobs').findOne({ userId: DEMO_ID, status: 'queued' })
    const result = await api.convertScrapedJobToApplication(DEMO_ID, String(ready!._id))
    expect(result.ok).toBe(true)
    const config = await mongoose.connection.db!.collection('boardconfigs').findOne({ userId: DEMO_ID })
    // Reuses the seeded Job URL / Location columns instead of adding duplicates.
    expect(config!.columns.filter((c: { id: string }) => c.id === 'jobUrl')).toHaveLength(1)
  })

  it('refuses to double-seed, and --reset replaces only the demo user data', async () => {
    await run()
    await expect(run()).rejects.toBeInstanceOf(SeedAbort)
    const report = await run({ reset: true })
    expect(report.deleted.resumes).toBe(7)
    const db = mongoose.connection.db!
    expect(await db.collection('resumes').countDocuments({ userId: DEMO_ID })).toBe(7)
    expect(await db.collection('resumes').countDocuments({ userId: OTHER_ID })).toBe(1)
  })
})
