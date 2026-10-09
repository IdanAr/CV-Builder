// scripts/demo-seed/build.ts
// Turns the demo content (resumes.ts, tracking.ts) into the exact documents
// that get inserted, with ObjectIds pre-assigned so cross-references
// (application -> resume, profile -> resume, posting -> profile/rule/draft)
// resolve before anything touches the database. Pure: no I/O.
import { Types } from 'mongoose'
import { DEMO_RESUMES } from './resumes'
import {
  DEMO_APPLICATIONS,
  DEMO_BOARD_SORT,
  DEMO_PROFILES,
  DEMO_RULES,
  DEMO_SCRAPED_JOBS,
  applicationCustomFields,
  demoBoardColumns,
} from './tracking'

const DAY = 86_400_000
const STATUS_LABEL: Record<string, string> = {
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
}

type Doc = Record<string, unknown> & { _id: Types.ObjectId }

export interface DemoDocuments {
  resumes: Doc[]
  applications: Doc[]
  applicationActivities: Doc[]
  boardConfigs: Doc[]
  jobSearchProfiles: Doc[]
  jobSearchRules: Doc[]
  scrapedJobs: Doc[]
}

function lookup<T>(map: Map<string, T>, key: string, what: string): T {
  const v = map.get(key)
  if (v === undefined) throw new Error(`Demo data references unknown ${what} "${key}"`)
  return v
}

