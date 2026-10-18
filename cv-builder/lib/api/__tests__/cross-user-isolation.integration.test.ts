// lib/api/__tests__/cross-user-isolation.integration.test.ts
//
// Tenant isolation against a real MongoDB: user B, holding the ids of user
// A's documents, can neither read, change nor delete any of them through the
// data-access layer every API route goes through (lib/api/*).
//
// The unit tests beside this file assert the *filters* each function builds,
// with Mongoose mocked. This file asserts the *outcome* on real documents, so
// it also catches what a filter test cannot: a query that looks scoped but
// isn't once Mongoose casts it, a cascade that reaches another user's rows, or
// an aggregate whose $match drops the userId.
//
// It also covers the shape of a NoSQL-injection attempt: an id that arrives as
// a query operator ({ $ne: null }) instead of a string. Routes take ids from
// path params (always strings) and Zod-validated bodies, but the data layer
// must stay safe even if one ever slips through, because userId is part of
// every filter.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { connectMemoryMongo, disconnectMemoryMongo, clearMemoryMongo } from '@/test/mongo-memory'
import { CreateResumeSchema } from '@/lib/schemas/resume.zod'
import { CreateApplicationSchema } from '@/lib/schemas/application.zod'
import { CreateJobSearchProfileSchema, CreateJobSearchRuleSchema } from '@/lib/schemas/jobsearch.zod'

type Resumes = typeof import('../resumes')
type Applications = typeof import('../applications')
type Profiles = typeof import('../jobsearch-profiles')
type Rules = typeof import('../jobsearch-rules')
type Scraped = typeof import('../scraped-jobs')
type BoardCfg = typeof import('../board-config')

let resumes: Resumes
let applications: Applications
let profiles: Profiles
let rules: Rules
let scraped: Scraped
let board: BoardCfg
let ScrapedJob: typeof import('@/models/ScrapedJob')['default']
let Resume: typeof import('@/models/Resume')['default']
let Application: typeof import('@/models/Application')['default']

const ALICE = 'alice-user-id'
const MALLORY = 'mallory-user-id'

/** An id shaped like a Mongo query operator, as an injection attempt would send it. */
const OPERATOR_ID = { $ne: null } as unknown as string

const CONDITIONS = [{ field: 'atsScore' as const, op: 'gte' as const, value: 70 }]

beforeAll(async () => {
  await connectMemoryMongo()
  resumes = await import('../resumes')
  applications = await import('../applications')
  profiles = await import('../jobsearch-profiles')
  rules = await import('../jobsearch-rules')
  scraped = await import('../scraped-jobs')
  board = await import('../board-config')
  ScrapedJob = (await import('@/models/ScrapedJob')).default
  Resume = (await import('@/models/Resume')).default
  Application = (await import('@/models/Application')).default
}, 60_000)

afterAll(async () => {
  await disconnectMemoryMongo()
})

beforeEach(async () => {
  await clearMemoryMongo()
})

/** Alice's account, fully populated: one of everything Mallory might go after. */
async function seedAlice() {
  const resume = await resumes.createResume(ALICE, CreateResumeSchema.parse({ title: 'Alice CV' }))
  const resumeId = String(resume._id)
  const application = await applications.createApplication(
    ALICE,
    CreateApplicationSchema.parse({ company: 'Acme', role: 'Engineer', status: 'applied', resumeId })
  )
  const applicationId = String(application._id)
  await applications.patchApplication(ALICE, applicationId, { company: 'Acme Corp' })
  const profile = await profiles.createJobSearchProfile(
    ALICE,
    CreateJobSearchProfileSchema.parse({ name: 'Alice search', resumeId })
  )
  const profileId = String(profile._id)
  const rule = await rules.createJobSearchRule(
    ALICE,
    CreateJobSearchRuleSchema.parse({ profileId, name: 'Alice rule', conditions: CONDITIONS, action: 'notify' })
  )
  const ruleId = String(rule!._id)
  const [job] = await ScrapedJob.insertMany([
    {
      userId: ALICE,
      profileId,
      source: 'comeet',
      sourceId: 'alice-job-1',
      title: 'Data Engineer',
      company: 'Globex',
      status: 'new',
      resolvedActions: ['notify'],
      draftResumeId: resumeId,
      pendingApprovals: ['led a team of 12'],
    },
  ])
  const jobId = String(job._id)
  return { resumeId, applicationId, profileId, ruleId, jobId }
}

