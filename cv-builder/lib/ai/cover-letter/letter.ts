// lib/ai/cover-letter/letter.ts
// The structured letter the writer returns: each sentence carries the fact IDs
// and posting quotes it relies on, so the verifier can check it. Also the style
// constants shared by the writer, the verifier and the eval rubric.

export interface LetterSentence {
  text: string
  /** IDs from the fact sheet (F1, F2, ...) this sentence relies on. */
  facts: string[]
  /** Exact snippets of the posting this sentence relies on. */
  quotes: string[]
}

export interface StructuredLetter {
  greeting: string
  /** Body paragraphs, each a list of sentences; the closing paragraph is the last one. */
  paragraphs: LetterSentence[][]
  signOff: string
}

/** Working length band for the whole letter, in words. The writer aims for 250-350. */
export const WORD_BAND = { min: 250, max: 400 } as const

/** Lower floor when the CV supports fewer than two of the employer's needs, so the letter is short rather than padded. */
export const SPARSE_WORD_FLOOR = 180

/**
 * Phrases recruiters read as filler. Matched case-insensitively as substrings,
 * so keep each one specific enough not to hit ordinary sentences.
 */
export const BANNED_PHRASES = [
  'to whom it may concern',
  'i am writing to express',
  'i am writing to apply',
  'i am excited to apply',
  "i'm excited to apply",
  'proven track record',
  'passionate about',
  'hard worker',
  'hard-working',
  'team player',
  'results-driven',
  'detail-oriented',
  'go-getter',
  'think outside the box',
  'dynamic',
  'synergy',
  'leverage my',
  'i am confident that',
  'i believe i would be a great fit',
  'perfect fit',
  'thank you for your time and consideration',
] as const

export function renderLetter(letter: StructuredLetter): string {
  const body = letter.paragraphs.map((p) => p.map((s) => s.text.trim()).join(' ')).filter(Boolean)
  return [letter.greeting.trim(), ...body, letter.signOff.trim()].filter(Boolean).join('\n\n')
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
