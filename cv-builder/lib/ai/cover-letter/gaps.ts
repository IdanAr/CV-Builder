// lib/ai/cover-letter/gaps.ts
// Employment gaps the letter should address, found from the CV's dates. A gap
// is reported only when it is certain: its shortest possible length (latest
// possible end of the covered time to the earliest possible start of the next
// role, or to today) is over the threshold. "2022 to 2024" followed by "2024
// to present" is therefore never a gap, and a role without a start date is
// ignored rather than guessed. Time filled only by study, volunteering or a
// career break is still reported, with what fills it, so the letter can frame
// it in one constructive sentence instead of hiding it.
import { resolveEducationRoles, resolveWorkRoles } from '@/lib/roles'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import { formatMonth, monthRange, parseMonth } from './dates'

export type GapFiller = 'education' | 'volunteer' | 'custom'

export interface DetectedGap {
  /** First and last month of the gap, YYYY-MM. */
  from: string
  to: string
  months: number
  coveredBy: GapFiller[]
  /** What fills the gap and which of its months, so a letter never stretches part-time study over the whole gap. */
  filled: { kind: GapFiller; from: string; to: string }[]
  /** The end date of the role before the gap, as the CV writes it. */
  after: string
  /** False when that end date gives only a year, so the gap's first month is not known: say "at least N months", never a start month. */
  exactStart: boolean
}

interface Span {
  start: [number, number]
  end: [number, number]
  /** The end date as written ("present" when missing). */
  endText: string
}

function span(startDate: string | undefined, endDate: string | undefined, today: number): Span | null {
  if (!startDate) return null
  const start = monthRange(startDate, today)
  const end = monthRange(endDate, today)
  return start && end ? { start, end, endText: endDate?.trim() || 'present' } : null
}

function fillers(data: ResumeData, today: number): { kind: GapFiller; span: Span }[] {
  const out: { kind: GapFiller; span: Span }[] = []
  for (const edu of data.education ?? []) {
    for (const role of resolveEducationRoles(edu)) {
      const s = span(role.startDate, role.endDate, today)
      if (s) out.push({ kind: 'education', span: s })
    }
  }
  for (const vol of data.volunteer ?? []) {
    const s = span(vol.startDate, vol.endDate, today)
    if (s) out.push({ kind: 'volunteer', span: s })
  }
  for (const section of data.customSections ?? []) {
    if (!section.enabledFields.includes('dateRange')) continue
    for (const item of section.items ?? []) {
      for (const dated of [item, ...(item.roles ?? [])]) {
        const s = span(dated.startDate, dated.endDate, today)
        if (s) out.push({ kind: 'custom', span: s })
      }
    }
  }
  return out
}

export function detectGaps(data: ResumeData, today: string, minMonths = 6): DetectedGap[] {
  const now = parseMonth(today)
  const roles = (data.work ?? [])
    .flatMap((job) => resolveWorkRoles(job).map((r) => span(r.startDate, r.endDate, now)))
    .filter((s): s is Span => s !== null)
    .sort((a, b) => a.start[0] - b.start[0])
  if (roles.length === 0) return []

  const gaps: { from: number; to: number; before: Span }[] = []
  let last = roles[0]
  for (const role of roles.slice(1)) {
    if (role.start[0] - last.end[1] - 1 > minMonths) gaps.push({ from: last.end[1] + 1, to: role.start[0] - 1, before: last })
    if (role.end[1] > last.end[1]) last = role
  }
  if (now - last.end[1] > minMonths) gaps.push({ from: last.end[1] + 1, to: now, before: last })

  const fill = fillers(data, now)
  const order: GapFiller[] = ['education', 'volunteer', 'custom']
  return gaps.map(({ from, to, before }) => {
    const inside = fill.filter((f) => f.span.start[0] <= to && f.span.end[1] >= from)
    const kinds = new Set(inside.map((f) => f.kind))
    return {
      from: formatMonth(from),
      to: formatMonth(to),
      months: to - from + 1,
      coveredBy: order.filter((k) => kinds.has(k)),
      filled: inside.map((f) => ({ kind: f.kind, from: formatMonth(Math.max(f.span.start[0], from)), to: formatMonth(Math.min(f.span.end[1], to)) })),
      after: before.endText,
      exactStart: before.end[0] === before.end[1],
    }
  })
}
