// scripts/demo-seed/resumes.ts
// Résumé content for the demo account. Pure data: no database access here.
//
// Three of these CVs are based on real people. Their names and contact details
// are replaced with the placeholders in FRIEND_IDENTITIES below. Edit the
// placeholders there rather than in the database: the seed is re-runnable
// (`--reset`), and anything changed only in the database would be overwritten
// with whatever this file says on the next reset.
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'

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

export const FRIEND_IDENTITIES = {
  sales: {
    name: 'Yoav Shalev',
    email: 'yoav.shalev@example.com',
    phone: '050-000-0001',
    linkedin: 'https://linkedin.com/in/example-sales',
  },
  gis: {
    name: 'Daniel Mizrahi',
    email: 'daniel.mizrahi@example.com',
    phone: '050-000-0002',
    linkedin: 'https://linkedin.com/in/example-gis',
  },
  investor: {
    name: 'Eitan Golan',
    email: 'eitan.golan@example.com',
    phone: '050-000-0003',
    linkedin: 'https://linkedin.com/in/example-investor',
  },
} as const

const meta = (overrides: Partial<ResumeMeta>): ResumeMeta => ResumeMetaSchema.parse(overrides)

// ---------------------------------------------------------------------------
// Idan: the demo persona
// ---------------------------------------------------------------------------

const idanBasics = {
  name: 'Idan Arbel',
  label: 'Data & AI Solutions Architect',
  email: 'idan.rbel@gmail.com',
  phone: '054-3131379',
  location: { city: 'Tel Aviv', countryCode: 'IL' },
  // LinkedIn URL omitted: the source PDF only shows the word "LinkedIn".
}

const idanSummary =
  'Data Solutions Architect and GenAI platform developer with 5+ years of experience engineering scalable ETL pipelines and robust anti-fraud ML systems. Combines a rigorously data-driven analytical foundation with the agility to rapidly prototype, architect and deploy custom LLM applications. Dedicated to leveraging Python, AI orchestration and cloud infrastructure to build high-impact platforms that solve complex operational bottlenecks.'

const sasWork = {
  name: 'SAS Israel',
  position: 'Data Solutions Architect',
  startDate: '2022-07',
  endDate: 'Present',
  highlights: [
    'Engineered a multi-cloud data integration solution using SQL and SAS Studio, achieving 97% system uptime and elevated data quality',
    'Architected anti-fraud systems identifying suspicious vendor and employee patterns, preventing over ₪1 million in fraud losses',
    "Deployed ML models within the client's ecosystem, reducing algorithmic false positives by 20% across multi-million-row financial datasets",
    'Supervised production and development environments and streamlined ad hoc data processes, driving a 30% increase in analyst productivity',
  ],
}

const checkpointWork = {
  name: 'Check Point Software',
  position: 'Revenue Operations Data Analyst',
  startDate: '2021-03',
  endDate: '2022-07',
  highlights: [
    'Built and tracked KPI dashboards in Tableau and Salesforce, driving a 12% EMEA renewal rate increase through enhanced sales visibility',
    'Automated reporting pipelines and complex data manipulation using SQL, reducing manual processing time by 50%',
    'Led cross-departmental data transformation and enterprise data lake initiatives, achieving sub-5-second response times on critical operational queries',
    'Analyzed sales performance trends, cycles and funnels to identify structural bottlenecks in global revenue operations',
  ],
}

const idanEducation = [
  {
    institution: 'Technion - Israel Institute of Technology',
    studyType: 'Professional Program',
    area: 'Generative AI & LLMs',
    startDate: '2025-12',
    endDate: '2026-07',
  },
  {
    institution: 'Shenkar - Engineering Faculty',
    studyType: 'B.Sc.',
    area: 'Industrial Engineering',
    startDate: '2017-10',
    endDate: '2021-07',
  },
]

const idanProjects = [
  {
    name: 'Dash:IQ',
    url: 'https://dashiq.base44.app',
    description:
      'AI-powered finance dashboard with LLM-based categorization, insights and forecasts, helping users manage their own financial transactions.',
    keywords: ['AI', 'LLM', 'Finance', 'Dashboard'],
  },
  {
    name: 'CVitae Studio',
    url: 'https://cv-builder-indol-zeta.vercel.app/',
    description:
      'Full-stack, ATS-compatible résumé platform with real-time document rendering and isolated PDF and DOCX import/export pipelines. Built a generative AI suggestion pipeline with strict hallucination guards and an integrated ATS scoring algorithm.',
    keywords: ['Full-stack', 'ATS', 'GenAI'],
  },
]

