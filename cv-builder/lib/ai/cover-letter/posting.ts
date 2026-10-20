// lib/ai/cover-letter/posting.ts
// Cleans what the letter is written against. Scraped company names carry
// noise ("Acme/71.00A") or arrive lower-cased ("forter"), postings
// arrive as HTML, and some are listed by an intermediary on behalf of an
// unnamed partner, in which case the letter must not treat the intermediary
// as the employer.
import { MAX_JD_LENGTH } from '@/lib/ai/jd-extraction-pipeline'
import { htmlToText } from '@/lib/text/html-to-text'

export interface PostingInfo {
  /** Display name for the greeting and the letter. */
  company: string
  /** False when the posting is listed on behalf of an unnamed partner or client. */
  employerNamed: boolean
  /** Plain text, capped at MAX_JD_LENGTH. */
  text: string
}

/** Drops scraper suffixes: a trailing "/..." segment and trailing codes such as "71.00A". */
export function cleanCompanyName(raw: string): string {
  return raw
    .replace(/\s*\/.*$/, '')
    .replace(/\s+\d+(?:\.\d+)?[A-Z]?$/, '')
    .trim()
}

const INTERMEDIARY =
  /\b(?:on behalf of (?:a|an|our|one of our) (?:partner|client)|our (?:partner|client) is (?:looking|hiring|seeking)|hiring (?:for|on behalf of) (?:one of )?(?:its|our|their) (?:clients?|partners?))\b/i

/** The posting's own casing for a name scraped in lower case ("forter" becomes "Forter"), if it uses one. */
function postingCasing(name: string, text: string): string {
  if (/\p{Lu}/u.test(name)) return name
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const counts = new Map<string, number>()
  for (const m of text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'))) {
    if (/\p{Lu}/u.test(m[0])) counts.set(m[0], (counts.get(m[0]) ?? 0) + 1)
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return best ? best[0] : name
}

export function preparePosting(input: { company: string; jobText: string }): PostingInfo {
  const text = htmlToText(input.jobText).slice(0, MAX_JD_LENGTH)
  return {
    company: postingCasing(cleanCompanyName(input.company), text),
    employerNamed: !INTERMEDIARY.test(text),
    text,
  }
}