describe('cross-user isolation: résumés', () => {
  it('Mallory cannot read, list, change, duplicate or delete Alice’s résumé', async () => {
    const { resumeId } = await seedAlice()

    expect(await resumes.getResume(MALLORY, resumeId)).toBeNull()
    expect(await resumes.listResumes(MALLORY)).toEqual([])
    expect(await resumes.listResumeOptions(MALLORY)).toEqual([])
    expect(await resumes.patchResume(MALLORY, resumeId, { title: 'pwned' })).toBeNull()
    expect(await resumes.duplicateResume(MALLORY, resumeId)).toBeNull()
    expect(await resumes.deleteResume(MALLORY, resumeId)).toBe(false)

    const stored = await Resume.findById(resumeId).lean<{ title: string; userId: string }>()
    expect(stored).toMatchObject({ title: 'Alice CV', userId: ALICE })
    expect(await Resume.countDocuments({ userId: MALLORY })).toBe(0)
  })

  it('an operator-shaped id still cannot reach another user’s résumé', async () => {
    await seedAlice()
    expect(await resumes.getResume(MALLORY, OPERATOR_ID)).toBeNull()
    expect(await resumes.patchResume(MALLORY, OPERATOR_ID, { title: 'pwned' })).toBeNull()
    expect(await resumes.deleteResume(MALLORY, OPERATOR_ID)).toBe(false)
    expect(await Resume.countDocuments({ userId: ALICE, title: 'Alice CV' })).toBe(1)
  })
})

describe('cross-user isolation: applications', () => {
  it('Mallory cannot list, change, delete or read the activity log of Alice’s application', async () => {
    const { applicationId } = await seedAlice()

    expect(await applications.listApplications(MALLORY)).toEqual([])
    expect(await applications.patchApplication(MALLORY, applicationId, { company: 'pwned' })).toBeNull()
    expect(await applications.deleteApplication(MALLORY, applicationId)).toBe(false)
    expect((await applications.listActivity(MALLORY, applicationId)).entries).toHaveLength(0)
    // Alice's own log does hold the change, so the empty result above is the
    // scoping at work, not a log that was never written.
    expect((await applications.listActivity(ALICE, applicationId)).entries.length).toBeGreaterThan(0)

    const stored = await Application.findById(applicationId).lean<{ company: string }>()
    expect(stored?.company).toBe('Acme Corp')
  })

  it('Mallory cannot attach Alice’s résumé to her own application', async () => {
    const { resumeId } = await seedAlice()
    const mine = await applications.createApplication(
      MALLORY,
      CreateApplicationSchema.parse({ company: 'Mine', role: 'Role', status: 'applied', resumeId })
    )
    expect(mine.resumeId).toBeUndefined()

    await applications.patchApplication(MALLORY, String(mine._id), { resumeId })
    const stored = await Application.findById(mine._id).lean<{ resumeId?: string }>()
    expect(stored?.resumeId).toBeUndefined()

    const [row] = await applications.listApplications(MALLORY)
    expect(row.resumeTitle).toBeUndefined()
  })

  it('board configuration is per user', async () => {
    await seedAlice()
    const alice = await board.getOrCreateBoardConfig(ALICE)
    const mallory = await board.getOrCreateBoardConfig(MALLORY)
    expect(String(alice._id)).not.toBe(String(mallory._id))
    expect(mallory.userId).toBe(MALLORY)
  })
})

