// scripts/demo-seed/resumes.ts
// Résumé content for the demo account.
//
// This repository is public, so the CVs committed here are fictional sample
// content. Real CV content goes in a local file next to this one,
// `demo-content.local.json`, which is git-ignored (the `*.local.json` rule in
// .gitignore). When that file exists the seed uses it instead of the samples.
//
// Its shape is `{ "resumes": DemoResume[] }` and it must define every key in
// REQUIRED_RESUME_KEYS, because tracking.ts links applications, profiles and
// pipeline postings to résumés by those keys.
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { ApplicationStatusEnum, ResumeDataSchema, ResumeMetaSchema } from '@/lib/schemas/resume.zod'

export interface DemoResume {
  key: string
  title: string
  data: ResumeData
  meta: ResumeMeta
  applicationStatus: 'draft' | 'applied' | 'interviewing' | 'offer' | 'rejected'
  targetCompany?: string
  targetRole?: string
  /** Key of another DemoResume this one was tailored from. */
  parentKey?: string
  pendingApprovals?: string[]
  /** Days before "now" the document was created / last edited. */
  createdDaysAgo: number
  updatedDaysAgo: number
}

/** master = the persona's main CV; genai/dataeng = tailored versions; platform-draft = a pipeline draft held for review; sales/gis/investor = extra CVs in the library. */
export const REQUIRED_RESUME_KEYS = ['master', 'genai', 'dataeng', 'platform-draft', 'sales', 'gis', 'investor'] as const

// Relative to cv-builder/, where the seed is run from (see scripts/seed-demo.ts).
export const LOCAL_CONTENT_PATH = path.join(process.cwd(), 'scripts', 'demo-seed', 'demo-content.local.json')

const meta = (overrides: Partial<ResumeMeta>): ResumeMeta => ResumeMetaSchema.parse(overrides)

// ---------------------------------------------------------------------------
// Fictional sample content (committed)
// ---------------------------------------------------------------------------

const persona = {
  name: 'Noa Levi',
  label: 'Data & AI Solutions Architect',
  email: 'noa.levi@example.com',
  phone: '050-000-0000',
  location: { city: 'Tel Aviv', countryCode: 'IL' },
}

const northwind = {
  name: 'Northwind Analytics',
  position: 'Data Solutions Architect',
  startDate: '2022-07',
  endDate: 'Present',
  highlights: [
    'Designed a multi-cloud data integration layer serving 40+ downstream reports with 99% uptime',
    'Built anomaly-detection models that flag suspicious vendor payments, cutting manual review time by a third',
    'Introduced CI checks for SQL and ETL jobs, reducing failed nightly loads from weekly to rare',
  ],
}

const contoso = {
  name: 'Contoso Security',
  position: 'Revenue Operations Data Analyst',
  startDate: '2020-03',
  endDate: '2022-06',
  highlights: [
    'Built KPI dashboards in Tableau used by sales leadership in three regions',
    'Automated weekly reporting in SQL, saving the team about a day of manual work each week',
  ],
}

const education = [
  { institution: 'Example Institute of Technology', studyType: 'Certificate', area: 'Generative AI & LLMs', startDate: '2025-10', endDate: '2026-06' },
  { institution: 'Example University', studyType: 'B.Sc.', area: 'Industrial Engineering', startDate: '2016-10', endDate: '2020-07' },
]

const skills = [
  { name: 'Data', keywords: ['SQL', 'ETL', 'MongoDB', 'Data modeling'] },
  { name: 'Programming', keywords: ['Python', 'Pandas', 'scikit-learn', 'REST APIs'] },
  { name: 'AI', keywords: ['LLMs', 'RAG', 'LangChain', 'Prompt evaluation'] },
  { name: 'BI', keywords: ['Tableau', 'Looker'] },
]

const languages = [
  { language: 'Hebrew', fluency: 'Native' },
  { language: 'English', fluency: 'Fluent' },
]

const projects = [
  {
    name: 'Budget Lens',
    description: 'Personal finance dashboard that categorizes transactions with an LLM and forecasts monthly spend.',
    keywords: ['LLM', 'Dashboard'],
  },
]

