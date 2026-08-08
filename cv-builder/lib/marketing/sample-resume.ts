import { ResumeMetaSchema, type ResumeData, type ResumeMeta } from '@/lib/schemas/resume.zod'

// Static, hand-written sample used only to render the marketing homepage's
// template showcase and hero mockup — never persisted, never user data.
export const SAMPLE_RESUME_DATA: ResumeData = {
  basics: {
    name: 'Jordan Avery',
    label: 'Senior Product Designer',
    email: 'jordan.avery@example.com',
    phone: '(555) 012-3456',
    location: { city: 'Austin', region: 'TX' },
    summary:
      'Product designer with 8+ years crafting data-heavy B2B tools. Led design for a checkout redesign that lifted conversion 18%.',
    profiles: [{ network: 'LinkedIn', username: 'jordanavery', url: 'https://linkedin.com/in/jordanavery' }],
  },
  work: [
    {
      name: 'Northwind Analytics',
      position: 'Senior Product Designer',
      startDate: '2021-03',
      endDate: '',
      summary: 'Own end-to-end design for the reporting and billing surfaces.',
      highlights: [
        'Redesigned checkout flow, increasing conversion by 18% over two quarters',
        'Built and maintained the company design system used by 6 product teams',
        'Mentored 2 junior designers through promotion to mid-level',
      ],
    },
    {
      name: 'Bramblewood Software',
      position: 'Product Designer',
      startDate: '2018-06',
      endDate: '2021-02',
      summary: 'Designed core workflows for a project-management SaaS product.',
      highlights: [
        'Shipped a task-board redesign adopted by 100% of active workspaces',
        'Ran 40+ user interviews to inform the v2 onboarding flow',
      ],
    },
  ],
  education: [
    {
      institution: 'University of Texas at Austin',
      area: 'Design',
      studyType: 'B.F.A.',
      startDate: '2014-09',
      endDate: '2018-05',
    },
  ],
  skills: [
    { name: 'Product Design', keywords: ['Figma', 'Design Systems', 'Prototyping'] },
    { name: 'Research', keywords: ['User Interviews', 'Usability Testing'] },
    { name: 'Frontend', keywords: ['HTML', 'CSS', 'React basics'] },
  ],
  certificates: [{ name: 'Certified Usability Analyst', issuer: 'HFI', date: '2020-05' }],
}

export function sampleResumeMeta(templateId: string): ResumeMeta {
  return ResumeMetaSchema.parse({ templateId })
}
