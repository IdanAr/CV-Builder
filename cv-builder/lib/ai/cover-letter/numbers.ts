// lib/ai/cover-letter/numbers.ts
// Finds the numbers a sentence states and compares them by meaning rather than
// spelling, so "$1.2M", "1,200,000 USD" and "1.2 million dollars" are one
// claim and "18 months" equals "1.5 years". The verifier uses this to check
// that every number in a letter comes from a fact it cites.

export type NumberKind = 'percent' | 'money' | 'multiplier' | 'duration' | 'year' | 'count'

export interface NumberMention {
  /** As written, from any currency prefix to the last suffix, e.g. "$1.2M". */
  raw: string
  /** Expanded value: 1_200_000 for "1.2M"; durations in seconds. */
  value: number
  kind: NumberKind
  /** Normalised code: 'USD' | 'EUR' | 'ILS' | 'GBP'. */
  currency?: string
  /** "+", "over", "more than", "at least". */
  lowerBound: boolean
  /** Written as a word ("five", "third"). */
  fromWord: boolean
  /** "about", "nearly", "around", "roughly", "almost", "approximately". */
  approximate: boolean
  /** Offset of `raw` in the text. */
  index: number
}

const CURRENCY_CODES: Record<string, string> = {
  '$': 'USD', usd: 'USD', dollar: 'USD', dollars: 'USD',
  '€': 'EUR', eur: 'EUR', euro: 'EUR', euros: 'EUR',
  '£': 'GBP', gbp: 'GBP',
  '₪': 'ILS', nis: 'ILS', ils: 'ILS', shekel: 'ILS', shekels: 'ILS', 'ש"ח': 'ILS', 'ש״ח': 'ILS', 'שקל': 'ILS', 'שקלים': 'ILS',
}

const SCALE: Record<string, number> = {
  k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9,
  'אלף': 1e3, 'מיליון': 1e6, 'מליון': 1e6, 'מיליארד': 1e9, 'מליארד': 1e9,
}

const DAY = 86_400
const UNIT_SECONDS: [RegExp, number][] = [
  [/^(?:working|business) days?$/, DAY],
  [/^(?:seconds?|secs?|s)$/, 1],
  [/^(?:minutes?|mins?)$/, 60],
  [/^(?:hours?|hrs?|h)$/, 3600],
  [/^days?$/, DAY],
  [/^weeks?$/, 7 * DAY],
  [/^(?:months?|mos?)$/, 30.4375 * DAY],
  [/^(?:years?|yrs?)$/, 365.25 * DAY],
  [/^decades?$/, 3652.5 * DAY],
]

const WORD_VALUES: Record<string, number> = {}
;[
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
].forEach((w, i) => (WORD_VALUES[w] = i + 1))
;[
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
].forEach((w, i) => (WORD_VALUES[w] = i + 1))

const DIGITS = /(?<![\p{L}\d])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/gu
const WORDS = new RegExp(`\\b(${Object.keys(WORD_VALUES).join('|')})\\b`, 'gi')

const PREFIX_CURRENCY = /(₪|\$|€|£|\bNIS|\bILS|\bUSD|\bEUR|\bGBP)\s?$/i
const LOWER_BOUND = /\b(?:over|more than|at least|above|upwards of)\s+(?:[₪$€£]\s?|(?:NIS|ILS|USD|EUR|GBP)\s)?$/i
const APPROXIMATE = /\b(?:about|nearly|around|roughly|almost|approximately|close to|some)\s+(?:[₪$€£]\s?|(?:NIS|ILS|USD|EUR|GBP)\s)?$/i

