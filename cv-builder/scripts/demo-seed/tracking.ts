// scripts/demo-seed/tracking.ts
// Application tracking, job-search profiles, rules and pipeline postings for
// the demo account. Pure data: no database access here. Cross-references use
// string keys (resume keys from resumes.ts, profile and rule keys below) that
// seed.ts resolves to real ObjectIds at insert time.
import type { BoardColumn, CustomFieldValue } from '@/lib/schemas/application.zod'
import { defaultBoardColumns } from '@/lib/schemas/application.zod'
import type { RuleAction, RuleCondition, ScrapedJobStatus, WorkMode } from '@/lib/schemas/jobsearch.zod'

// Same ids as JOB_URL_COLUMN_ID / JOB_LOCATION_COLUMN_ID in lib/api/board-config.ts,
// so "Mark as applied" from the pipeline writes into these columns rather than
// adding duplicates. Restated (not imported) because board-config pulls in
// lib/db.ts, which throws at import time without MONGODB_URI; a test asserts
// the two stay equal.
export const JOB_URL_COLUMN_ID = 'jobUrl'
export const JOB_LOCATION_COLUMN_ID = 'jobLocation'

// ---------------------------------------------------------------------------
// Board config: the five built-ins plus a few custom columns
// ---------------------------------------------------------------------------

