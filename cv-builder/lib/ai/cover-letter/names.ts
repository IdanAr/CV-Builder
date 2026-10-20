// lib/ai/cover-letter/names.ts
// Decides whether a sentence names an employer, institution or project from
// the CV, tolerating the ways a letter shortens or respells it ("Bright Path"
// for "Bright Path Software Technologies", "IEC" for "Israel Electric
// Corporation", "Riviere" for "Rivière"). The verifier uses this to catch an
// achievement credited to the wrong employer.

/** Trailing words that do not identify an organisation. University, College and Academy are kept. */
const SUFFIXES = new Set(['ltd', 'inc', 'llc', 'corp', 'corporation', 'co', 'software', 'technologies', 'technology', 'group', 'plc', 'gmbh'])

/**
 * Words that cannot identify an organisation on their own: places, languages
 * and filler. A name whose leading word is one of these is only matched in
 * full (or by its initials), so "moved to Israel" never reads as "Israel
 * Electric Corporation".
 */
export const GENERIC_WORDS = new Set([
  'the', 'israel', 'israeli', 'tel', 'aviv', 'jerusalem', 'haifa', 'beer', 'sheva', 'america', 'american', 'europe', 'european',
  'hebrew', 'english', 'arabic', 'russian', 'french', 'global', 'international', 'national', 'united', 'general', 'first', 'new',
  'data', 'digital', 'bank', 'group', 'solutions', 'systems', 'services', 'consulting', 'partners', 'capital', 'ministry',
  'university', 'college', 'academy', 'institute', 'school', 'open', 'central', 'north', 'south', 'east', 'west',
])

const CONNECTORS = new Set(['of', 'and', 'the', 'for', 'de'])

const stripMarks = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '')

function foldText(s: string): string {
  return stripMarks(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function foldName(s: string): string {
  const words = foldText(s).split(' ').filter(Boolean)
  while (words.length > 0 && SUFFIXES.has(words[words.length - 1])) words.pop()
  return words.join(' ')
}

export function parentheticalAliases(name: string): { base: string; aliases: string[] } {
  const aliases = [...name.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].trim()).filter(Boolean)
  const base = name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  return { base, aliases }
}

const isAllCaps = (word: string) => /\p{Lu}/u.test(word) && !/\p{Ll}/u.test(word)

/**
 * The forms a mention may take. Lower-case variants are compared with the
 * folded sentence; upper-case ones (initials, all-caps tokens such as "SAS")
 * are compared case-sensitively with the original sentence, so "Sassy" never
 * matches "SAS".
 */
export function nameVariants(name: string, aliases: string[] = []): string[] {
  const split = parentheticalAliases(name)
  const out = new Set<string>()
  const folded = foldName(split.base)
  if (folded) out.add(folded)

  const original = split.base.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const significant = original.filter((w) => !CONNECTORS.has(w.toLowerCase()))
  if (significant.length >= 3) out.add(significant.map((w) => w[0].toUpperCase()).join(''))

  const words = folded.split(' ').filter(Boolean)
  if (words.length >= 3 && !words.slice(0, 2).every((w) => GENERIC_WORDS.has(w))) out.add(words.slice(0, 2).join(' '))
  // A distinctive leading word alone ("Acme" for "Acme Analytics"). It keeps
  // its capitals and is matched case-sensitively, so "a bright idea" never
  // reads as "Bright Path". Scripts without case (Hebrew) match folded.
  const lead = stripMarks(original[0] ?? '')
  if (words.length >= 2 && lead.length >= 2 && !GENERIC_WORDS.has(words[0])) {
    if (isAllCaps(lead)) out.add(lead)
    else if (lead.length >= 3 && /^\p{Lu}/u.test(lead)) out.add(lead)
    else if (lead.length >= 3 && !/[\p{Lu}\p{Ll}]/u.test(lead)) out.add(words[0])
  }

  for (const alias of [...split.aliases, ...aliases]) {
    if (isAllCaps(alias.replace(/[^\p{L}]/gu, ''))) out.add(alias.trim())
    else {
      const a = foldName(alias)
      if (a) out.add(a)
    }
  }
  return [...out]
}

export function mentionsName(text: string, variants: string[]): boolean {
  if (variants.length === 0) return false
  const folded = ` ${foldText(text)} `
  return variants.some((v) => {
    if (/\p{Lu}/u.test(v)) {
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(stripMarks(text))
    }
    return folded.includes(` ${v} `)
  })
}
