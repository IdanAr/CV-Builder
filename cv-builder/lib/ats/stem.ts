// lib/ats/stem.ts
//
// A deliberately conservative suffix stemmer for keyword matching, so word
// forms an ATS search treats as one ("analysis", "analyst", "analyzed")
// match each other. It only has to be consistent (every form of a word
// family lands on the same stem), not linguistically correct, and it errs
// towards leaving words alone: a false match inflates a score, a missed one
// only fails to credit it.

const MIN_STEM = 4

/** Inflection: plural and verb endings. First rule that fits wins. */
const INFLECTION: [suffix: string, replacement: string][] = [
  ['ing', ''],
  ['ed', ''],
]

/** Derivation: noun/adjective endings, applied after inflection. First rule that fits wins. */
const DERIVATION: [suffix: string, replacement: string][] = [
  // analysis, analyses, analyst, analytics, analytical, analyze(d), analyse(d)
  ['ytically', 'y'], ['ytical', 'y'], ['ytics', 'y'], ['ytic', 'y'],
  ['ysis', 'y'], ['yses', 'y'], ['ysts', 'y'], ['yst', 'y'],
  ['yzer', 'y'], ['yser', 'y'], ['yze', 'y'], ['yse', 'y'], ['yz', 'y'], ['ys', 'y'],
  // optimization, optimize(d), optimiser
  ['izations', 'iz'], ['ization', 'iz'], ['isations', 'iz'], ['isation', 'iz'],
  ['izer', 'iz'], ['iser', 'iz'], ['ize', 'iz'], ['ise', 'iz'], ['is', 'iz'],
  // automation, automate(d)
  ['ation', 'at'],
  // statistics, statistical, statistician, statistic
  ['ically', ''], ['ician', ''], ['ical', ''], ['ics', ''], ['ic', ''],
  ['ments', ''], ['ment', ''],
  ['ness', ''],
  ['ities', ''], ['ity', ''],
  ['ion', ''],
  ['ial', ''],
  // No "-ive": it made "executive" and "execution" one word.
]

function stripFirst(word: string, rules: [string, string][]): string {
  for (const [suffix, replacement] of rules) {
    if (!word.endsWith(suffix)) continue
    const stem = word.slice(0, -suffix.length) + replacement
    if (stem.length >= MIN_STEM) return stem
  }
  return word
}

/** "processes" -> "process", "strategies" -> "strategy", "models" -> "model"; leaves "status", "class" alone. */
function stripPlural(word: string): string {
  if (word.endsWith('ss') || word.endsWith('us') || word.endsWith('is')) return word
  if (word.endsWith('ies')) {
    const stem = word.slice(0, -3) + 'y'
    if (stem.length >= MIN_STEM) return stem
  }
  if (/(s|x|z|ch|sh)es$/.test(word)) {
    const stem = word.slice(0, -2)
    if (stem.length >= MIN_STEM) return stem
  }
  if (word.endsWith('s')) {
    const stem = word.slice(0, -1)
    if (stem.length >= MIN_STEM) return stem
  }
  return word
}

export function stemWord(input: string): string {
  const word = input.toLowerCase()
  if (word.length <= MIN_STEM || !/^[a-z]+$/.test(word)) return word

  let stem = stripPlural(word)
  if (stem === word) stem = stripFirst(word, INFLECTION)
  stem = stripFirst(stem, DERIVATION)

  // "database"/"databases" -> "databas", "manage"/"managed" -> "manag".
  if (stem.endsWith('e') && stem.length - 1 >= MIN_STEM) stem = stem.slice(0, -1)
  // "planning" -> "plann" -> "plan", "skilled" -> "skill" -> "skil" (and "skill" -> "skil" too).
  if (/([b-df-hj-np-rtv-y])\1$/.test(stem) && stem.length - 1 >= MIN_STEM) stem = stem.slice(0, -1)

  return stem
}

/** Lowercase word tokens; hyphens and punctuation split words ("large-scale" -> "large", "scale"). */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? []
}

export function stemTokens(text: string): string[] {
  return tokenize(text).map(stemWord)
}