const idanSkills = [
  { name: 'Data', keywords: ['SQL', 'DBMS', 'DML/DDL', 'MongoDB', 'Excel', 'ETL', 'SAS'] },
  { name: 'Programming', keywords: ['Python', 'OOP', 'scikit-learn', 'Pandas', 'Matplotlib', 'REST API'] },
  { name: 'AI', keywords: ['GenAI', 'LangChain', 'RAG', 'LLMs'] },
  { name: 'BI', keywords: ['Tableau', 'SAS Visual Analytics'] },
  { name: 'Tools', keywords: ['Git', 'GitHub', 'VS Code', 'Jira', 'Salesforce'] },
  { name: 'Soft Skills', keywords: ['Creative thinking', 'Problem solving', 'Fast learner', 'Highly adaptable'] },
]

const idanLanguages = [
  { language: 'Hebrew', fluency: 'Native' },
  { language: 'English', fluency: 'Fluent' },
]

const militarySection = {
  id: 'military',
  name: 'Military Service',
  enabledFields: ['subtitle', 'dateRange', 'highlights'] as ('subtitle' | 'dateRange' | 'highlights')[],
  items: [
    {
      id: 'military-1',
      title: 'HR Officer (Captain)',
      subtitle: 'IDF',
      startDate: '2012',
      endDate: '2016',
      highlights: [
        'Managed human resources in routine and emergency scenarios',
        'Led efficiency projects in the field of human resources',
      ],
    },
  ],
}

const idanMaster: DemoResume = {
  key: 'idan-master',
  title: 'Idan Arbel - Data & AI Solutions Architect',
  applicationStatus: 'draft',
  createdDaysAgo: 48,
  updatedDaysAgo: 3,
  data: {
    basics: { ...idanBasics, summary: idanSummary },
    work: [sasWork, checkpointWork],
    education: idanEducation,
    skills: idanSkills,
    languages: idanLanguages,
    projects: idanProjects,
    customSections: [militarySection],
  },
  meta: meta({
    templateId: 'sidebar',
    fontFamily: 'Calibri',
    headerFontFamily: 'Cambria',
    primaryColor: '#1E2A44',
    accentColor: '#2F5BFF',
    sectionOrder: ['work', 'education', 'projects', 'skills', 'languages', 'custom:military'],
    columnAssignment: { 'custom:military': 'left' },
  }),
}

// Same facts, re-ordered and re-weighted for GenAI roles. No new claims.
const idanGenAi: DemoResume = {
  key: 'idan-genai',
  parentKey: 'idan-master',
  title: 'Idan Arbel - GenAI Engineer',
  targetRole: 'GenAI Engineer',
  applicationStatus: 'applied',
  createdDaysAgo: 30,
  updatedDaysAgo: 9,
  data: {
    basics: {
      ...idanBasics,
      label: 'GenAI Engineer | Data Solutions Architect',
      summary:
        'GenAI platform developer and Data Solutions Architect with 5+ years of experience shipping production data and ML systems. Builds LLM applications end to end: RAG and LangChain orchestration, generation-critique-refine pipelines with hallucination guards, and the ETL foundations they depend on. Combines a rigorous analytical background with fast, iterative prototyping.',
    },
    projects: idanProjects.slice().reverse(),
    work: [sasWork, checkpointWork],
    skills: [idanSkills[2], idanSkills[1], idanSkills[0], idanSkills[4]],
    education: idanEducation,
    languages: idanLanguages,
  },
  meta: meta({
    templateId: 'modern',
    accentColor: '#2F5BFF',
    sectionOrder: ['projects', 'work', 'skills', 'education', 'languages'],
  }),
}

