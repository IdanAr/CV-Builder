import type { ResumeData } from '@/lib/schemas/resume.zod'

export type LetterLanguage = 'en' | 'he'

/** BCP 47 tag for the exported file's language attribute and the date format. */
export function letterLocale(language: LetterLanguage): 'en-GB' | 'he-IL' {
  return language === 'he' ? 'he-IL' : 'en-GB'
}

/** Anything but 'he' is English, so a bad request value never reaches a renderer. */
export function parseLetterLanguage(value: unknown): LetterLanguage {
  return value === 'he' ? 'he' : 'en'
}

const clean = (value: string | undefined): string => (value ?? '').trim()

/**
 * The header block of an exported letter: the name, one contact line from
 * `basics`, and the date. Pure: the caller passes the date in.
 *
 * The date is formatted in UTC. The server's own zone must not move the day,
 * and the request carries no zone of its own to use instead.
 */
export function letterHeader(
  basics: ResumeData['basics'],
  date: Date,
  language: LetterLanguage,
): { name: string; contact: string; date: string } {
  const profileUrl = (basics?.profiles ?? []).map((p) => clean(p.url)).find(Boolean)
  const contact = [clean(basics?.email), clean(basics?.phone), clean(basics?.location?.city), profileUrl ?? '']
    .filter(Boolean)
    .join(' · ')

  const formatted = new Intl.DateTimeFormat(letterLocale(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)

  return { name: clean(basics?.name), contact, date: formatted }
}