export const SOURCE_OPTIONS = [
  { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2' },
  { id: 'referral', label: 'Referral', color: '#8b5cf6' },
  { id: 'careers', label: 'Company site', color: '#64748b' },
  { id: 'cvitae', label: 'CVitae pipeline', color: '#2F5BFF' },
] as const
type SourceId = (typeof SOURCE_OPTIONS)[number]['id']

export function demoBoardColumns(): BoardColumn[] {
  return [
    ...defaultBoardColumns(),
    { id: JOB_URL_COLUMN_ID, key: JOB_URL_COLUMN_ID, label: 'Job URL', type: 'url', isBuiltIn: false, order: 6000 },
    { id: JOB_LOCATION_COLUMN_ID, key: JOB_LOCATION_COLUMN_ID, label: 'Location', type: 'text', isBuiltIn: false, order: 7000 },
    {
      id: 'source',
      key: 'source',
      label: 'Source',
      type: 'select',
      isBuiltIn: false,
      order: 8000,
      options: SOURCE_OPTIONS.map((o) => ({ ...o })),
    },
    { id: 'nextStep', key: 'nextStep', label: 'Next step', type: 'text', isBuiltIn: false, order: 9000 },
    { id: 'followUp', key: 'followUp', label: 'Follow up', type: 'date', isBuiltIn: false, order: 10000 },
    { id: 'referral', key: 'referral', label: 'Referred', type: 'checkbox', isBuiltIn: false, order: 11000 },
  ]
}

export const DEMO_BOARD_SORT = [{ columnId: 'createdAt', direction: 'desc' as const }]

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

type Status = 'applied' | 'interviewing' | 'offer' | 'rejected'

export interface DemoApplication {
  company: string
  role: string
  resumeKey?: string
  /** Status timeline. The first entry is the initial status at creation. */
  timeline: Array<{ status: Status; daysAgo: number }>
  location: string
  source: SourceId
  url?: string
  nextStep?: string
  /** Days from now (negative = overdue). */
  followUpInDays?: number
  referral?: boolean
}

export const DEMO_APPLICATIONS: DemoApplication[] = [
  {
    company: 'Forter',
    role: 'Data Solutions Engineer, Fraud',
    resumeKey: 'idan-master',
    timeline: [
      { status: 'applied', daysAgo: 38 },
      { status: 'interviewing', daysAgo: 31 },
      { status: 'offer', daysAgo: 2 },
    ],
    location: 'Tel Aviv (hybrid)',
    source: 'referral',
    referral: true,
    nextStep: 'Review offer and reply',
    followUpInDays: 3,
  },
  {
    company: 'monday.com',
    role: 'Senior Data Engineer',
    resumeKey: 'idan-monday',
    timeline: [
      { status: 'applied', daysAgo: 20 },
      { status: 'interviewing', daysAgo: 12 },
    ],
    location: 'Tel Aviv (hybrid)',
    source: 'cvitae',
    url: 'https://monday.com/careers',
    nextStep: 'System design interview',
    followUpInDays: 2,
  },
  {
    company: 'Riskified',
    role: 'Senior Data Scientist, Fraud Detection',
    resumeKey: 'idan-master',
    timeline: [
      { status: 'applied', daysAgo: 27 },
      { status: 'interviewing', daysAgo: 18 },
    ],
    location: 'Tel Aviv',
    source: 'linkedin',
    url: 'https://www.riskified.com/careers/',
    nextStep: 'Home assignment due',
    followUpInDays: 1,
  },
  {
    company: 'Snowflake',
    role: 'Solutions Architect',
    resumeKey: 'idan-master',
    timeline: [
      { status: 'applied', daysAgo: 24 },
      { status: 'interviewing', daysAgo: 10 },
    ],
    location: 'Tel Aviv (hybrid)',
    source: 'linkedin',
    nextStep: 'Hiring manager call',
    followUpInDays: 5,
  },
  {
    company: 'Databricks',
    role: 'Solutions Architect',
    resumeKey: 'idan-master',
    timeline: [
      { status: 'applied', daysAgo: 16 },
      { status: 'interviewing', daysAgo: 7 },
    ],
    location: 'Tel Aviv',
    source: 'referral',
    referral: true,
    nextStep: 'Technical screen',
    followUpInDays: 4,
  },
  {
    company: 'Lightricks',
    role: 'GenAI Engineer',
    resumeKey: 'idan-genai',
    timeline: [{ status: 'applied', daysAgo: 9 }],
    location: 'Jerusalem (hybrid)',
    source: 'careers',
    url: 'https://www.lightricks.com/careers',
    nextStep: 'Waiting for recruiter',
    followUpInDays: -1,
  },
  {
    company: 'Wix',
    role: 'Data Solutions Architect',
    resumeKey: 'idan-master',
    timeline: [{ status: 'applied', daysAgo: 5 }],
    location: 'Tel Aviv',
    source: 'cvitae',
    url: 'https://www.wix.com/jobs',
  },
  {
    company: 'NVIDIA',
    role: 'Data Architect',
    resumeKey: 'idan-master',
    timeline: [{ status: 'applied', daysAgo: 6 }],
    location: "Yokne'am (hybrid)",
    source: 'linkedin',
    followUpInDays: 6,
  },
  {
    company: 'Microsoft',
    role: 'Cloud Solution Architect, Data & AI',
    resumeKey: 'idan-genai',
    timeline: [{ status: 'applied', daysAgo: 4 }],
    location: 'Herzliya',
    source: 'careers',
  },
  {
    company: 'Fiverr',
    role: 'Analytics Engineer',
    resumeKey: 'idan-monday',
    timeline: [{ status: 'applied', daysAgo: 3 }],
    location: 'Tel Aviv',
    source: 'linkedin',
  },
  {
    company: 'AI21 Labs',
    role: 'Applied AI Engineer',
    resumeKey: 'idan-genai',
    timeline: [
      { status: 'applied', daysAgo: 29 },
      { status: 'interviewing', daysAgo: 22 },
      { status: 'rejected', daysAgo: 14 },
    ],
    location: 'Tel Aviv',
    source: 'careers',
  },
  {
    company: 'Google',
    role: 'Customer Engineer, Data Analytics',
    resumeKey: 'idan-master',
    timeline: [
      { status: 'applied', daysAgo: 34 },
      { status: 'rejected', daysAgo: 25 },
    ],
    location: 'Tel Aviv',
    source: 'linkedin',
  },
  {
    company: 'Payoneer',
    role: 'Senior BI Developer',
    resumeKey: 'idan-master',
    timeline: [
      { status: 'applied', daysAgo: 36 },
      { status: 'rejected', daysAgo: 19 },
    ],
    location: 'Petah Tikva',
    source: 'linkedin',
  },
]

export function applicationCustomFields(app: DemoApplication, now: Date): Record<string, CustomFieldValue> {
  const fields: Record<string, CustomFieldValue> = {
    [JOB_LOCATION_COLUMN_ID]: app.location,
    source: app.source,
  }
  if (app.url) fields[JOB_URL_COLUMN_ID] = app.url
  if (app.nextStep) fields.nextStep = app.nextStep
  if (app.followUpInDays !== undefined) {
    const d = new Date(now.getTime() + app.followUpInDays * 86_400_000)
    fields.followUp = d.toISOString().slice(0, 10)
  }
  if (app.referral) fields.referral = true
  return fields
}

// ---------------------------------------------------------------------------
// Job-search profiles and rules
// ---------------------------------------------------------------------------

export interface DemoProfile {
  key: string
  name: string
  resumeKey: string
  roles: string[]
  workModes: WorkMode[]
  locations: Array<{ country?: string; region?: string; city?: string }>
  seniority: Array<'junior' | 'middle' | 'senior' | 'staff' | 'principal' | 'lead'>
  categories: string[]
  industries: string[]
  recencyDays: number
  minAtsScore: number
  isActive: boolean
  createdDaysAgo: number
}

export const DEMO_PROFILES: DemoProfile[] = [
  {
    key: 'architect',
    name: 'Data & AI Architect - Tel Aviv',
    resumeKey: 'idan-master',
    roles: ['Data Solutions Architect', 'Data Architect', 'Solutions Architect'],
    workModes: ['hybrid', 'onsite'],
    locations: [{ country: 'Israel', city: 'Tel Aviv' }, { country: 'Israel', city: 'Herzliya' }],
    seniority: ['senior', 'lead'],
    categories: ['Data', 'Engineering'],
    industries: ['Fintech', 'Cybersecurity', 'SaaS'],
    recencyDays: 14,
    minAtsScore: 75,
    isActive: true,
    createdDaysAgo: 30,
  },
  {
    key: 'genai',
    name: 'GenAI Engineer',
    resumeKey: 'idan-genai',
    roles: ['GenAI Engineer', 'Applied AI Engineer', 'LLM Engineer'],
    workModes: ['remote', 'hybrid'],
    locations: [{ country: 'Israel' }],
    seniority: ['middle', 'senior'],
    categories: ['AI', 'Engineering'],
    industries: ['AI', 'Developer tools'],
    recencyDays: 7,
    minAtsScore: 70,
    isActive: true,
    createdDaysAgo: 25,
  },
  {
    key: 'dataeng',
    name: 'Senior Data Engineer (paused)',
    resumeKey: 'idan-monday',
    roles: ['Senior Data Engineer', 'Data Platform Engineer', 'Analytics Engineer'],
    workModes: ['hybrid'],
    locations: [{ country: 'Israel', city: 'Tel Aviv' }],
    seniority: ['senior'],
    categories: ['Data'],
    industries: [],
    recencyDays: 14,
    minAtsScore: 80,
    isActive: false,
    createdDaysAgo: 22,
  },
]

export interface DemoRule {
  key: string
  /** null = applies to every profile. */
  profileKey: string | null
  name: string
  isActive: boolean
  order: number
  conditions: RuleCondition[]
  action: RuleAction
}

export const DEMO_RULES: DemoRule[] = [
  {
    key: 'strong-match',
    profileKey: null,
    name: 'Notify me on strong matches',
    isActive: true,
    order: 0,
    conditions: [
      { field: 'atsScore', op: 'gte', value: 80 },
      { field: 'postedWithinDays', op: 'lte', value: 7 },
    ],
    action: 'notify',
  },
  {
    key: 'auto-draft',
    profileKey: 'architect',
    name: 'Auto-tailor for top companies',
    isActive: true,
    order: 1,
    conditions: [
      { field: 'atsScore', op: 'gte', value: 85 },
      {
        field: 'company',
        op: 'in',
        value: ['Cato Networks', 'Bright Data', 'monday.com', 'Wix', 'Similarweb', 'Rapyd'],
      },
    ],
    action: 'draft_and_queue',
  },
  {
    key: 'skip-junior',
    profileKey: null,
    name: 'Skip junior and intern roles',
    isActive: true,
    order: 2,
    conditions: [{ field: 'title', op: 'contains', value: 'Junior' }],
    action: 'ignore',
  },
]

// ---------------------------------------------------------------------------
// Pipeline postings (ScrapedJob): at least one in every funnel stage
// ---------------------------------------------------------------------------

export interface DemoScrapedJob {
  sourceId: string
  profileKey: string
  title: string
  company: string
  location: string
  workMode: WorkMode
  url: string
  description: string
  postedDaysAgo: number
  firstSeenDaysAgo: number
  atsScore: number
  status: ScrapedJobStatus
  ruleKeys: string[]
  resolvedActions: Array<'notify' | 'draft_and_queue'>
  draftResumeKey?: string
  postTailorScore?: number
  pendingApprovals?: string[]
  tailoredKeywords?: string[]
  draftedDaysAgo?: number
}

const jd = (company: string, role: string, focus: string, stack: string) =>
  `${company} is hiring a ${role} to join its data organization in Israel. You will ${focus}.\n\nWhat you bring:\n- 4+ years of hands-on experience in data engineering, analytics or solutions architecture\n- Strong SQL and Python\n- Experience with ${stack}\n- Ability to work with stakeholders across product, engineering and the business\n\nNice to have: experience with ML in production and with LLM-based tools.`

export const DEMO_SCRAPED_JOBS: DemoScrapedJob[] = [
  // Found: matched the profile query, no rule fired
  {
    sourceId: 'demo-taboola-data-engineer',
    profileKey: 'architect',
    title: 'Data Engineer',
    company: 'Taboola',
    location: 'Tel Aviv, Israel',
    workMode: 'hybrid',
    url: 'https://www.taboola.com/careers',
    description: jd('Taboola', 'Data Engineer', 'build and scale batch and streaming pipelines that power recommendation analytics', 'Spark, Airflow and cloud data warehouses'),
    postedDaysAgo: 3,
    firstSeenDaysAgo: 2,
    atsScore: 71,
    status: 'new',
    ruleKeys: [],
    resolvedActions: [],
  },
  {
    sourceId: 'demo-melio-analytics-engineer',
    profileKey: 'architect',
    title: 'Analytics Engineer',
    company: 'Melio',
    location: 'Tel Aviv, Israel',
    workMode: 'hybrid',
    url: 'https://meliopayments.com/careers',
    description: jd('Melio', 'Analytics Engineer', 'own the semantic layer and core business models used by finance and product', 'dbt, Snowflake and BI tools such as Tableau or Looker'),
    postedDaysAgo: 5,
    firstSeenDaysAgo: 4,
    atsScore: 76,
    status: 'notified',
    ruleKeys: [],
    resolvedActions: [],
  },
  // Matched: a notify rule fired (status 'new' = unread badge)
  {
    sourceId: 'demo-rapyd-fraud-ds',
    profileKey: 'architect',
    title: 'Senior Data Scientist, Fraud & Risk',
    company: 'Rapyd',
    location: 'Tel Aviv, Israel',
    workMode: 'hybrid',
    url: 'https://www.rapyd.net/company/careers/',
    description: jd('Rapyd', 'Senior Data Scientist, Fraud & Risk', 'design detection models that catch suspicious merchant and payment patterns', 'anomaly detection, scikit-learn and large financial datasets'),
    postedDaysAgo: 1,
    firstSeenDaysAgo: 0,
    atsScore: 84,
    status: 'new',
    ruleKeys: ['strong-match'],
    resolvedActions: ['notify'],
  },
  {
    sourceId: 'demo-similarweb-dsa',
    profileKey: 'architect',
    title: 'Data Solutions Architect',
    company: 'Similarweb',
    location: 'Tel Aviv, Israel',
    workMode: 'hybrid',
    url: 'https://www.similarweb.com/corp/careers/',
    description: jd('Similarweb', 'Data Solutions Architect', 'design data delivery solutions for enterprise customers and guide integrations end to end', 'data integration, REST APIs and cloud platforms'),
    postedDaysAgo: 2,
    firstSeenDaysAgo: 1,
    atsScore: 83,
    status: 'new',
    ruleKeys: ['strong-match'],
    resolvedActions: ['notify'],
  },
  {
    sourceId: 'demo-hibob-senior-data-analyst',
    profileKey: 'architect',
    title: 'Senior Data Analyst',
    company: 'HiBob',
    location: 'Tel Aviv, Israel',
    workMode: 'onsite',
    url: 'https://www.hibob.com/careers/',
    description: jd('HiBob', 'Senior Data Analyst', 'turn product and revenue data into decisions for go-to-market leadership', 'Tableau, Salesforce data and SQL-based modeling'),
    postedDaysAgo: 4,
    firstSeenDaysAgo: 3,
    atsScore: 81,
    status: 'notified',
    ruleKeys: ['strong-match'],
    resolvedActions: ['notify'],
  },
  // Drafted: tailored draft waiting for review (hallucination guard flagged a term)
  {
    sourceId: 'demo-cato-data-platform',
    profileKey: 'architect',
    title: 'Data Platform Engineer',
    company: 'Cato Networks',
    location: 'Tel Aviv, Israel',
    workMode: 'hybrid',
    url: 'https://www.catonetworks.com/careers/',
    description: jd('Cato Networks', 'Data Platform Engineer', 'build the platform that ingests and serves security telemetry at scale', 'Kafka, distributed ETL and multi-cloud environments'),
    postedDaysAgo: 2,
    firstSeenDaysAgo: 1,
    atsScore: 86,
    status: 'needs_review',
    ruleKeys: ['strong-match', 'auto-draft'],
    resolvedActions: ['notify', 'draft_and_queue'],
    draftResumeKey: 'idan-cato-draft',
    postTailorScore: 92,
    pendingApprovals: ['Kafka'],
    tailoredKeywords: ['data platform', 'ETL', 'multi-cloud', 'Kafka'],
    draftedDaysAgo: 1,
  },
  // Ready: tailored, approved, waiting to be sent
  {
    sourceId: 'demo-brightdata-ai-solutions',
    profileKey: 'genai',
    title: 'AI Solutions Engineer',
    company: 'Bright Data',
    location: 'Netanya, Israel',
    workMode: 'hybrid',
    url: 'https://brightdata.com/careers',
    description: jd('Bright Data', 'AI Solutions Engineer', 'help customers build LLM and RAG applications on top of web data', 'LangChain, RAG pipelines and Python APIs'),
    postedDaysAgo: 3,
    firstSeenDaysAgo: 2,
    atsScore: 87,
    status: 'queued',
    ruleKeys: ['strong-match'],
    resolvedActions: ['notify', 'draft_and_queue'],
    draftResumeKey: 'idan-genai',
    postTailorScore: 93,
    tailoredKeywords: ['RAG', 'LangChain', 'LLM applications'],
    draftedDaysAgo: 2,
  },
  // Applied: converted to applications (matching rows exist in DEMO_APPLICATIONS)
  {
    sourceId: 'demo-monday-senior-de',
    profileKey: 'dataeng',
    title: 'Senior Data Engineer',
    company: 'monday.com',
    location: 'Tel Aviv, Israel',
    workMode: 'hybrid',
    url: 'https://monday.com/careers',
    description: jd('monday.com', 'Senior Data Engineer', 'own core data pipelines and the data lake behind product analytics', 'ETL orchestration, data lakes and SQL performance tuning'),
    postedDaysAgo: 24,
    firstSeenDaysAgo: 23,
    atsScore: 85,
    status: 'submitted',
    ruleKeys: ['strong-match', 'auto-draft'],
    resolvedActions: ['notify', 'draft_and_queue'],
    draftResumeKey: 'idan-monday',
    postTailorScore: 91,
    tailoredKeywords: ['data lake', 'ETL', 'query performance'],
    draftedDaysAgo: 22,
  },
  {
    sourceId: 'demo-wix-dsa',
    profileKey: 'architect',
    title: 'Data Solutions Architect',
    company: 'Wix',
    location: 'Tel Aviv, Israel',
    workMode: 'hybrid',
    url: 'https://www.wix.com/jobs',
    description: jd('Wix', 'Data Solutions Architect', 'shape how data is modeled and integrated across business domains', 'data modeling, ETL and stakeholder-facing architecture work'),
    postedDaysAgo: 8,
    firstSeenDaysAgo: 7,
    atsScore: 88,
    status: 'submitted',
    ruleKeys: ['strong-match', 'auto-draft'],
    resolvedActions: ['notify', 'draft_and_queue'],
    draftResumeKey: 'idan-master',
    postTailorScore: 90,
    tailoredKeywords: ['data modeling', 'architecture'],
    draftedDaysAgo: 6,
  },
  // Archive: dismissed
  {
    sourceId: 'demo-playtika-bi',
    profileKey: 'architect',
    title: 'BI Developer',
    company: 'Playtika',
    location: 'Herzliya, Israel',
    workMode: 'onsite',
    url: 'https://www.playtika.com/careers/',
    description: jd('Playtika', 'BI Developer', 'build reporting for live game operations', 'Tableau and SQL'),
    postedDaysAgo: 12,
    firstSeenDaysAgo: 11,
    atsScore: 72,
    status: 'dismissed',
    ruleKeys: [],
    resolvedActions: [],
  },
]