const SAMPLE_RESUMES: DemoResume[] = [
  {
    key: 'master',
    title: 'Noa Levi - Data & AI Solutions Architect',
    applicationStatus: 'draft',
    createdDaysAgo: 48,
    updatedDaysAgo: 3,
    data: {
      basics: {
        ...persona,
        summary:
          'Data solutions architect with 5+ years of experience building ETL pipelines, anomaly-detection models and analytics platforms, now focused on shipping LLM applications.',
      },
      work: [northwind, contoso],
      education,
      skills,
      languages,
      projects,
      customSections: [
        {
          id: 'service',
          name: 'Military Service',
          enabledFields: ['subtitle', 'dateRange', 'highlights'],
          items: [{ id: 'service-1', title: 'Operations Officer', subtitle: 'IDF', startDate: '2012', endDate: '2015', highlights: ['Led a team of 12'] }],
        },
      ],
    },
    meta: meta({
      templateId: 'sidebar',
      headerFontFamily: 'Cambria',
      primaryColor: '#1E2A44',
      accentColor: '#2F5BFF',
      sectionOrder: ['work', 'education', 'projects', 'skills', 'languages', 'custom:service'],
      columnAssignment: { 'custom:service': 'left' },
    }),
  },
  {
    key: 'genai',
    parentKey: 'master',
    title: 'Noa Levi - GenAI Engineer',
    targetRole: 'GenAI Engineer',
    applicationStatus: 'applied',
    createdDaysAgo: 30,
    updatedDaysAgo: 9,
    data: {
      basics: { ...persona, label: 'GenAI Engineer', summary: 'Builds LLM applications end to end, from RAG pipelines to the data foundations they depend on.' },
      projects,
      work: [northwind, contoso],
      skills: [skills[2], skills[1], skills[0]],
      education,
      languages,
    },
    meta: meta({ templateId: 'modern', accentColor: '#2F5BFF', sectionOrder: ['projects', 'work', 'skills', 'education', 'languages'] }),
  },
  {
    key: 'dataeng',
    parentKey: 'master',
    title: 'Noa Levi - Senior Data Engineer (monday.com)',
    targetCompany: 'monday.com',
    targetRole: 'Senior Data Engineer',
    applicationStatus: 'interviewing',
    createdDaysAgo: 21,
    updatedDaysAgo: 6,
    data: {
      basics: { ...persona, label: 'Senior Data Engineer', summary: 'Data engineer focused on reliable ETL, data modeling and fast analytical queries.' },
      work: [northwind, contoso],
      skills: [skills[0], skills[1], skills[3]],
      education,
      languages,
    },
    meta: meta({ templateId: 'classic', accentColor: '#2F5BFF' }),
  },
  {
    // Drafted by the pipeline and held for review: the hallucination guard
    // flagged "Kafka" because it is not in the persona's own text.
    key: 'platform-draft',
    parentKey: 'master',
    title: 'Noa Levi - Data Platform Engineer (Cato Networks)',
    targetCompany: 'Cato Networks',
    targetRole: 'Data Platform Engineer',
    applicationStatus: 'draft',
    pendingApprovals: ['Kafka'],
    createdDaysAgo: 1,
    updatedDaysAgo: 1,
    data: {
      basics: { ...persona, label: 'Data Platform Engineer', summary: 'Data platform engineer building streaming-ready ETL pipelines with Kafka.' },
      work: [northwind, contoso],
      skills: [{ name: 'Data', keywords: ['SQL', 'ETL', 'MongoDB', 'Kafka'] }, skills[1]],
      education,
      languages,
    },
    meta: meta({ templateId: 'minimal' }),
  },
  {
    key: 'sales',
    title: 'Yoav Shalev - Sales Manager',
    applicationStatus: 'draft',
    createdDaysAgo: 40,
    updatedDaysAgo: 15,
    data: {
      basics: { name: 'Yoav Shalev', label: 'Sales Manager | B2B SaaS', email: 'yoav.shalev@example.com', location: { city: 'Tel Aviv', countryCode: 'IL' }, summary: 'B2B SaaS sales manager focused on enterprise accounts and consultative selling.' },
      work: [
        {
          name: 'Acme CRM',
          roles: [
            { id: 'sales-r1', position: 'Sales Manager', startDate: '2021', endDate: 'Present', highlights: ['Runs enterprise sales cycles from qualification to close', 'Exceeds annual quota consistently'] },
            { id: 'sales-r2', position: 'Account Executive', startDate: '2018', endDate: '2020', highlights: ['Managed a mid-market book of business'] },
          ],
        },
      ],
      education: [{ institution: 'Example College', studyType: 'B.Sc.', area: 'Industrial Engineering', startDate: '2014', endDate: '2018' }],
      skills: [{ name: 'Sales', keywords: ['Enterprise sales', 'MEDDIC', 'Negotiation'] }],
      languages,
    },
    meta: meta({ templateId: 'classic' }),
  },
  {
    key: 'gis',
    title: 'Daniel Mizrahi - GIS Developer',
    applicationStatus: 'draft',
    createdDaysAgo: 35,
    updatedDaysAgo: 12,
    data: {
      basics: { name: 'Daniel Mizrahi', label: 'GIS Developer and Analyst', email: 'daniel.mizrahi@example.com', location: { city: 'Jerusalem', countryCode: 'IL' }, summary: 'Geospatial developer who automates map data processing with Python and GIS tools.' },
      work: [
        { name: 'Example Mobility', position: 'GIS Developer', startDate: '2022', endDate: 'Present', highlights: ['Built Python test suites that validate routing-map data before release'] },
        { name: 'Example University', position: 'Teaching Assistant, GIS', startDate: '2019', endDate: '2022', highlights: ['Taught ArcGIS, QGIS and SQL workshops'] },
      ],
      education: [{ institution: 'Example University', studyType: 'M.A.', area: 'Geography', startDate: '2019', endDate: '2022' }],
      skills: [{ name: 'Technical', keywords: ['GIS', 'Python', 'ArcGIS', 'QGIS', 'SQL'] }],
      certificates: [{ name: 'Data Science Program', issuer: 'Example Institute of Technology', date: '2025' }],
      awards: [{ title: 'Outstanding thesis award', awarder: 'Example University', date: '2023' }],
      languages: [...languages, { language: 'Arabic', fluency: 'Advanced' }],
    },
    meta: meta({ templateId: 'classic' }),
  },
  {
    key: 'investor',
    title: 'Eitan Golan - Growth Investor',
    applicationStatus: 'draft',
    createdDaysAgo: 33,
    updatedDaysAgo: 20,
    data: {
      basics: { name: 'Eitan Golan', label: 'Growth Investor', email: 'eitan.golan@example.com', location: { city: 'Tel Aviv', countryCode: 'IL' }, summary: 'Investor with experience across venture capital, growth equity and M&A advisory.' },
      work: [
        { name: 'Example Capital', position: 'Investor', startDate: '2021', endDate: 'Present', highlights: ['Leads diligence and investment memos for growth-stage rounds'] },
        { name: 'Example Advisory', position: 'M&A Consultant', startDate: '2018', endDate: '2021', highlights: ['Built financial models for transaction due diligence'] },
      ],
      education: [{ institution: 'Example Business School', studyType: 'MBA', area: 'Finance', startDate: '2018', endDate: '2020' }],
      languages,
    },
    meta: meta({ templateId: 'executive', headerFontFamily: 'Garamond', fontFamily: 'Lato' }),
  },
]

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const DemoResumeFileSchema = z.object({
  resumes: z.array(
    z.object({
      key: z.string(),
      title: z.string().min(1).max(200),
      data: ResumeDataSchema,
      meta: ResumeMetaSchema,
      applicationStatus: ApplicationStatusEnum,
      targetCompany: z.string().optional(),
      targetRole: z.string().optional(),
      parentKey: z.string().optional(),
      pendingApprovals: z.array(z.string()).optional(),
      createdDaysAgo: z.number().min(0),
      updatedDaysAgo: z.number().min(0),
    })
  ),
})

export function checkResumeKeys(resumes: DemoResume[]): void {
  const keys = new Set(resumes.map((r) => r.key))
  const missing = REQUIRED_RESUME_KEYS.filter((k) => !keys.has(k))
  if (missing.length > 0) throw new Error(`Demo content is missing résumé key(s): ${missing.join(', ')}`)
  for (const r of resumes) {
    if (r.parentKey && !keys.has(r.parentKey)) throw new Error(`Résumé "${r.key}" has unknown parentKey "${r.parentKey}"`)
  }
}

export function parseDemoContent(json: unknown): DemoResume[] {
  const { resumes } = DemoResumeFileSchema.parse(json)
  checkResumeKeys(resumes)
  return resumes
}

/** The local file's résumés when it exists, otherwise the committed samples. */
export function loadDemoResumes(localPath: string = LOCAL_CONTENT_PATH): { resumes: DemoResume[]; source: 'local' | 'sample' } {
  if (existsSync(localPath)) {
    return { resumes: parseDemoContent(JSON.parse(readFileSync(localPath, 'utf8'))), source: 'local' }
  }
  return { resumes: SAMPLE_RESUMES, source: 'sample' }
}

export { SAMPLE_RESUMES }
