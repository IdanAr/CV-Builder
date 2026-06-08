// lib/schemas/resume.zod.ts
import { z } from 'zod'

// Form inputs clear to '' rather than undefined; treat '' as absent so that
// z.string().url()/.email() format checks don't reject cleared fields.
const optionalUrl = () => z.union([z.string().url(), z.literal('')]).optional()
const optionalEmail = () => z.union([z.string().email(), z.literal('')]).optional()

const LocationSchema = z.object({
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryCode: z.string().optional(),
  region: z.string().optional(),
})

const ProfileSchema = z.object({
  network: z.string().optional(),
  username: z.string().optional(),
  url: optionalUrl(),
})

const BasicsSchema = z.object({
  name: z.string().optional(),
  label: z.string().optional(),
  image: z.string().optional(),
  email: optionalEmail(),
  phone: z.string().optional(),
  url: optionalUrl(),
  summary: z.string().optional(),
  location: LocationSchema.optional(),
  profiles: z.array(ProfileSchema).optional(),
})

const WorkSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  position: z.string().optional(),
  url: optionalUrl(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
})

const EducationSchema = z.object({
  institution: z.string().optional(),
  url: optionalUrl(),
  area: z.string().optional(),
  studyType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  score: z.string().optional(),
  courses: z.array(z.string()).optional(),
})

const SkillSchema = z.object({
  name: z.string().optional(),
  level: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

const CertificateSchema = z.object({
  name: z.string().optional(),
  date: z.string().optional(),
  issuer: z.string().optional(),
  url: optionalUrl(),
})

const AwardSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  awarder: z.string().optional(),
  summary: z.string().optional(),
})

const PublicationSchema = z.object({
  name: z.string().optional(),
  publisher: z.string().optional(),
  releaseDate: z.string().optional(),
  url: optionalUrl(),
  summary: z.string().optional(),
})

const VolunteerSchema = z.object({
  organization: z.string().optional(),
  position: z.string().optional(),
  url: optionalUrl(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
})

const LanguageSchema = z.object({
  language: z.string().optional(),
  fluency: z.string().optional(),
})

const InterestSchema = z.object({
  name: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

const ProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  url: optionalUrl(),
  roles: z.array(z.string()).optional(),
  entity: z.string().optional(),
  type: z.string().optional(),
})

export const CUSTOM_SECTION_FIELDS = [
  'subtitle', 'url', 'dateRange', 'summary', 'highlights', 'keywords', 'level',
] as const

const CustomSectionItemSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  url: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  level: z.string().optional(),
})

export const CustomSectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabledFields: z.array(z.enum(CUSTOM_SECTION_FIELDS)),
  items: z.array(CustomSectionItemSchema),
})

export const ResumeDataSchema = z.object({
  basics: BasicsSchema.optional(),
  work: z.array(WorkSchema).optional(),
  education: z.array(EducationSchema).optional(),
  skills: z.array(SkillSchema).optional(),
  certificates: z.array(CertificateSchema).optional(),
  awards: z.array(AwardSchema).optional(),
  publications: z.array(PublicationSchema).optional(),
  volunteer: z.array(VolunteerSchema).optional(),
  languages: z.array(LanguageSchema).optional(),
  interests: z.array(InterestSchema).optional(),
  projects: z.array(ProjectSchema).optional(),
  customSections: z.array(CustomSectionSchema).optional(),
})

export const ResumeMetaSchema = z.object({
  templateId: z.string().default('classic'),
  fontFamily: z.string().default('Calibri'),
  headerFontFamily: z.string().default('Calibri'),
  primaryColor: z.string().default('#000000'),
  accentColor: z.string().default('#0066cc'),
  pageMargins: z.number().min(0.5).max(1.5).default(1.0),
  lineSpacing: z.number().min(1.0).max(1.15).default(1.15),
  sectionOrder: z
    .array(z.string())
    .default(['work', 'education', 'skills', 'volunteer', 'languages']),
  layout: z.enum(['single-column', 'two-column']).default('single-column'),
})

export const CreateResumeSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  data: ResumeDataSchema.optional().default({}),
  meta: ResumeMetaSchema.optional().default(() => ResumeMetaSchema.parse({})),
})

const ResumeMetaPatchSchema = z.object({
  templateId: z.string().optional(),
  fontFamily: z.string().optional(),
  headerFontFamily: z.string().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  pageMargins: z.number().min(0.5).max(1.5).optional(),
  lineSpacing: z.number().min(1.0).max(1.15).optional(),
  sectionOrder: z.array(z.string()).optional(),
  layout: z.enum(['single-column', 'two-column']).optional(),
})

export const PatchResumeSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  data: ResumeDataSchema.optional(),
  meta: ResumeMetaPatchSchema.optional(),
})

export type ResumeData = z.infer<typeof ResumeDataSchema>
export type ResumeMeta = z.infer<typeof ResumeMetaSchema>
export type CustomSection = z.infer<typeof CustomSectionSchema>
export type CustomSectionItem = z.infer<typeof CustomSectionItemSchema>
export type CustomSectionFieldType = typeof CUSTOM_SECTION_FIELDS[number]
export type CreateResumeInput = z.infer<typeof CreateResumeSchema>
export type PatchResumeInput = z.infer<typeof PatchResumeSchema>