const idanDataEng: DemoResume = {
  key: 'idan-monday',
  parentKey: 'idan-master',
  title: 'Idan Arbel - Senior Data Engineer (monday.com)',
  targetCompany: 'monday.com',
  targetRole: 'Senior Data Engineer',
  applicationStatus: 'interviewing',
  createdDaysAgo: 21,
  updatedDaysAgo: 6,
  data: {
    basics: {
      ...idanBasics,
      label: 'Senior Data Engineer',
      summary:
        'Data engineer and solutions architect with 5+ years of experience building scalable ETL pipelines, multi-cloud data integrations and enterprise data lake projects. Delivered 97% system uptime on production integrations and sub-5-second response times on critical operational queries. Comfortable owning the full path from raw data to trusted, analysis-ready datasets.',
    },
    work: [sasWork, checkpointWork],
    skills: [idanSkills[0], idanSkills[1], idanSkills[3], idanSkills[4]],
    education: idanEducation,
    projects: [idanProjects[1]],
    languages: idanLanguages,
  },
  meta: meta({ templateId: 'classic', accentColor: '#2F5BFF' }),
}

// Drafted by the job-search pipeline and held for review: the hallucination
// guard flagged "Kafka" because it is not in Idan's own text. This is the
// state the pipeline inbox's "Drafted" stage demonstrates.
const idanCatoDraft: DemoResume = {
  key: 'idan-cato-draft',
  parentKey: 'idan-master',
  title: 'Idan Arbel - Data Platform Engineer (Cato Networks)',
  targetCompany: 'Cato Networks',
  targetRole: 'Data Platform Engineer',
  applicationStatus: 'draft',
  pendingApprovals: ['Kafka'],
  createdDaysAgo: 1,
  updatedDaysAgo: 1,
  data: {
    basics: {
      ...idanBasics,
      label: 'Data Platform Engineer',
      summary:
        'Data platform engineer with 5+ years of experience designing multi-cloud data integrations and streaming-ready ETL pipelines with Kafka. Built anti-fraud ML systems on multi-million-row financial datasets and production environments with 97% uptime.',
    },
    work: [sasWork, checkpointWork],
    skills: [{ name: 'Data', keywords: ['SQL', 'ETL', 'MongoDB', 'SAS', 'Kafka'] }, idanSkills[1], idanSkills[4]],
    education: idanEducation,
    languages: idanLanguages,
  },
  meta: meta({ templateId: 'minimal' }),
}

// ---------------------------------------------------------------------------
// Friends' CVs (placeholder identities, see FRIEND_IDENTITIES)
// ---------------------------------------------------------------------------

const salesCv: DemoResume = {
  key: 'friend-sales',
  title: `${FRIEND_IDENTITIES.sales.name} - Sales Manager`,
  applicationStatus: 'draft',
  createdDaysAgo: 40,
  updatedDaysAgo: 15,
  data: {
    basics: {
      name: FRIEND_IDENTITIES.sales.name,
      label: 'Sales Manager | B2B SaaS | Enterprise & Strategic Accounts',
      email: FRIEND_IDENTITIES.sales.email,
      phone: FRIEND_IDENTITIES.sales.phone,
      location: { city: 'Tel Aviv', countryCode: 'IL' },
      profiles: [{ id: 'p-linkedin', network: 'LinkedIn', url: FRIEND_IDENTITIES.sales.linkedin }],
      summary:
        "Results-driven B2B SaaS Sales Manager with 7+ years of experience leading enterprise and mid-market sales for one of Israel's leading CRM platforms. Uses structured methodologies, including BANT and MEDDIC, to qualify leads, manage complex enterprise sales cycles and drive pipeline predictability. Builds strategic partnerships, negotiates with C-level executives and closes six-figure annual deals with a consultative, customer-first approach.",
    },
    work: [
      {
        name: 'Fireberry CRM',
        roles: [
          {
            id: 'sales-r1',
            position: 'Sales Manager, Enterprise Sales & Business Development',
            startDate: '2020',
            endDate: 'Present',
            highlights: [
              'Lead end-to-end sales cycles for enterprise and strategic accounts, from qualification through negotiation and closing',
              'Drive six-figure annual contracts with national and enterprise-level brands',
              'Deliver tailored product demos and executive presentations to C-suite stakeholders',
              'Partner with Marketing, Product and Implementation teams to ensure smooth onboarding and long-term customer success',
              'Consistently exceed quarterly and annual sales targets (120%+ attainment)',
              'Expanded the enterprise customer base and significantly grew pipeline year over year',
            ],
          },
          {
            id: 'sales-r2',
            position: 'Account Executive',
            startDate: '2018',
            endDate: '2019',
            highlights: [
              'Managed mid-market accounts and drove CRM adoption across diverse industries',
              'Built trusted client relationships through consultative selling and solution alignment',
              'Contributed to revenue growth by consistently exceeding sales quotas',
            ],
          },
        ],
      },
    ],
    education: [
      {
        institution: 'Shenkar College of Engineering and Design',
        studyType: 'B.Sc.',
        area: 'Industrial Engineering',
        startDate: '2017',
        endDate: '2021',
      },
    ],
    skills: [
      { name: 'Sales', keywords: ['Enterprise sales', 'MEDDIC', 'BANT', 'Negotiation', 'Pipeline management'] },
      { name: 'Tools', keywords: ['CRM', 'Salesforce', 'Product demos'] },
    ],
    languages: [
      { language: 'Hebrew', fluency: 'Native' },
      { language: 'English', fluency: 'Highly proficient' },
    ],
  },
  meta: meta({ templateId: 'classic' }),
}

