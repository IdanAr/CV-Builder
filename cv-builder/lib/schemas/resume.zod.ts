// lib/schemas/resume.zod.ts
import { z } from 'zod'
import { defaultSectionOrder } from '@/lib/sections'

// Auto-save fires while the user is mid-typing, so format checks on URL/email
// must not run at the schema layer — any string is accepted. Format feedback
// belongs in the UI form layer only.
const optionalUrl = () => z.string().optional()
const optionalEmail = () => z.string().optional()

const LocationSchema = z.object({
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryCode: z.string().optional(),
  region: z.string().optional(),
})

const ProfileSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  label: z.string().optional(),
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

export const WorkRoleSchema = z.object({
  id: z.string(),
  position: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
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
  roles: z.array(WorkRoleSchema).optional(),
})

export const EducationRoleSchema = z.object({
  id: z.string(),
  studyType: z.string().optional(),
  area: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  score: z.string().optional(),
  courses: z.array(z.string()).optional(),
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
  roles: z.array(EducationRoleSchema).optional(),
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
  'subtitle', 'url', 'dateRange', 'summary', 'highlights', 'keywords', 'level', 'roles',
] as const

export const CustomSectionRoleSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  level: z.string().optional(),
})

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
  roles: z.array(CustomSectionRoleSchema).optional(),
})

export const CustomSectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabledFields: z.array(z.enum(CUSTOM_SECTION_FIELDS)),
  items: z.array(CustomSectionItemSchema),
})

export const ApplicationStatusEnum = z.enum(['draft', 'applied', 'interviewing', 'offer', 'rejected'])
export type ApplicationStatus = z.infer<typeof ApplicationStatusEnum>

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
  coverLetter: z.string().optional(),
})

export const ResumeMetaSchema = z.object({
  templateId: z.string().default('classic'),
  fontFamily: z.string().default('Calibri'),
  headerFontFamily: z.string().default('Calibri'),
  primaryColor: z.string().default('#000000'),
  accentColor: z.string().default('#0066cc'),
  pageMargins: z.number().min(0.5).max(1.5).default(1.0),
  lineSpacing: z.number().min(1.0).max(1.15).default(1.15),
  sidebarRailWidth: z.number().min(20).max(40).default(33),
  // defaultSectionOrder (not a literal array) so the schema, the editor store,
  // the preview templates and both exporters cannot drift apart again, and so
  // each parse gets its own array to reorder.
  sectionOrder: z.array(z.string()).default(defaultSectionOrder),
  layout: z.enum(['single-column', 'two-column']).default('single-column'),
  columnAssignment: z.record(z.string(), z.enum(['left', 'right'])).default({}),
  excludedAtsKeywords: z.array(z.string()).default([]),
})

export const CreateResumeSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  data: ResumeDataSchema.optional().default({}),
  meta: ResumeMetaSchema.optional().default(() => ResumeMetaSchema.parse({})),
  applicationStatus: ApplicationStatusEnum.optional().default('draft'),
  targetCompany: z.string().trim().max(200).optional(),
  targetRole: z.string().trim().max(200).optional(),
  /**
   * AI-written phrases the hallucination guard could not trace back to the
   * user's own text (detectHallucinations' output).
   *
   * Top-level rather than inside `data` or `meta` on purpose: it is neither a
   * career fact nor a design setting, it is provenance about how this
   * document came to exist -- the same shelf as applicationStatus and
   * parentResumeId. Keeping it out of `data` preserves the two-tree
   * invariant.
   */
  // .optional() WITHOUT .default([]) deliberately. A Zod default makes the
  // field *required* in the inferred input type, so every existing
  // createResume caller would have to pass it -- the same trap this codebase
  // already documents for CreateScrapedJobInput's pendingApprovals. The
  // Mongoose schema defaults it to [], so nothing is lost.
  pendingApprovals: z.array(z.string()).optional(),
})

type Undefaulted<T> = T extends z.ZodDefault<infer Inner> ? Inner : T

/**
 * Every field of a shape, stripped of its `.default()` and made optional,
 * with all other validation (min/max, enums) intact.
 *
 * Deliberately NOT `.partial()`: in Zod 4 that leaves the ZodDefault in place
 * underneath the ZodOptional, so an absent key still parses to the default
 * rather than to undefined. patchResume writes back every key that comes out
 * defined, as a `meta.<key>` dot-path $set -- so under `.partial()` a
 * one-field design tweak would quietly reset template, fonts, colours,
 * margins and section order along with it.
 */
function undefaultedShape<S extends z.ZodRawShape>(shape: S) {
  return Object.fromEntries(
    Object.entries(shape).map(([key, field]) => {
      const base = (field instanceof z.ZodDefault ? field.def.innerType : field) as z.ZodType
      return [key, base.optional()]
    })
  ) as unknown as { [K in keyof S]: z.ZodOptional<Undefaulted<S[K]>> }
}

// Derived from ResumeMetaSchema rather than restated. The hand-written copy
// this replaces had to be edited in lockstep with it, and a field added to one
// but not the other would have been silently unpatchable.
const ResumeMetaPatchSchema = z.object(undefaultedShape(ResumeMetaSchema.shape))

export const PatchResumeSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  data: ResumeDataSchema.optional(),
  meta: ResumeMetaPatchSchema.optional(),
  applicationStatus: ApplicationStatusEnum.optional(),
  targetCompany: z.string().trim().max(200).optional(),
  targetRole: z.string().trim().max(200).optional(),
  // Clearing this to [] is the user attesting they have checked the flagged
  // claims -- the same blanket-attestation trust model approveScrapedJob
  // already uses for the queue.
  pendingApprovals: z.array(z.string()).optional(),
})

export type ResumeData = z.infer<typeof ResumeDataSchema>
export type ResumeMeta = z.infer<typeof ResumeMetaSchema>
export type CustomSection = z.infer<typeof CustomSectionSchema>
export type CustomSectionItem = z.infer<typeof CustomSectionItemSchema>
export type CustomSectionFieldType = typeof CUSTOM_SECTION_FIELDS[number]
export type WorkRole = z.infer<typeof WorkRoleSchema>
export type EducationRole = z.infer<typeof EducationRoleSchema>
export type CustomSectionRole = z.infer<typeof CustomSectionRoleSchema>
export type CreateResumeInput = z.infer<typeof CreateResumeSchema>
export type PatchResumeInput = z.infer<typeof PatchResumeSchema>
