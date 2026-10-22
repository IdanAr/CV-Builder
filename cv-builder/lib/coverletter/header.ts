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

/** What a letter's company or role holds when the CV named none (an imported legacy letter). */
export const LEGACY_PLACEHOLDER = 'Unspecified'

/** A real value, or '' for blank text and the placeholder. */
const real = (value: string | undefined): string => {
  const v = clean(value)
  return v === LEGACY_PLACEHOLDER ? '' : v
}

/** The recipient block, one line each: the hiring manager (when named), then the company. Placeholders and blanks are dropped. */
export function letterRecipient(input: { company: string; hiringManager?: string }): string[] {
  return [clean(input.hiringManager), real(input.company)].filter(Boolean)
}

/** The subject line, or null when neither the role nor the company is known. */
export function letterSubject(input: { company: string; role: string; language: LetterLanguage }): string | null {
  const parts = [real(input.role), real(input.company)].filter(Boolean)
  if (parts.length === 0) return null
  return `${input.language === 'he' ? 'הנדון' : 'Re'}: ${parts.join(', ')}`
}

const MAX_FILE_TITLE = 120
// Characters a file name cannot hold on common systems, and control characters.
const UNSAFE_FILE_CHARS = /[\\/:*?"<>|\u0000-\u001f\u007f]/g

/**
 * The exported file's title: "Cover Letter - {role} - {company}". Placeholders are
 * dropped and file-name-unsafe characters removed, but Hebrew and other non-ASCII
 * letters stay (the route sends the name in an RFC 5987 header). At most 120 characters.
 */
export function letterFileTitle(input: { company: string; role: string }): string {
  const title = ['Cover Letter', real(input.role), real(input.company)]
    .map((part) => part.replace(UNSAFE_FILE_CHARS, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' - ')
  // Cut by code point so an emoji's surrogate pair is never split (encodeURIComponent throws on a lone half).
  // Cutting can leave a dangling separator; trim it off.
  return Array.from(title).slice(0, MAX_FILE_TITLE).join('').replace(/[\s-]+$/, '')
}
