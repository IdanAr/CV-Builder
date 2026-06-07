import type { ResumeData } from './schemas/resume.zod'

const COUNTABLE_SECTIONS = [
  'work', 'education', 'skills', 'certificates', 'awards',
  'publications', 'volunteer', 'languages', 'interests', 'projects',
] as const

type CountableSection = typeof COUNTABLE_SECTIONS[number]

export function sectionsFilledCount(data: ResumeData): number {
  return COUNTABLE_SECTIONS.filter((section: CountableSection) => {
    const val = data[section]
    return Array.isArray(val) && val.length > 0
  }).length
}