const SUFFIX_SCALE_LETTER = /^([kKMB])(?![\p{L}\d])/u
const SUFFIX_SCALE_WORD = /^\s+(thousand|million|billion|bn|אלף|מיליון|מליון|מיליארד|מליארד)(?!\p{L})/iu
const SUFFIX_PLUS = /^\+/
const SUFFIX_PERCENT = /^\s?(%|percent\b|per cent\b)/i
const SUFFIX_MULTIPLIER = /^(?:\s?[xX](?![\p{L}\d])|\s+times\b)/u
const SUFFIX_CURRENCY = /^\s?(₪|\$|€|£|ש"ח|ש״ח|שקלים|שקל|(?:NIS|ILS|USD|EUR|GBP|dollars?|shekels?|euros?)(?!\p{L}))/iu
const SUFFIX_UNIT_WORD = /^[\s-]?((?:working|business) days?|seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|mos|years?|yrs?|decades?)\b/i
const SUFFIX_UNIT_LETTER = /^([sh])(?![\p{L}\d])/u
const RANGE_DASH = /^\s?[-–—]\s?(?=\d)/

interface Parsed {
  mention: NumberMention
  base: number
  /** Multiplier from a scale suffix (k, M, million). */
  scale: number
  /** Seconds per unit, for durations. */
  unitSeconds?: number
  end: number
  rangeNext: boolean
}

function parseAt(text: string, start: number, end: number, base: number, fromWord: boolean, integer: boolean, digits: number): Parsed {
  const before = text.slice(Math.max(0, start - 16), start)
  let rawStart = start
  let currency: string | undefined
  const pre = before.match(PREFIX_CURRENCY)
  if (pre) {
    currency = CURRENCY_CODES[pre[1].toLowerCase()]
    rawStart = start - pre[0].length
  }
  let lowerBound = LOWER_BOUND.test(before)
  const approximate = APPROXIMATE.test(before)

  let pos = end
  const rest = () => text.slice(pos, pos + 24)
  let scale = 1
  let kind: NumberKind = 'count'
  let unitSeconds: number | undefined

  const letter = rest().match(SUFFIX_SCALE_LETTER)
  const word = letter ? null : rest().match(SUFFIX_SCALE_WORD)
  if (letter || word) {
    const m = (letter ?? word)!
    scale = SCALE[m[1].toLowerCase()]
    pos += m[0].length
  }
  if (SUFFIX_PLUS.test(rest())) {
    lowerBound = true
    pos += 1
  }
  const percent = rest().match(SUFFIX_PERCENT)
  if (percent) {
    kind = 'percent'
    pos += percent[0].length
  } else {
    const mult = rest().match(SUFFIX_MULTIPLIER)
    if (mult) {
      kind = 'multiplier'
      pos += mult[0].length
    } else {
      const cur = rest().match(SUFFIX_CURRENCY)
      if (cur) {
        currency ??= CURRENCY_CODES[cur[1].toLowerCase()] ?? CURRENCY_CODES[cur[1]]
        pos += cur[0].length
      } else {
        const unitWord = rest().match(SUFFIX_UNIT_WORD)
        // A bare "s" after a 4-digit number is a decade ("1990s"), not seconds.
        const unitLetter = unitWord || digits >= 4 ? null : rest().match(SUFFIX_UNIT_LETTER)
        const unit = unitWord ?? unitLetter
        if (unit) {
          const name = unit[1].toLowerCase().replace(/\s+/g, ' ')
          unitSeconds = UNIT_SECONDS.find(([re]) => re.test(name))?.[1]
          if (unitSeconds) {
            kind = 'duration'
            pos += unit[0].length
          }
        }
      }
    }
  }
  if (SUFFIX_PLUS.test(rest())) {
    lowerBound = true
    pos += 1
  }
  if (kind === 'count' && currency) kind = 'money'
  if (kind === 'count' && integer && scale === 1 && base >= 1950 && base <= 2100 && !fromWord) kind = 'year'

  const value = base * scale * (unitSeconds ?? 1)
  return {
    mention: { raw: text.slice(rawStart, pos), value, kind, currency, lowerBound, fromWord, approximate, index: rawStart },
    base,
    scale,
    unitSeconds,
    end: pos,
    rangeNext: !fromWord && RANGE_DASH.test(text.slice(pos, pos + 4)),
  }
}

/** A dash range shares its units: "3-5 years" is two durations, "$1-2M" two amounts. */
function shareRangeUnits(a: Parsed, b: Parsed) {
  if (a.mention.kind === 'count' && b.mention.kind !== 'count' && b.mention.kind !== 'year') {
    const scale = a.scale === 1 ? b.scale : a.scale
    a.mention.kind = b.mention.kind
    a.mention.currency ??= b.mention.currency
    a.mention.value = a.base * scale * (b.unitSeconds ?? 1)
  }
  if (b.mention.kind === 'count' && a.mention.currency) {
    b.mention.kind = 'money'
    b.mention.currency = a.mention.currency
  }
}

export function extractNumbers(text: string): NumberMention[] {
  const parsed: Parsed[] = []
  for (const m of text.matchAll(DIGITS)) {
    const start = m.index!
    const whole = m[1].replace(/,/g, '')
    const base = Number(m[2] ? `${whole}.${m[2]}` : whole)
    const p = parseAt(text, start, start + m[0].length, base, false, !m[2], whole.length)
    const prev = parsed[parsed.length - 1]
    if (prev?.rangeNext && !prev.mention.fromWord && text.slice(prev.end, start).match(/^\s?[-–—]\s?$/)) shareRangeUnits(prev, p)
    parsed.push(p)
  }
  // "a decade" always states a length; "a year" or "a month" only after a bound ("over a year"), never in "twice a year".
  for (const m of text.matchAll(/\ban?(?=\s+decades?\b)|(?<=\b(?:over|more than|nearly|almost|about|around|at least)\s+)an?(?=\s+(?:year|month)\b)/gi)) {
    const start = m.index!
    parsed.push(parseAt(text, start, start + m[0].length, 1, true, true, 1))
  }
  for (const m of text.matchAll(WORDS)) {
    const start = m.index!
    parsed.push(parseAt(text, start, start + m[0].length, WORD_VALUES[m[1].toLowerCase()], true, true, 1))
  }
  return parsed.map((p) => p.mention).sort((a, b) => a.index - b.index)
}

function compatibleKinds(a: NumberMention, b: NumberMention): boolean {
  if (a.kind === b.kind) return true
  const pair = new Set([a.kind, b.kind])
  return pair.has('money') && pair.has('count')
}

export function sameNumber(a: NumberMention, b: NumberMention): boolean {
  if (!compatibleKinds(a, b)) return false
  if (a.currency && b.currency && a.currency !== b.currency) return false
  const tolerance = a.kind === 'duration' ? 0.02 : 0.005
  return Math.abs(a.value - b.value) <= tolerance * Math.max(Math.abs(a.value), Math.abs(b.value))
}
