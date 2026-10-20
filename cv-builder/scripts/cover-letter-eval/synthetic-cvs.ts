// scripts/cover-letter-eval/synthetic-cvs.ts
// Fictional CVs written to stress specific cover letter failure modes. The
// people, employers and figures are invented (some institutions are real
// universities, used only as plausible places of study). Because the facts
// are known exactly, a letter's errors can be labelled without guesswork.
//
// Each CV plants traps:
// - similar-looking numbers under different employers (cross-job misattribution)
// - a figure that is easy to restate with a different meaning (22% -> 31% vs "by 31%")
// - a CV with no numbers at all (any number in the letter is invented)
// - gaps, overqualification and stretch applications to see if they are addressed
// - a CV with one job and two plain bullets (a good letter is short, not padded)
import type { ResumeData } from '@/lib/schemas/resume.zod'

export const SYNTHETIC_CVS: Record<string, ResumeData> = {
  // New graduate: thin experience, small numbers, "Python basics" invites inflation.
  'syn-newgrad': {
    basics: {
      name: 'Maya Ben-David',
      label: 'Economics graduate',
      email: 'maya.bendavid@example.com',
      location: { city: 'Tel Aviv', countryCode: 'IL' },
      summary: 'Economics and management graduate with a part-time analytics internship in retail. Comfortable in Excel and SQL, learning Python.',
    },
    work: [
      {
        name: 'Lumio Retail',
        position: 'Customer Insights Intern (part time)',
        startDate: '2024-07',
        endDate: '2025-02',
        highlights: [
          'Built a weekly Excel report on product returns across 14 stores',
          'Flagged 3 recurring refund-abuse patterns that the risk team added to its review checklist',
        ],
      },
      {
        name: 'Kafe Shalom',
        position: 'Shift Supervisor',
        startDate: '2021-03',
        endDate: '2024-06',
        highlights: ['Supervised shifts of up to 6 staff', 'Handled end-of-day cash reconciliation'],
      },
      {
        name: 'Israel Defense Forces',
        position: 'Operations NCO',
        startDate: '2018-08',
        endDate: '2020-08',
        highlights: ['Maintained the unit duty roster and daily operations log'],
      },
    ],
    education: [{ institution: 'Tel Aviv University', studyType: 'B.A.', area: 'Economics and Management', startDate: '2021-10', endDate: '2025-07' }],
    skills: [
      { name: 'Data', keywords: ['Excel', 'SQL (university course)', 'Python (basics)'] },
      { name: 'Languages', keywords: ['Hebrew (native)', 'English (fluent)'] },
    ],
  },

  // Returner after a caregiving break; two employers with different marketing figures.
  'syn-returner': {
    basics: {
      name: 'Ruth Alon',
      label: 'Lifecycle Marketing Manager',
      email: 'ruth.alon@example.com',
      location: { city: 'Ramat Gan', countryCode: 'IL' },
      summary: 'Lifecycle and email marketer returning to full-time work after a three-year family caregiving break, recently recertified in marketing automation.',
    },
    work: [
      {
        name: 'Freelance',
        position: 'Email Marketing Consultant',
        startDate: '2025-04',
        endDate: 'Present',
        highlights: ['Set up automated win-back flows in Klaviyo for 2 e-commerce clients'],
      },
      {
        name: 'Fleetly',
        position: 'Lifecycle Marketing Manager',
        startDate: '2016-03',
        endDate: '2022-01',
        highlights: [
          'Rebuilt the onboarding email journey, raising 30-day activation from 22% to 31%',
          'Owned a $400k annual budget for lifecycle and retention campaigns',
          'Introduced A/B testing for subject lines and send times across all journeys',
        ],
      },
      {
        name: 'Shopwise',
        position: 'Email Marketing Specialist',
        startDate: '2013-06',
        endDate: '2016-02',
        highlights: ['Grew the newsletter list from 40,000 to 110,000 subscribers', 'Wrote and scheduled the weekly promotional newsletter'],
      },
    ],
    customSections: [
      {
        id: 'career-break',
        name: 'Career Break',
        enabledFields: ['dateRange', 'summary'],
        items: [{ id: 'break-1', title: 'Family caregiving', startDate: '2022-01', endDate: '2025-03', summary: 'Full-time caregiver for a family member.' }],
      },
    ],
    certificates: [{ name: 'Marketing Automation Certification', issuer: 'HubSpot Academy', date: '2025-05' }],
    education: [{ institution: 'Bar-Ilan University', studyType: 'B.A.', area: 'Communication', startDate: '2009-10', endDate: '2012-07' }],
    skills: [{ name: 'Marketing', keywords: ['Braze', 'Klaviyo', 'HubSpot', 'A/B testing', 'Segmentation'] }],
  },

  // No figures anywhere: any number in a letter is invented.
  'syn-nometrics': {
    basics: {
      name: 'Omar Haddad',
      label: 'Customer Support Team Lead',
      email: 'omar.haddad@example.com',
      location: { city: 'Haifa', countryCode: 'IL' },
      summary: 'Support team lead who connects customers, product managers and R&D, and turns recurring problems into documented processes.',
    },
    work: [
      {
        name: 'Brightdesk',
        roles: [
          {
            id: 'bd-lead',
            position: 'Customer Support Team Lead',
            startDate: '2019-05',
            endDate: 'Present',
            highlights: [
              'Lead the support team for enterprise customers across email, chat and phone',
              "Wrote the team's escalation playbook together with product and R&D",
              'Run a weekly review of recurring tickets and pass the findings to product managers',
              'Train new agents on the ticketing system and internal tools',
            ],
          },
          {
            id: 'bd-agent',
            position: 'Support Agent',
            startDate: '2017-02',
            endDate: '2019-04',
            highlights: ['Resolved technical issues for small business customers', "Became the team's go-to person for billing questions"],
          },
        ],
      },
    ],
    education: [{ institution: 'University of Haifa', studyType: 'B.A.', area: 'Sociology', startDate: '2013-10', endDate: '2016-07' }],
    skills: [{ name: 'Tools', keywords: ['Zendesk', 'Jira', 'Confluence', 'Excel'] }],
  },

  // CFO applying for a senior analyst role; two employers with easily swapped finance wins.
  'syn-exec': {
    basics: {
      name: 'Michal Barak',
      label: 'CFO',
      email: 'michal.barak@example.com',
      location: { city: 'Herzliya', countryCode: 'IL' },
      summary: 'Finance executive with 19 years in audit, controlling and finance leadership at growth-stage companies.',
    },
    work: [
      {
        name: 'Tavor Medical Devices',
        position: 'Chief Financial Officer',
        startDate: '2017-01',
        endDate: 'Present',
        highlights: [
          'Lead a finance organization of 22 people across accounting, FP&A and tax',
          'Shortened the monthly close from 10 working days to 6',
          'Raised a $35M Series C round together with the CEO',
        ],
      },
      {
        name: 'Orbit Logistics',
        position: 'VP Finance',
        startDate: '2011-04',
        endDate: '2016-12',
        highlights: ['Cut external audit findings by 40% over two years', 'Implemented NetSuite across 4 subsidiaries'],
      },
      {
        name: 'Galil & Partners CPA',
        position: 'Senior Auditor',
        startDate: '2006-09',
        endDate: '2011-03',
        highlights: ['Audited manufacturing and technology clients'],
      },
    ],
    education: [
      { institution: 'Tel Aviv University', studyType: 'MBA', area: 'Finance', startDate: '2011-10', endDate: '2013-07' },
      { institution: 'The Hebrew University of Jerusalem', studyType: 'B.A.', area: 'Accounting and Economics', startDate: '2002-10', endDate: '2006-07' },
    ],
    certificates: [{ name: 'Certified Public Accountant (Israel)', date: '2008-03' }],
    skills: [{ name: 'Finance', keywords: ['FP&A', 'Fundraising', 'NetSuite', 'Excel', 'Board reporting'] }],
  },

  // Nurse moving into healthcare data; course project uses public data, no fraud work.
  'syn-nurse': {
    basics: {
      name: 'Priya Raman',
      label: 'Registered Nurse',
      email: 'priya.raman@example.com',
      location: { city: 'Toronto', countryCode: 'CA' },
      summary: 'Registered nurse with clinical quality-improvement experience, retraining in data analysis with SQL and Tableau.',
    },
    work: [
      {
        name: 'Lakeshore General Hospital',
        position: 'Registered Nurse, Medical-Surgical Unit',
        startDate: '2016-06',
        endDate: 'Present',
        highlights: [
          'Charge nurse on a 32-bed unit three shifts a week',
          'Led a falls-prevention audit with the quality team that cut patient falls on the unit by 18% over a year',
          "Super-user for the hospital's electronic health record rollout, training 40 nurses",
        ],
      },
      {
        name: 'Northgate Long-Term Care',
        position: 'Registered Nurse',
        startDate: '2013-09',
        endDate: '2016-05',
        highlights: ['Reviewed medication administration records weekly for documentation errors'],
      },
    ],
    projects: [
      {
        name: 'Hospital readmissions analysis',
        description: 'Course capstone: analysed a public hospital readmissions dataset in SQL and built a Tableau dashboard of readmission rates by condition.',
        keywords: ['SQL', 'Tableau'],
      },
    ],
    certificates: [
      { name: 'Google Data Analytics Certificate', issuer: 'Coursera', date: '2024-11' },
      { name: 'SQL for Data Analysis', issuer: 'Udemy', date: '2025-02' },
    ],
    education: [{ institution: 'University of Toronto', studyType: 'BScN', area: 'Nursing', startDate: '2009-09', endDate: '2013-06' }],
    skills: [{ name: 'Data', keywords: ['SQL', 'Tableau', 'Excel'] }],
  },

  // Teacher moving into project management; a certificate is the only formal PM credential.
  'syn-teacher': {
    basics: {
      name: 'Yonatan Peretz',
      label: 'Mathematics Teacher and Grade Coordinator',
      email: 'yonatan.peretz@example.com',
      location: { city: 'Jerusalem', countryCode: 'IL' },
      summary: 'High school mathematics teacher and grade coordinator who runs school-wide projects, moving into project management.',
    },
    work: [
      {
        name: 'Givat Ram Comprehensive School',
        position: 'Mathematics Teacher and Grade 11 Coordinator',
        startDate: '2015-09',
        endDate: 'Present',
        highlights: [
          'Coordinate 6 teachers and 160 students as grade 11 coordinator since 2021',
          "Planned and ran the school's move to a new learning management system over one semester",
          "Built the department's shared assessment calendar used by all math teachers",
        ],
      },
      {
        name: 'Neve Hadar Middle School',
        position: 'Mathematics Teacher',
        startDate: '2012-09',
        endDate: '2015-08',
        highlights: ['Taught grades 7 to 9 mathematics'],
      },
    ],
    certificates: [{ name: 'Google Project Management Certificate', issuer: 'Coursera', date: '2025-06' }],
    education: [
      { institution: 'David Yellin Academic College of Education', studyType: 'Teaching Certificate', area: 'Mathematics', startDate: '2011-10', endDate: '2012-07' },
      { institution: 'The Hebrew University of Jerusalem', studyType: 'B.Sc.', area: 'Mathematics', startDate: '2008-10', endDate: '2011-07' },
    ],
    skills: [{ name: 'Tools', keywords: ['Google Workspace', 'Moodle', 'Excel', 'Monday.com'] }],
  },

  // Junior SOC analyst applying for a senior role; military plus one year in a SOC.
  'syn-soc': {
    basics: {
      name: 'Noam Shapira',
      label: 'SOC Analyst',
      email: 'noam.shapira@example.com',
      location: { city: "Be'er Sheva", countryCode: 'IL' },
      summary: 'SOC analyst with a military cyber defense background, focused on alert triage and detection engineering.',
    },
    work: [
      {
        name: 'Sentinel Shield (MSSP)',
        position: 'SOC Analyst, Tier 1',
        startDate: '2024-08',
        endDate: 'Present',
        highlights: ['Triage Splunk alerts for 12 client environments', 'Wrote 5 detection rules that the team adopted'],
      },
      {
        name: 'Israel Defense Forces',
        position: 'Cyber Defense Operator',
        startDate: '2020-11',
        endDate: '2024-07',
        highlights: ['Monitored network traffic on a 24/7 shift team', 'Took part in incident response drills'],
      },
    ],
    certificates: [{ name: 'CompTIA Security+', issuer: 'CompTIA', date: '2024-05' }],
    skills: [{ name: 'Security', keywords: ['Splunk', 'Wireshark', 'Linux', 'Python scripting', 'MITRE ATT&CK'] }],
  },

  // Designer turned developer after a bootcamp, applying for a senior role.
  'syn-bootcamp': {
    basics: {
      name: 'Tamar Levinson',
      label: 'Frontend Developer',
      email: 'tamar.levinson@example.com',
      location: { city: 'Tel Aviv', countryCode: 'IL' },
      summary: 'Frontend developer with a design background, building React and TypeScript products and using AI coding tools daily.',
    },
    work: [
      {
        name: 'Pixelpath',
        position: 'Junior Frontend Developer',
        startDate: '2024-03',
        endDate: 'Present',
        highlights: [
          'Build React and TypeScript features for a B2B design-asset platform',
          "Cut the main dashboard's load time from 4.1s to 1.8s by code-splitting",
          'Use Cursor and GitHub Copilot daily for refactoring and writing tests',
        ],
      },
      {
        name: 'Studio Ofek',
        position: 'Graphic Designer',
        startDate: '2017-01',
        endDate: '2023-06',
        highlights: ['Designed brand identities for 30+ small businesses', "Moved the studio's client handoff from PDFs to Figma"],
      },
    ],
    education: [
      { institution: 'CodeRise Academy', studyType: 'Bootcamp', area: 'Full-stack web development', startDate: '2023-07', endDate: '2024-01' },
      { institution: 'Bezalel Academy of Arts and Design', studyType: 'B.Des.', area: 'Visual Communication', startDate: '2012-10', endDate: '2016-07' },
    ],
    skills: [{ name: 'Engineering', keywords: ['React', 'TypeScript', 'Next.js', 'Figma', 'Cursor', 'GitHub Copilot'] }],
  },
  // Sparse CV: one job, two plain bullets, no summary, no figures. A strong
  // letter is short and claims only what is here; padding is where inflation comes from.
  'syn-sparse': {
    basics: {
      name: 'Lior Adani',
      email: 'lior.adani@example.com',
      location: { city: 'Beer Sheva', countryCode: 'IL' },
    },
    work: [
      {
        name: 'Northgate Freight',
        position: 'Logistics Coordinator',
        startDate: '2023-09',
        highlights: ['Scheduled daily deliveries for the regional drivers', 'Answered customer calls about delivery times'],
      },
    ],
    education: [{ institution: 'Ben-Gurion University of the Negev', studyType: 'B.A.', area: 'Sociology', startDate: '2019-10', endDate: '2023-07' }],
    skills: [{ name: 'Tools', keywords: ['Excel', 'Google Sheets'] }],
  },
}