const gisCv: DemoResume = {
  key: 'friend-gis',
  title: `${FRIEND_IDENTITIES.gis.name} - GIS Developer`,
  applicationStatus: 'draft',
  createdDaysAgo: 35,
  updatedDaysAgo: 12,
  data: {
    basics: {
      name: FRIEND_IDENTITIES.gis.name,
      label: 'GIS Developer and Analyst',
      email: FRIEND_IDENTITIES.gis.email,
      phone: FRIEND_IDENTITIES.gis.phone,
      location: { city: 'Central Israel', countryCode: 'IL' },
      profiles: [{ id: 'p-linkedin', network: 'LinkedIn', url: FRIEND_IDENTITIES.gis.linkedin }],
      summary:
        'Geo-data analyst and developer with an M.A. in Geography and Urban and Regional Planning from The Hebrew University of Jerusalem. Experienced in spatial research and analysis that turns geographic data into insight, and in building geographic tools, automating data flows and writing tests that validate data.',
    },
    work: [
      {
        name: 'Via Transportation',
        roles: [
          {
            id: 'gis-r1',
            position: 'GIS Developer',
            startDate: '2024',
            endDate: '2026',
            highlights: [
              'Developed Python and GIS automation and testing flows that streamline geospatial data processing for routing maps',
            ],
          },
          {
            id: 'gis-r2',
            position: 'Routing Maps Specialist',
            startDate: '2021',
            endDate: '2024',
            highlights: [
              'Built automation and testing scripts with Python and GIS tools for routing-map data processing',
              'Applied advanced mapping techniques to identify improvements in partner experience and refine navigation solutions',
            ],
          },
        ],
      },
      {
        name: 'The Hebrew University of Jerusalem',
        position: 'Research and Teaching Assistant',
        startDate: '2020',
        endDate: '2022',
        highlights: [
          'Taught GIS and geospatial data science workshops, preparing materials and guiding hands-on exercises in ArcGIS, QGIS, Python and SQL',
          'Contributed geospatial analysis to Covid-19 spatial mitigation research using ArcGIS, Python and SQL',
        ],
      },
      {
        name: 'Israeli Military Intelligence - Unit 8200',
        position: 'Intelligence Analyst',
        startDate: '2017',
        endDate: '2019',
      },
    ],
    education: [
      {
        institution: 'The Hebrew University of Jerusalem',
        studyType: 'M.A.',
        area: 'Geography and Urban and Regional Planning',
        startDate: '2019',
        endDate: '2022',
      },
      {
        institution: 'The Hebrew University of Jerusalem',
        studyType: 'B.A.',
        area: 'Geography (Geo-Informatics Track) and Business Administration',
        startDate: '2018',
        endDate: '2021',
      },
    ],
    skills: [
      {
        name: 'Technical',
        keywords: ['GIS', 'Python', 'ArcGIS', 'QGIS', 'SQL', 'Geospatial data analysis', 'Automation', 'Testing'],
      },
      {
        name: 'Soft Skills',
        keywords: ['Teamwork', 'Time management', 'Leadership', 'Communication', 'Critical thinking'],
      },
    ],
    certificates: [
      { name: 'Certified Data Science Program', issuer: 'Technion - Israel Institute of Technology', date: '2025' },
    ],
    awards: [
      { title: 'Dov Nir Award for outstanding thesis work', awarder: 'The Hebrew University', date: '2023' },
      { title: 'Excellence in the GIS Division', awarder: 'The Hebrew University', date: '2020' },
    ],
    languages: [
      { language: 'Hebrew', fluency: 'Native' },
      { language: 'English', fluency: 'Fluent' },
      { language: 'Arabic', fluency: 'Advanced' },
    ],
  },
  meta: meta({ templateId: 'classic' }),
}