describe('cross-user isolation: job search', () => {
  it('Mallory cannot read, change or delete Alice’s profile, and deleting fails without cascading', async () => {
    const { profileId, jobId, ruleId } = await seedAlice()

    expect(await profiles.getJobSearchProfile(MALLORY, profileId)).toBeNull()
    expect(await profiles.listJobSearchProfiles(MALLORY)).toEqual([])
    expect(await profiles.updateJobSearchProfile(MALLORY, profileId, { name: 'pwned' })).toBeNull()
    expect(await profiles.deleteJobSearchProfile(MALLORY, profileId)).toBe(false)

    // The cascade in deleteJobSearchProfile must not have run.
    expect(await ScrapedJob.countDocuments({ _id: jobId })).toBe(1)
    expect(await rules.getJobSearchRule(ALICE, ruleId)).not.toBeNull()
  })

  it('Mallory cannot attach Alice’s profile to her own rule, or touch Alice’s rule', async () => {
    const { profileId, ruleId } = await seedAlice()

    const stolen = await rules.createJobSearchRule(
      MALLORY,
      CreateJobSearchRuleSchema.parse({ profileId, name: 'x', conditions: CONDITIONS, action: 'notify' })
    )
    expect(stolen).toBeNull()
    expect(await rules.getJobSearchRule(MALLORY, ruleId)).toBeNull()
    expect(await rules.listRulesForProfile(MALLORY, profileId)).toEqual([])
    expect(await rules.updateJobSearchRule(MALLORY, ruleId, { name: 'pwned' })).toBeNull()
    expect(await rules.deleteJobSearchRule(MALLORY, ruleId)).toBe(false)
  })

  it('Mallory cannot see, act on or delete Alice’s scraped jobs', async () => {
    const { profileId, jobId, resumeId } = await seedAlice()

    expect((await scraped.listPipelineJobs(MALLORY, { stage: 'matched' } as never)).items).toEqual([])
    expect((await scraped.listPipelineJobs(MALLORY, { stage: 'matched', profileId } as never)).items).toEqual([])
    expect(await scraped.listNewScrapedJobs(MALLORY, profileId)).toEqual([])
    expect(await scraped.countUnreadNotifyMatches(MALLORY)).toBe(0)
    expect(await scraped.countUnreadNotifyMatches(MALLORY, profileId)).toBe(0)

    expect(await scraped.setScrapedJobDismissed(MALLORY, jobId, true)).toBe(false)
    expect((await scraped.approveScrapedJob(MALLORY, jobId)).ok).toBe(false)
    expect((await scraped.convertScrapedJobToApplication(MALLORY, jobId)).ok).toBe(false)
    expect(await scraped.markScrapedJobDrafted(MALLORY, jobId, {} as never)).toBe(false)
    expect((await scraped.deleteScrapedJob(MALLORY, jobId)).deleted).toBe(false)
    expect(await scraped.deleteScrapedJobsByIds(MALLORY, [jobId])).toBe(0)
    await scraped.markNotifyMatchesRead(MALLORY)

    const stored = await ScrapedJob.findById(jobId).lean<{ status: string; deletedAt?: Date; pendingApprovals: string[] }>()
    expect(stored).toMatchObject({ status: 'new', pendingApprovals: ['led a team of 12'] })
    expect(stored?.deletedAt).toBeUndefined()
    // deleteScrapedJob removes the draft résumé it points at; a refused
    // delete must leave Alice's résumé alone.
    expect(await Resume.countDocuments({ _id: resumeId })).toBe(1)
    expect(await Application.countDocuments({ userId: MALLORY })).toBe(0)
  })

  it('Alice still sees her own data after every attempt', async () => {
    const { profileId } = await seedAlice()
    expect(await resumes.listResumes(ALICE)).toHaveLength(1)
    expect(await applications.listApplications(ALICE)).toHaveLength(1)
    expect(await profiles.listJobSearchProfiles(ALICE)).toHaveLength(1)
    expect(await scraped.countUnreadNotifyMatches(ALICE, profileId)).toBe(1)
  })
})
