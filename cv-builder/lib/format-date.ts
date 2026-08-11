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
// "Present" only shows when `end` is literally that string (the sentinel
// MonthYearPicker's "Present" checkbox writes) — a blank/unknown end date
// must never be presented as "currently ongoing"; it just renders nothing.
export function formatDateRange(
  start: string | undefined | null,
  end: string | undefined | null
): string {
  const endStr = end === 'Present' ? 'Present' : formatDate(end)
  return [formatDate(start), endStr].filter(Boolean).join(' - ')
}
