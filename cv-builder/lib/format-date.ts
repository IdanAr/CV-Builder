// Converts ISO date strings to display format.
// "YYYY-MM" → "MM/YYYY"  |  "YYYY" → "YYYY"  |  anything else → as-is
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  const match = dateStr.match(/^(\d{4})-(\d{2})/)
  if (match) return `${match[2]}/${match[1]}`
  return dateStr
}
