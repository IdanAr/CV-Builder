// lib/ai/cover-letter/dates.ts
// CV dates as ranges of months at the precision they were written: "2019"
// could mean any month of 2019, so it spans 2019-01 to 2019-12. Months are
// counted as year * 12 + month - 1.

/** The months a CV date could mean, or null when it has no year. A missing date or "present" is today. */
export function monthRange(date: string | undefined, today: number): [number, number] | null {
  if (!date || /present|current|now/i.test(date)) return [today, today]
  const ym = date.match(/(\d{4})\D(\d{1,2})/)
  if (ym) {
    const m = Number(ym[1]) * 12 + Number(ym[2]) - 1
    return [m, m]
  }
  const y = date.match(/(\d{4})/)
  return y ? [Number(y[1]) * 12, Number(y[1]) * 12 + 11] : null
}

/** "YYYY-MM" as a month number; the current month when the string is not in that form. */
export function parseMonth(yyyyMm: string): number {
  const m = yyyyMm.match(/(\d{4})-(\d{2})/)
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : new Date().getFullYear() * 12 + new Date().getMonth()
}

export function formatMonth(month: number): string {
  return `${Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, '0')}`
}
