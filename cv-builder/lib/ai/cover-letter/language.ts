// lib/ai/cover-letter/language.ts
// The letter is written in the language of the posting. Only Hebrew and
// English are supported, so this answers 'he' or 'en'.
const LETTER = /\p{L}/gu
const HEBREW_LETTER = /\p{Script=Hebrew}/gu
const HEBREW_SHARE = 0.3

/** 'he' when at least 30% of the letters are Hebrew script, otherwise 'en'. */
export function detectLanguage(text: string): 'en' | 'he' {
  const letters = text.match(LETTER)?.length ?? 0
  if (letters === 0) return 'en'
  const hebrew = text.match(HEBREW_LETTER)?.length ?? 0
  return hebrew / letters >= HEBREW_SHARE ? 'he' : 'en'
}