export function buildDemoDocuments(userId: string, now: Date = new Date()): DemoDocuments {
  const ago = (days: number) => new Date(now.getTime() - days * DAY)

  // --- Resumes -------------------------------------------------------------
  const resumeIds = new Map(DEMO_RESUMES.map((r) => [r.key, new Types.ObjectId()]))
  const resumeTitle = new Map(DEMO_RESUMES.map((r) => [r.key, r.title]))
  const resumes: Doc[] = DEMO_RESUMES.map((r) => ({
    _id: lookup(resumeIds, r.key, 'resume'),
    userId,
    title: r.title,
    data: r.data,
    meta: r.meta,
    applicationStatus: r.applicationStatus,
    ...(r.targetCompany ? { targetCompany: r.targetCompany } : {}),
    ...(r.targetRole ? { targetRole: r.targetRole } : {}),
    ...(r.parentKey ? { parentResumeId: String(lookup(resumeIds, r.parentKey, 'resume')) } : {}),
    pendingApprovals: r.pendingApprovals ?? [],
    createdAt: ago(r.createdDaysAgo),
    updatedAt: ago(r.updatedDaysAgo),
  }))

  // --- Applications + activity log -----------------------------------------
  const applications: Doc[] = []
  const applicationActivities: Doc[] = []
  const byAge = [...DEMO_APPLICATIONS].sort((a, b) => b.timeline[0].daysAgo - a.timeline[0].daysAgo)
  byAge.forEach((app, i) => {
    const _id = new Types.ObjectId()
    const first = app.timeline[0]
    const last = app.timeline[app.timeline.length - 1]
    applications.push({
      _id,
      userId,
      ...(app.resumeKey ? { resumeId: String(lookup(resumeIds, app.resumeKey, 'resume')) } : {}),
      company: app.company,
      role: app.role,
      status: last.status,
      order: (i + 1) * 1000,
      customFields: applicationCustomFields(app, now),
      createdAt: ago(first.daysAgo),
      updatedAt: ago(last.daysAgo),
    })
    for (let t = 1; t < app.timeline.length; t++) {
      applicationActivities.push({
        _id: new Types.ObjectId(),
        applicationId: String(_id),
        userId,
        field: 'status',
        fieldLabel: 'Status',
        fromValue: STATUS_LABEL[app.timeline[t - 1].status],
        toValue: STATUS_LABEL[app.timeline[t].status],
        changedAt: ago(app.timeline[t].daysAgo),
      })
    }
    if (app.resumeKey && app.timeline.length > 1) {
      // One non-status edit so the activity feed shows more than status moves.
      applicationActivities.push({
        _id: new Types.ObjectId(),
        applicationId: String(_id),
        userId,
        field: 'resumeId',
        fieldLabel: 'Resume',
        fromValue: null,
        toValue: lookup(resumeTitle, app.resumeKey, 'resume'),
        changedAt: new Date(ago(first.daysAgo).getTime() + 60_000),
      })
    }
  })

  // --- Board config ----------------------------------------------------------
  const boardConfigs: Doc[] = [
    {
      _id: new Types.ObjectId(),
      userId,
      columns: demoBoardColumns(),
      sort: DEMO_BOARD_SORT,
      createdAt: ago(40),
      updatedAt: ago(10),
    },
  ]

  // --- Job-search profiles and rules ------------------------------------------
  const profileIds = new Map(DEMO_PROFILES.map((p) => [p.key, new Types.ObjectId()]))
  const jobSearchProfiles: Doc[] = DEMO_PROFILES.map((p) => ({
    _id: lookup(profileIds, p.key, 'profile'),
    userId,
    name: p.name,
    resumeId: String(lookup(resumeIds, p.resumeKey, 'resume')),
    roles: p.roles,
    workModes: p.workModes,
    locations: p.locations,
    seniority: p.seniority,
    categories: p.categories,
    industries: p.industries,
    comeetCompanies: [],
    recencyDays: p.recencyDays,
    minAtsScore: p.minAtsScore,
    isActive: p.isActive,
    createdAt: ago(p.createdDaysAgo),
    updatedAt: ago(Math.max(1, p.createdDaysAgo - 5)),
  }))

  const ruleIds = new Map(DEMO_RULES.map((r) => [r.key, new Types.ObjectId()]))
  const jobSearchRules: Doc[] = DEMO_RULES.map((r) => ({
    _id: lookup(ruleIds, r.key, 'rule'),
    userId,
    profileId: r.profileKey ? String(lookup(profileIds, r.profileKey, 'profile')) : null,
    name: r.name,
    isActive: r.isActive,
    order: r.order,
    conditions: r.conditions,
    action: r.action,
    createdAt: ago(28),
    updatedAt: ago(20),
  }))

  // --- Pipeline postings ----------------------------------------------------
  const scrapedJobs: Doc[] = DEMO_SCRAPED_JOBS.map((j) => ({
    _id: new Types.ObjectId(),
    userId,
    profileId: String(lookup(profileIds, j.profileKey, 'profile')),
    source: 'freehire',
    sourceId: j.sourceId,
    title: j.title,
    company: j.company,
    location: j.location,
    url: j.url,
    description: j.description,
    postedAt: ago(j.postedDaysAgo),
    workMode: j.workMode,
    firstSeenAt: ago(j.firstSeenDaysAgo),
    atsScore: j.atsScore,
    matchedRules: j.ruleKeys.map((k) => String(lookup(ruleIds, k, 'rule'))),
    resolvedActions: j.resolvedActions,
    ...(j.draftResumeKey ? { draftResumeId: String(lookup(resumeIds, j.draftResumeKey, 'resume')) } : {}),
    ...(j.postTailorScore !== undefined ? { postTailorScore: j.postTailorScore } : {}),
    pendingApprovals: j.pendingApprovals ?? [],
    tailoredKeywords: j.tailoredKeywords ?? [],
    ...(j.draftedDaysAgo !== undefined ? { draftedAt: ago(j.draftedDaysAgo) } : {}),
    status: j.status,
    createdAt: ago(j.firstSeenDaysAgo),
    updatedAt: ago(Math.max(0, j.firstSeenDaysAgo - 1)),
  }))

  return {
    resumes,
    applications,
    applicationActivities,
    boardConfigs,
    jobSearchProfiles,
    jobSearchRules,
    scrapedJobs,
  }
}
