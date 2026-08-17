// lib/applications/resume-status.ts
// Pure derivation of a résumé card's status badge from the Application rows
// that link to it, replacing the dead static `Resume.applicationStatus`
// field (set once at creation, never updated, and unable to represent a
// résumé backing multiple independently-tracked applications). No DB access
// here on purpose — callers fetch `Application`/`BoardConfig` themselves
// (see app/(dashboard)/dashboard/page.tsx) so this stays trivially testable.

const UNKNOWN_LABEL = 'Unknown'
const UNKNOWN_COLOR = '#94a3b8'

export type ResumeApplicationBadge =
  | { kind: 'none' }
  | { kind: 'single'; label: string; color: string }
  | { kind: 'multiple'; count: number }

export function computeResumeApplicationBadges(
  applications: Array<{ resumeId?: string; status: string }>,
  statusOptions: Array<{ id: string; label: string; color: string }>
): Map<string, ResumeApplicationBadge> {
  const optionById = new Map(statusOptions.map((o) => [o.id, o]))

  const rowsByResumeId = new Map<string, Array<{ status: string }>>()
  for (const app of applications) {
    if (!app.resumeId) continue
    const rows = rowsByResumeId.get(app.resumeId) ?? []
    rows.push({ status: app.status })
    rowsByResumeId.set(app.resumeId, rows)
  }

  const result = new Map<string, ResumeApplicationBadge>()
  for (const [resumeId, rows] of rowsByResumeId) {
    if (rows.length === 1) {
      const option = optionById.get(rows[0].status)
      result.set(resumeId, {
        kind: 'single',
        label: option?.label ?? UNKNOWN_LABEL,
        color: option?.color ?? UNKNOWN_COLOR,
      })
    } else {
      result.set(resumeId, { kind: 'multiple', count: rows.length })
    }
  }

  return result
}
