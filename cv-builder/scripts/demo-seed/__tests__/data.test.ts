// Validates the demo seed data against the app's own Zod schemas and
// invariants, without a database: everything the seed inserts must be
// something the app itself could have written.
import { describe, it, expect } from 'vitest'
import { CreateResumeSchema, ResumeDataSchema } from '@/lib/schemas/resume.zod'
import {
  BoardColumnSchema,
  BUILT_IN_COLUMN_IDS,
  CreateApplicationSchema,
  CustomFieldsSchema,
  SortEntrySchema,
} from '@/lib/schemas/application.zod'
import { JobSearchProfileSchema, JobSearchRuleSchema, ScrapedJobSchema } from '@/lib/schemas/jobsearch.zod'
import { PIPELINE_FILTERS, stageOf } from '@/lib/jobsearch/stages'
import { buildDemoDocuments } from '../build'
import { DEMO_RESUMES, FRIEND_IDENTITIES } from '../resumes'
import { JOB_LOCATION_COLUMN_ID, JOB_URL_COLUMN_ID } from '../tracking'

const USER = '6ac88905b880e0a741e35ef3'
const NOW = new Date('2026-10-09T08:00:00Z')
const docs = buildDemoDocuments(USER, NOW)
const all = Object.values(docs).flat()

describe('demo seed data', () => {
  it('stamps every document with the demo user', () => {
    for (const d of all) {
      if ('userId' in d) expect(d.userId).toBe(USER)
    }
    expect(all.every((d) => 'userId' in d)).toBe(true)
  })

  it('produces résumés the app schema accepts unchanged', () => {
    for (const r of docs.resumes) {
      const parsed = CreateResumeSchema.parse({
        title: r.title,
        data: r.data,
        meta: r.meta,
        applicationStatus: r.applicationStatus,
        targetCompany: r.targetCompany,
        targetRole: r.targetRole,
        pendingApprovals: r.pendingApprovals,
      })
      // ResumeDataSchema strips unknown keys; equality proves there were none.
      expect(ResumeDataSchema.parse(r.data)).toEqual(r.data)
      expect(parsed.meta).toEqual(r.meta)
    }
  })

  it('only references custom sections that exist', () => {
    for (const r of DEMO_RESUMES) {
      const ids = new Set((r.data.customSections ?? []).map((s) => `custom:${s.id}`))
      for (const key of r.meta.sectionOrder.filter((k) => k.startsWith('custom:'))) {
        expect(ids.has(key)).toBe(true)
      }
    }
  })

  it('uses placeholder identities for the three friend CVs', () => {
    const friends = DEMO_RESUMES.filter((r) => r.key.startsWith('friend-'))
    expect(friends).toHaveLength(3)
    const placeholders = Object.values(FRIEND_IDENTITIES)
    for (const f of friends) {
      const p = placeholders.find((x) => x.name === f.data.basics?.name)
      expect(p).toBeDefined()
      expect(f.data.basics?.email).toBe(p!.email)
      expect(f.data.basics?.phone).toBe(p!.phone)
    }
  })

  it('builds a valid board config', () => {
    const [config] = docs.boardConfigs as unknown as Array<{ columns: unknown[]; sort: unknown[] }>
    const columns = config.columns.map((c) => BoardColumnSchema.parse(c))
    const ids = columns.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const b of BUILT_IN_COLUMN_IDS) expect(ids).toContain(b)
    for (const c of columns) {
      if (c.type === 'select' || c.type === 'status') expect(c.options?.length).toBeGreaterThan(0)
    }
    config.sort.forEach((s) => SortEntrySchema.parse(s))
  })

  it('builds applications whose status, custom fields and resume links are valid', () => {
    const [config] = docs.boardConfigs as unknown as Array<{ columns: Array<{ id: string; type: string; options?: Array<{ id: string }> }> }>
    const byId = new Map(config.columns.map((c) => [c.id, c]))
    const statusIds = byId.get('status')!.options!.map((o) => o.id)
    const resumeIds = new Set(docs.resumes.map((r) => String(r._id)))
    for (const a of docs.applications) {
      CreateApplicationSchema.parse({ company: a.company, role: a.role, status: a.status, resumeId: a.resumeId, customFields: a.customFields })
      expect(statusIds).toContain(a.status)
      if (a.resumeId) expect(resumeIds.has(a.resumeId as string)).toBe(true)
      const fields = CustomFieldsSchema.parse(a.customFields)
      for (const [key, value] of Object.entries(fields)) {
        const col = byId.get(key)
        expect(col, `custom field "${key}" has no column`).toBeDefined()
        if (col!.type === 'select') expect(col!.options!.map((o) => o.id)).toContain(value)
        if (col!.type === 'date') expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        if (col!.type === 'checkbox') expect(typeof value).toBe('boolean')
      }
      expect((a.createdAt as Date) <= NOW).toBe(true)
    }
    const appIds = new Set(docs.applications.map((a) => String(a._id)))
    for (const act of docs.applicationActivities) expect(appIds.has(act.applicationId as string)).toBe(true)
  })

  it('builds valid profiles, rules and postings with resolvable references', () => {
    const resumeIds = new Set(docs.resumes.map((r) => String(r._id)))
    const profileIds = new Set(docs.jobSearchProfiles.map((p) => String(p._id)))
    const ruleIds = new Set(docs.jobSearchRules.map((r) => String(r._id)))
    for (const p of docs.jobSearchProfiles) {
      JobSearchProfileSchema.parse(p)
      expect(resumeIds.has(p.resumeId as string)).toBe(true)
    }
    for (const r of docs.jobSearchRules) {
      JobSearchRuleSchema.parse(r)
      if (r.profileId) expect(profileIds.has(r.profileId as string)).toBe(true)
    }
    for (const j of docs.scrapedJobs) {
      ScrapedJobSchema.parse(j)
      expect(profileIds.has(j.profileId as string)).toBe(true)
      for (const id of j.matchedRules as string[]) expect(ruleIds.has(id)).toBe(true)
      if (j.draftResumeId) expect(resumeIds.has(j.draftResumeId as string)).toBe(true)
    }
  })

  it('puts at least one posting in every pipeline stage and the archive', () => {
    const stages = new Set(
      docs.scrapedJobs.map((j) =>
        stageOf({ status: j.status as never, resolvedActions: j.resolvedActions as string[] })
      )
    )
    for (const f of PIPELINE_FILTERS) expect(stages.has(f)).toBe(true)
  })

  it('keeps the job metadata column ids in sync with the app', async () => {
    process.env.MONGODB_URI ??= 'mongodb://placeholder/test'
    const boardConfig = await import('@/lib/api/board-config')
    expect(JOB_URL_COLUMN_ID).toBe(boardConfig.JOB_URL_COLUMN_ID)
    expect(JOB_LOCATION_COLUMN_ID).toBe(boardConfig.JOB_LOCATION_COLUMN_ID)
  })
})
