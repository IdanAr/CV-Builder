/* Shared sample résumé used by template cards, the UI kit preview, and the
   starter templates so every surface shows realistic, consistent content. */
export const SampleResume = {
  basics: {
    name: 'Maya Hartfield',
    label: 'Senior Product Designer',
    email: 'maya.hartfield@email.com',
    phone: '+1 (415) 555-0182',
    url: 'mayahart.design',
    location: { city: 'San Francisco', region: 'CA' },
    summary:
      'Senior product designer with 8+ years shaping end-to-end experiences for SaaS and fintech. Led design for products serving 2M+ users, lifting activation by 34% through systems thinking and rigorous research.',
  },
  work: [
    {
      name: 'Lumen Financial', position: 'Senior Product Designer',
      startDate: '2021-03', endDate: '',
      highlights: [
        'Drove a 34% increase in onboarding completion by redesigning the account-funding flow.',
        'Built and maintained a 60-component design system adopted by 4 product teams.',
        'Mentored 3 designers; established weekly critique and research-readout rituals.',
      ],
    },
    {
      name: 'Northwind Labs', position: 'Product Designer',
      startDate: '2018-06', endDate: '2021-02',
      highlights: [
        'Shipped the mobile dashboard that grew DAU 22% quarter-over-quarter.',
        'Ran 40+ usability sessions translating findings into a prioritized roadmap.',
      ],
    },
  ],
  education: [
    { institution: 'Rhode Island School of Design', studyType: 'BFA', area: 'Graphic Design', startDate: '2010-09', endDate: '2014-05', score: '3.8 GPA' },
  ],
  skills: [
    { name: 'Design', level: 'Expert', keywords: ['Figma', 'Design Systems', 'Prototyping', 'Interaction'] },
    { name: 'Research', level: 'Advanced', keywords: ['Usability Testing', 'Surveys', 'A/B Testing'] },
    { name: 'Frontend', level: 'Intermediate', keywords: ['HTML', 'CSS', 'React'] },
  ],
  languages: [
    { language: 'English', fluency: 'Native' },
    { language: 'Spanish', fluency: 'Professional' },
  ],
  volunteer: [
    { organization: 'AIGA SF', position: 'Mentor', startDate: '2019-01', endDate: '', summary: 'Mentor early-career designers through portfolio reviews.' },
  ],
}

/** Per-template default design metadata. */
export const SampleMeta = {
  classic:   { templateId: 'classic',   fontFamily: 'Calibri',       headerFontFamily: 'Calibri',       primaryColor: '#1f2937', accentColor: '#2563eb' },
  modern:    { templateId: 'modern',    fontFamily: 'Lato',          headerFontFamily: 'Lato',          primaryColor: '#4338ca', accentColor: '#6366f1' },
  minimal:   { templateId: 'minimal',   fontFamily: 'Georgia',       headerFontFamily: 'Georgia',       primaryColor: '#333333', accentColor: '#444444' },
  executive: { templateId: 'executive', fontFamily: 'Georgia',       headerFontFamily: 'Georgia',       primaryColor: '#1a1a1a', accentColor: '#7c3aed' },
  sidebar:   { templateId: 'sidebar',   fontFamily: 'IBM Plex Sans', headerFontFamily: 'IBM Plex Sans', primaryColor: '#312e81', accentColor: '#6366f1' },
}
