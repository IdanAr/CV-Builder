// scripts/cover-letter-eval/checks.ts
// Deterministic checks on a generated cover letter. These need no model and
// give the same answer every run, so they carry the hard pass/fail gates; the
// LLM judge (rubric.ts) covers what a pattern cannot see.
import { extractKeywords, keywordOverlap } from '@/lib/ats/keywords'
import { BANNED_PHRASES, WORD_BAND } from './rubric'

export { htmlToText } from '@/lib/text/html-to-text'

/** Greeting words that address a role or team rather than a named person. */
const NON_NAME_WORDS = /\b(hiring|team|manager|recruit\w*|committee|talent|people|department|members?|sir|madam|colleagues)\b/i

export interface LetterChecks {
  words: number
  inWordBand: boolean
  paragraphs: number
  bannedPhrases: string[]
  hasEmDash: boolean
  placeholders: string[]
  greeting: string | null
  formalGreeting: boolean
  /** A person named in the greeting who appears nowhere in the posting. */
  inventedAddressee: string | null
  hasSignOff: boolean
  /** Job keywords the résumé supports; only these can honestly appear in the letter. */
  supportedKeywords: string[]
  coveredKeywords: string[]
  keywordCoverage: number | null
}

export function checkLetter(input: {
  letter: string
  jobText: string
  resumeText: string
  candidateName: string
}): LetterChecks {
  const letter = input.letter.trim()
  const lines = letter.split('\n').map((l) => l.trim()).filter(Boolean)
  const lower = letter.toLowerCase()

  const greeting = lines.find((l) => /^(dear|to|hello|hi)\b/i.test(l)) ?? null
  let inventedAddressee: string | null = null
  const addressee = greeting?.match(/^dear\s+(.+?)[,:]?$/i)?.[1]?.trim()
  if (addressee && !NON_NAME_WORDS.test(addressee)) {
    const nameWords = addressee.replace(/^(mr|ms|mrs|dr|prof)\.?\s+/i, '').split(/\s+/)
    if (!nameWords.some((w) => w.length > 1 && input.jobText.toLowerCase().includes(w.toLowerCase()))) {
      inventedAddressee = addressee
    }
  }

  const tail = lines.slice(-3).join(' ').toLowerCase()
  const firstName = input.candidateName.split(/\s+/)[0]?.toLowerCase() ?? ''
  const hasSignOff = /\b(sincerely|regards|respectfully|thank you|best)\b/.test(tail) && firstName !== '' && tail.includes(firstName)

  const jdKeywords = extractKeywords(input.jobText)
  const supportedKeywords = keywordOverlap(input.resumeText, jdKeywords).matched
  const coveredKeywords = keywordOverlap(letter, supportedKeywords).matched

  const words = letter ? letter.split(/\s+/).length : 0
  return {
    words,
    inWordBand: words >= WORD_BAND.min && words <= WORD_BAND.max,
    paragraphs: letter ? letter.split(/\n\s*\n/).filter((p) => p.trim()).length : 0,
    bannedPhrases: BANNED_PHRASES.filter((p) => lower.includes(p)),
    hasEmDash: letter.includes('—'),
    placeholders: letter.match(/\[[^\]\n]{2,40}\]/g) ?? [],
    greeting,
    formalGreeting: greeting !== null && /^dear\b/i.test(greeting) && !/whom it may concern/i.test(greeting),
    inventedAddressee,
    hasSignOff,
    supportedKeywords,
    coveredKeywords,
    keywordCoverage: supportedKeywords.length ? coveredKeywords.length / supportedKeywords.length : null,
  }
}
