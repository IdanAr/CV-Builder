import type { ResumeApplicationBadge } from '@/lib/applications/resume-status'
import { templateLabel } from '@/lib/templates'

/**
 * One CV as the library renders it. Built on the server from a `listResumes`
 * document and handed to client components, so every field is plain JSON:
 * ids are strings and dates are ISO strings.
 *
 * `data` and `meta` ride along untouched for the card thumbnails, which render
 * the real preview template. Nothing here reads design concerns back into the
 * data tree.
 */
export interface CvRow {
  id: string
  title: string
  roleLabel: string
  templateId: string
  templateLabel: string
  formatScore: number
  sectionsFilledCount: number
  layout: string
  createdAt: string
  updatedAt: string
  parentResumeId?: string
  parentResumeTitle?: string
  badge: ResumeApplicationBadge
  pendingClaims: number
  data: unknown
  meta: unknown
}

export type CvSortKey = 'name' | 'ats' | 'edited'
export type CvSortDir = 'asc' | 'desc'

/** The subset of a `listResumes` document the library reads. */
export interface CvSourceResume {
  _id: unknown
  title: string
  data?: unknown
  meta?: unknown
  sectionsFilledCount: number
  formatScore?: number
  createdAt: Date | string
  updatedAt: Date | string
  parentResumeId?: unknown
  parentResumeTitle?: string
  pendingApprovals?: string[] | null
}

const NO_ROLE = 'No role set'

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString()
}

export function toCvRow(resume: CvSourceResume, badge: ResumeApplicationBadge): CvRow {
  const data = (resume.data ?? {}) as { basics?: { label?: string } }
  const meta = (resume.meta ?? {}) as { templateId?: string; layout?: string }
  const role = data.basics?.label?.trim()
  const templateId = meta.templateId ?? 'classic'

  return {
    id: String(resume._id),
    title: resume.title,
    roleLabel: role ? role : NO_ROLE,
    templateId,
    templateLabel: templateLabel(templateId),
    formatScore: resume.formatScore ?? 0,
    sectionsFilledCount: resume.sectionsFilledCount,
    layout: (meta.layout ?? 'single-column').replace('-', ' '),
    createdAt: toIso(resume.createdAt),
    updatedAt: toIso(resume.updatedAt),
    parentResumeId: resume.parentResumeId ? String(resume.parentResumeId) : undefined,
    parentResumeTitle: resume.parentResumeTitle,
    badge,
    pendingClaims: resume.pendingApprovals?.length ?? 0,
    data: resume.data ?? {},
    meta: resume.meta ?? {},
  }
}

function compare(a: CvRow, b: CvRow, key: CvSortKey): number {
  switch (key) {
    case 'name':
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    case 'ats':
      return a.formatScore - b.formatScore
    case 'edited':
      return Date.parse(a.updatedAt) - Date.parse(b.updatedAt)
  }
}

/**
 * Returns a new, sorted array. Ties keep their incoming order in both
 * directions (descending flips the comparison, not the result), so toggling
 * direction never reshuffles rows that compare equal.
 */
export function sortRows(rows: readonly CvRow[], key: CvSortKey, dir: CvSortDir): CvRow[] {
  const sign = dir === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => sign * compare(a.row, b.row, key) || a.index - b.index)
    .map(({ row }) => row)
}

/**
 * Colour for an ATS format score out of 25. Callers always render the
 * `N/25` text alongside it: colour is never the only signal.
 */
export function atsToneClass(score: number): string {
  if (score >= 20) return 'text-fg-success'
  if (score >= 10) return 'text-fg-warning'
  return 'text-fg-danger'
}
