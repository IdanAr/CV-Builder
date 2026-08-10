import type { ResumeData } from './resume.zod'

export type WorkEntry = NonNullable<ResumeData['work']>[number]
export type EducationEntry = NonNullable<ResumeData['education']>[number]
export type SkillEntry = NonNullable<ResumeData['skills']>[number]
export type CertificateEntry = NonNullable<ResumeData['certificates']>[number]
export type AwardEntry = NonNullable<ResumeData['awards']>[number]
export type PublicationEntry = NonNullable<ResumeData['publications']>[number]
export type VolunteerEntry = NonNullable<ResumeData['volunteer']>[number]
export type LanguageEntry = NonNullable<ResumeData['languages']>[number]
export type InterestEntry = NonNullable<ResumeData['interests']>[number]
export type ProjectEntry = NonNullable<ResumeData['projects']>[number]
export type ProfileEntry = NonNullable<NonNullable<ResumeData['basics']>['profiles']>[number]

export function createEmptyWork(): WorkEntry {
  return { name: '', position: '', url: '', startDate: '', endDate: '', summary: '', highlights: [] }
}

export function createEmptyEducation(): EducationEntry {
  return { institution: '', url: '', area: '', studyType: '', startDate: '', endDate: '', score: '', courses: [] }
}

export function createEmptySkill(): SkillEntry {
  return { name: '', level: '', keywords: [] }
}

export function createEmptyCertificate(): CertificateEntry {
  return { name: '', date: '', issuer: '', url: '' }
}

export function createEmptyAward(): AwardEntry {
  return { title: '', date: '', awarder: '', summary: '' }
}

export function createEmptyPublication(): PublicationEntry {
  return { name: '', publisher: '', releaseDate: '', url: '', summary: '' }
}

export function createEmptyVolunteer(): VolunteerEntry {
  return { organization: '', position: '', url: '', startDate: '', endDate: '', summary: '', highlights: [] }
}

export function createEmptyLanguage(): LanguageEntry {
  return { language: '', fluency: '' }
}

export function createEmptyInterest(): InterestEntry {
  return { name: '', keywords: [] }
}

export function createEmptyProject(): ProjectEntry {
  return { name: '', description: '', highlights: [], keywords: [], startDate: '', endDate: '', url: '' }
}

export function createEmptyProfile(): ProfileEntry {
  return { id: crypto.randomUUID(), label: '', url: '' }
}

export const EMPTY_ENTRY_FACTORIES: Record<string, () => unknown> = {
  work: createEmptyWork,
  education: createEmptyEducation,
  skills: createEmptySkill,
  certificates: createEmptyCertificate,
  awards: createEmptyAward,
  publications: createEmptyPublication,
  volunteer: createEmptyVolunteer,
  languages: createEmptyLanguage,
  interests: createEmptyInterest,
  projects: createEmptyProject,
}
