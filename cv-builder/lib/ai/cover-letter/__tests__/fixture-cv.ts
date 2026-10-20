import type { ResumeData } from '@/lib/schemas/resume.zod'

// Invented CV shared by the cover-letter tests; every name and figure is made up.
export const FIXTURE_CV: ResumeData = {
  basics: { name: 'Dana Levi', summary: 'Analyst with six years in retail data. I build reporting that teams use.' },
  work: [
    {
      name: 'Acme Analytics Ltd',
      position: 'Senior Analyst',
      startDate: '2021-03',
      highlights: ['Cut report time by 40%', 'Led a team of 4 analysts'],
      roles: [{ id: 'r2', position: 'Analyst', startDate: '2019-06', endDate: '2021-02', highlights: ['Built the weekly sales dashboard'] }],
    },
    { name: 'Israel Electric Corporation (IEC)', position: 'Intern', startDate: '2018', endDate: '2018', highlights: ['Cleaned meter data'] },
    { position: 'Freelance Analyst', startDate: '2017', endDate: '2018', highlights: ['Built pricing models for 3 clients'] },
  ],
  education: [{ institution: 'Tel Aviv University', studyType: 'B.A.', area: 'Economics', startDate: '2014', endDate: '2017' }],
  certificates: [{ name: 'Tableau Desktop Specialist', issuer: 'Tableau', date: '2022' }],
  projects: [{ name: 'Price Watch', description: 'A price tracking tool', highlights: ['Tracked 2,000 products daily'] }],
  skills: [{ name: 'Analytics', keywords: ['SQL', 'Python'] }],
  customSections: [
    {
      id: 'c1',
      name: 'Career break',
      enabledFields: ['dateRange', 'summary'],
      items: [{ id: 'i1', title: 'Parental leave', startDate: '2016', endDate: '2016', summary: 'Full-time parent.', highlights: ['Hidden highlight'] }],
    },
  ],
}