const investorCv: DemoResume = {
  key: 'friend-investor',
  title: `${FRIEND_IDENTITIES.investor.name} - Growth Investor`,
  applicationStatus: 'draft',
  createdDaysAgo: 33,
  updatedDaysAgo: 20,
  data: {
    basics: {
      name: FRIEND_IDENTITIES.investor.name,
      label: 'Growth Investor / Director',
      email: FRIEND_IDENTITIES.investor.email,
      phone: FRIEND_IDENTITIES.investor.phone,
      location: { city: 'Tel Aviv', countryCode: 'IL' },
      profiles: [{ id: 'p-linkedin', network: 'LinkedIn', url: FRIEND_IDENTITIES.investor.linkedin }],
      summary:
        'Investor and board advisor with 10+ years of experience across venture capital, growth equity, private equity and M&A, focused on creating long-term strategic and financial value.',
    },
    work: [
      {
        name: 'Phoenix Capital Partners',
        position: 'Board Member & Investor',
        startDate: '2023',
        endDate: 'Present',
        highlights: [
          'Run venture growth investments end to end: sourcing and diligence, investment committee memos, closing, monitoring and board seats through realization',
          "Represent the firm on portfolio company boards, including Classiq, accessiBe, Qodo, Guardz, ChargeAfter and Qira",
          'Invest as a limited partner in buyout and venture funds across the US, Europe and Israel, including Insight Partners, Thrive Capital and General Atlantic',
        ],
      },
      {
        name: 'Entrée Capital',
        position: 'Investor',
        startDate: '2021',
        endDate: '2023',
        highlights: [
          'Sourced early-stage investments, ran due diligence across sectors and wrote detailed investment memos',
          'Monitored strategic initiatives, defined KPIs and prepared reports supporting investment decisions',
          'Supported portfolio companies through operational and strategic challenges',
        ],
      },
      {
        name: 'Deloitte Israel',
        position: 'Transaction Services - M&A Consulting',
        startDate: '2019',
        endDate: '2021',
        highlights: [
          'Advised on M&A, due diligence and transaction services, including corporate finance deep dives',
          'Built financial models, industry and market research, and customized reports',
        ],
      },
      {
        name: 'Israel Innovation Authority',
        position: 'Analyst, Advanced Manufacturing Division',
        startDate: '2017',
        endDate: '2019',
        highlights: [
          'Analyzed KPIs for the Advanced Manufacturing (Industry 4.0) division',
          'Supported grant applications and executed division strategy',
        ],
      },
    ],
    education: [
      {
        institution: 'Tel Aviv University, Coller School of Management',
        studyType: 'MBA',
        area: 'Finance',
        startDate: '2019',
        endDate: '2021',
      },
      {
        institution: 'Ben-Gurion University',
        studyType: 'B.A.',
        area: 'Accounting and Economics',
        startDate: '2015',
        endDate: '2018',
      },
    ],
    languages: [
      { language: 'English', fluency: 'Native' },
      { language: 'Hebrew', fluency: 'Native' },
    ],
    interests: [{ name: 'Outside work', keywords: ['Hiking', 'Travel', 'Sports', 'Reading', 'Global news'] }],
  },
  meta: meta({ templateId: 'executive', headerFontFamily: 'Garamond', fontFamily: 'Lato' }),
}

export const DEMO_RESUMES: DemoResume[] = [
  idanMaster,
  idanGenAi,
  idanDataEng,
  idanCatoDraft,
  salesCv,
  gisCv,
  investorCv,
]
