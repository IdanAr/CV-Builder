// Converts ISO date strings to display format.
// "YYYY-MM" → "MM/YYYY"  |  "YYYY" → "YYYY"  |  anything else → as-is
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  const match = dateStr.match(/^(\d{4})-(\d{2})/)
  if (match) return `${match[2]}/${match[1]}`
  return dateStr
}

// Joins two dates with a plain hyphen (" - "), the most reliably parsed
// separator for ATS date-range extraction (en-dashes confuse some parsers).
// When `presentWhenOpen` is true, a missing end date renders as "Present".
export function formatDateRange(
  start: string | undefined | null,
  end: string | undefined | null,
  presentWhenOpen = false
): string {
  const endStr = formatDate(end) || (presentWhenOpen ? 'Present' : '')
  return [formatDate(start), endStr].filter(Boolean).join(' - ')
}

/**
 * Date range spanning a primary entry plus any additional roles under the
 * same company/institution — earliest start to latest end. Used for the
 * header row of a multi-role Work/Education/custom-section entry, where each
 * individual role still shows its own range via formatDateRange.
 */
export function aggregateDateRange(
  entries: Array<{ startDate?: string | null; endDate?: string | null }>,
  presentWhenOpen = false
): string {
  const starts = entries.map(e => e.startDate).filter((d): d is string => !!d)
  const hasOpenEntry = presentWhenOpen && entries.some(e => !e.endDate)
  const ends = entries.map(e => e.endDate).filter((d): d is string => !!d)
  const start = starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : undefined
  const end = hasOpenEntry ? undefined : (ends.length > 0 ? ends.reduce((a, b) => (a > b ? a : b)) : undefined)
  return formatDateRange(start, end, hasOpenEntry)
}
