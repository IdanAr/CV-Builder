import type { ResumeData, WorkRole, EducationRole, CustomSectionItem, CustomSectionRole } from './schemas/resume.zod'

type WorkItem = NonNullable<ResumeData['work']>[number]
type EducationItem = NonNullable<ResumeData['education']>[number]

export const LEGACY_ROLE_ID = 'legacy-role'

/**
 * Resolves the list of roles to render/edit for a Work entry, falling back
 * to the entry's own legacy top-level fields (position/dates/summary/
 * highlights) when roles is empty. Every render and edit surface must go
 * through this — not read item.roles or the legacy fields directly — so a
 * pre-nested-roles résumé's sole role doesn't disappear or get treated
 * differently from one stored in roles[]. Mirrors resolveProfiles().
 */
export function resolveWorkRoles(item: WorkItem | undefined): WorkRole[] {
  if (!item) return []
  const hasLegacyRole = Boolean(
    item.position || item.startDate || item.endDate || item.summary || (item.highlights && item.highlights.length > 0)
  )
  const rest = item.roles ?? []
  if (!hasLegacyRole) return rest
  // Every résumé built before this unification stores role 1 on the entry's
  // own fields and roles 2+ in item.roles — both can be populated on the
  // same document at once, so the legacy role must be prepended, never used
  // to the exclusion of item.roles (that would silently drop roles 2+ for
  // documents that already have a real roles[] array).
  const legacyRole: WorkRole = {
    id: LEGACY_ROLE_ID,
    position: item.position,
    startDate: item.startDate,
    endDate: item.endDate,
    summary: item.summary,
    highlights: item.highlights,
  }
  return [legacyRole, ...rest]
}

export function resolveEducationRoles(item: EducationItem | undefined): EducationRole[] {
  if (!item) return []
  const hasLegacyRole = Boolean(
    item.studyType || item.area || item.startDate || item.endDate || item.score || (item.courses && item.courses.length > 0)
  )
  const rest = item.roles ?? []
  if (!hasLegacyRole) return rest
  const legacyRole: EducationRole = {
    id: LEGACY_ROLE_ID,
    studyType: item.studyType,
    area: item.area,
    startDate: item.startDate,
    endDate: item.endDate,
    score: item.score,
    courses: item.courses,
  }
  return [legacyRole, ...rest]
}

export function resolveCustomSectionRoles(item: CustomSectionItem | undefined): CustomSectionRole[] {
  if (!item) return []
  const hasLegacyRole = Boolean(
    item.subtitle || item.startDate || item.endDate || item.summary || item.level ||
    (item.highlights && item.highlights.length > 0) || (item.keywords && item.keywords.length > 0)
  )
  const rest = item.roles ?? []
  if (!hasLegacyRole) return rest
  // role.title is unconditionally shown (like item.title), but item.subtitle
  // was always gated behind the 'subtitle' toggle — mapping it to role.title
  // would make previously-hidden content appear unconditionally. role.subtitle
  // preserves the exact same gating.
  const legacyRole: CustomSectionRole = {
    id: LEGACY_ROLE_ID,
    subtitle: item.subtitle,
    startDate: item.startDate,
    endDate: item.endDate,
    summary: item.summary,
    highlights: item.highlights,
    keywords: item.keywords,
    level: item.level,
  }
  return [legacyRole, ...rest]
}
