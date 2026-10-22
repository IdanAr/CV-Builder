// lib/ai/cover-letter/verify.ts
// Deterministic checks on a structured letter, no model involved. Each body
// sentence is checked against the facts and posting quotes it cites: its
// numbers must come from those facts (or be a duration their dates allow), any
// CV employer, institution or project it names must be the source of a cited
// fact, and its quotes must really be in the posting. Form rules and the
// existing hallucination guard run on top. What this cannot see is a number
// whose meaning changed ("120% attainment" retold as "exceeded by 120%"): both
// sides contain 120%, so that is left to the writer's self-review.
import { detectHallucinations } from '@/lib/ai/hallucination-guard'
import { monthRange, parseMonth } from './dates'
import { renderFactSheet, type Fact, type FactSheet, type FactSource } from './fact-sheet'
import { BANNED_PHRASES, SPARSE_WORD_FLOOR, WORD_BAND, renderLetter, wordCount, stripBulletMarker, type LetterSentence, type StructuredLetter } from './letter'
import { foldName, mentionsName, nameVariants, parentheticalAliases } from './names'
import { extractNumbers, sameNumber, type NumberMention } from './numbers'

export type IssueKind = 'number' | 'name' | 'quote' | 'form' | 'guard'

export interface VerifyIssue {
  kind: IssueKind
  /** The body sentence the issue is about, or null for whole-letter issues. */
  sentence: string | null
  /** User-facing explanation. */
  detail: string
}

export interface VerifyInput {
  letter: StructuredLetter
  sheet: FactSheet
  jobText: string
  company: string
  role: string
  /** YYYY-MM; "present" in a CV means this month. */
  today: string
  /** The CV supports fewer than two of the employer's needs: the word floor drops to 180. */
  sparse?: boolean
}

const MONTH_SECONDS = 30.4375 * 86_400
const DATED_SECTIONS = new Set(['work', 'volunteer', 'education', 'custom', 'project'])

/** Shortest and longest possible length, in months, of each cited stretch, and of all of them together. */
function spans(sources: FactSource[], today: number): [number, number][] {
  const ranges: { start: [number, number]; end: [number, number] }[] = []
  for (const src of sources) {
    if (!DATED_SECTIONS.has(src.section) || !src.start) continue
    const start = monthRange(src.start, today)
    const end = monthRange(src.end, today)
    if (start && end) ranges.push({ start, end })
  }
  const span = (start: [number, number], end: [number, number]): [number, number] => [Math.max(0, end[0] - start[1] + 1), end[1] - start[0] + 1]
  const out = ranges.map((r) => span(r.start, r.end))
  if (ranges.length > 1) {
    const start: [number, number] = [Math.min(...ranges.map((r) => r.start[0])), Math.min(...ranges.map((r) => r.start[1]))]
    const end: [number, number] = [Math.max(...ranges.map((r) => r.end[0])), Math.max(...ranges.map((r) => r.end[1]))]
    out.push(span(start, end))
  }
  return out
}

function durationDerivable(m: NumberMention, allowed: [number, number][]): boolean {
  const years = /\b(?:years?|yrs?|decades?)\b/i.test(m.raw)
  const months = /\b(?:months?|mos)\b/i.test(m.raw)
  if (!years && !months) return false
  const n = m.value / MONTH_SECONDS / (years ? 12 : 1)
  return allowed.some(([short, long]) => {
    const slack = m.approximate ? 1 : 0
    const lo = (years ? Math.floor(short / 12) : short) - slack
    const hi = (years ? Math.ceil(long / 12) : long + 1) + slack
    return m.lowerBound ? Math.round(n) <= hi : Math.round(n) >= lo && Math.round(n) <= hi
  })
}

/** Number words are checked only when they state a quantity; "one of the first" claims nothing. */
function claimsAQuantity(m: NumberMention): boolean {
  if (!m.fromWord) return true
  if (m.kind === 'duration' || m.kind === 'percent') return true
  return m.kind === 'count' && m.value >= 2 && !/^[a-z]+(?:st|nd|rd|th)\b/i.test(m.raw)
}

const foldQuote = (s: string) =>
  s.toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

const sourceLabelText = (src: FactSource) => [src.title, src.start, src.end, src.date].filter(Boolean).join(' ')

const display = (name: string) => parentheticalAliases(name).base

/** The guard's own number patterns are left out: the cited-facts check above is stricter and knows about durations and quotes. */
const NUMERIC_TERM = /^\$?\d[\d.,]*[%xXkKmMbB]?$/

/** Business acronyms the guard's casing rule picks up that name no skill or credential. */
const COMMON_ACRONYMS = new Set(['roi', 'kpi', 'kpis', 'okr', 'okrs', 'b2b', 'b2c', 'saas', 'arr', 'mrr', 'ipo', 'gtm', 'sla', 'slas'])

/** Short forms the guard should read as the long form the CV uses. */
const SYNONYMS: Record<string, string[]> = {
  genai: ['generative ai', 'gen ai'],
  llm: ['large language model'],
  llms: ['large language models', 'llm'],
  nlp: ['natural language processing'],
}

const initials = (phrase: string) => {
  const words = phrase.split(/[^\p{L}\p{N}]+/u).filter((w) => w && !/^(of|and|the|for|de|&)$/i.test(w))
  return words.length >= 2 ? words.map((w) => w[0].toLowerCase()).join('') : ''
}

/**
 * Whether a term the guard raised is covered after all: an abbreviation of a
 * CV title or name ("CFO"), a known short form ("GenAI"), a hyphenated form of
 * a covered word ("GenAI-powered"), a plain business acronym, or a posting
 * term in a sentence that cites the posting line it comes from.
 */
function guardCovered(term: string, cvText: string, abbreviations: Set<string>, quotes: string[]): boolean {
  if (COMMON_ACRONYMS.has(term) || abbreviations.has(term)) return true
  if (quotes.some((q) => foldQuote(q).includes(term))) return true
  const base = term.split('-')[0]
  if (base !== term && (cvText.includes(base) || abbreviations.has(base))) return true
  return (SYNONYMS[base] ?? []).some((long) => cvText.includes(long))
}

/** The few words after "{company}'s" (or a short form, "Acme's" for "Acme Israel"), or null when there is no such possessive. */
function possessiveAfter(text: string, company: string): string | null {
  const forms = [...new Set([company.trim(), ...nameVariants(company)])].filter(Boolean)
  for (const form of forms) {
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}['’]s\\s+((?:\\S+\\s+){0,6}\\S+)`, 'iu').exec(text)
    if (m) return m[1]
  }
  return null
}

const contentWords = (text: string) =>
  new Set((foldName(text).match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !['and', 'the', 'for', 'with', 'program', 'degree'].includes(w)))

function overlap(a: string, b: string): number {
  const bw = contentWords(b)
  return [...contentWords(a)].filter((w) => bw.has(w)).length
}

const MIN_BULLET_WORDS = 6
const LIST_ITEMS = { min: 2, max: 4 } as const

/** A list is a run of consecutive bullet sentences in one paragraph; the letter may have one, of 2 to 4 full sentences. */
function listIssues(letter: StructuredLetter): VerifyIssue[] {
  const lists = letter.paragraphs.flatMap((p) => {
    const runs: LetterSentence[][] = []
    p.forEach((s, i) => {
      if (!s.bullet) return
      if (i > 0 && p[i - 1].bullet) runs[runs.length - 1].push(s)
      else runs.push([s])
    })
    return runs
  })
  const issues: VerifyIssue[] = []
  const form = (sentence: string | null, detail: string) => issues.push({ kind: 'form', sentence, detail })
  if (lists.length > 1) form(null, `The letter has ${lists.length} lists; use at most one.`)
  for (const list of lists) {
    if (list.length < LIST_ITEMS.min || list.length > LIST_ITEMS.max) {
      form(null, `A list has ${list.length} ${list.length === 1 ? 'item' : 'items'}; use ${LIST_ITEMS.min} to ${LIST_ITEMS.max}, or write it as prose.`)
    }
    for (const item of list) {
      if (wordCount(stripBulletMarker(item.text)) < MIN_BULLET_WORDS) form(item.text, `This list item is a fragment; write each item as a full sentence of at least ${MIN_BULLET_WORDS} words.`)
    }
  }
  return issues
}

export function verifyLetter(input: VerifyInput): VerifyIssue[] {
  const { letter, sheet, jobText, company, role } = input
  const issues: VerifyIssue[] = []
  const byId = new Map(sheet.facts.map((f) => [f.id, f]))
  const today = parseMonth(input.today)
  const companyKey = foldName(company)
  const companyIsCvName = sheet.knownNames.some((k) => foldName(k.name) === companyKey || mentionsName(company, k.variants))
  const foldedJob = foldQuote(jobText)
  const careerSpans = spans(sheet.facts.filter((f) => f.source.section === 'work').map((f) => f.source), today)
  const guardSource = `${renderFactSheet(sheet)}\n${company}\n${role}`
  const cvText = guardSource.toLowerCase()
  const abbreviations = new Set(
    [...sheet.facts.map((f) => f.source.title ?? ''), ...sheet.knownNames.map((k) => parentheticalAliases(k.name).base), role]
      .map(initials)
      .filter((a) => a.length >= 3),
  )
  const guardSeen = new Set<string>()
  // A name the skills list carries ("SAS", "HubSpot") is a tool the candidate uses, not a claim about an employer.
  const employers = new Set(sheet.facts.filter((f) => f.source.section === 'work').flatMap((f) => f.source.names.map(foldName)))
  const skillsText = sheet.facts.filter((f) => f.source.section === 'skills').map((f) => f.text).join('\n')

  for (const sentence of letter.paragraphs.flat()) {
    const text = sentence.text
    const cited = sentence.facts.map((id) => byId.get(id)).filter((f): f is Fact => Boolean(f))

    // Names: a CV entry the sentence names must be the source of a cited fact, or appear in one.
    const named = sheet.knownNames.filter(
      (k) => mentionsName(text, k.variants) && foldName(k.name) !== companyKey && !mentionsName(company, k.variants),
    )
    const unsupported = new Set<string>()
    for (const k of named) {
      const key = foldName(k.name)
      const supported =
        mentionsName(skillsText, k.variants) ||
        cited.some((f) => f.source.names.some((n) => foldName(n) === key) || mentionsName(f.text, k.variants))
      if (supported) continue
      unsupported.add(key)
      const from = [...new Set(cited.flatMap((f) => f.source.names).map(display))]
      issues.push({
        kind: 'name',
        sentence: text,
        detail:
          cited.length === 0
            ? `"${display(k.name)}" is named, but the sentence cites no CV fact about it.`
            : from.length > 0
              ? `"${display(k.name)}" is named, but the cited facts are from ${from.join(' and ')}.`
              : `"${display(k.name)}" is named, but the cited facts are not from it.`,
      })
    }

    // The posting company credited with a CV credential ("Acme's Generative AI program" for a university program).
    if (!companyIsCvName) {
      const after = possessiveAfter(text, company)
      if (after) {
        // Compared with the credential's own title, not its institution, so "Forter's Tel Aviv office" is not a Tel Aviv University degree.
        const credential = sheet.facts.find((f) => {
          if (!f.header || f.source.names.length === 0) return false
          const title = f.source.section === 'education' ? f.source.title : f.source.section === 'certificate' ? f.source.names[0] : undefined
          return Boolean(title) && overlap(after, title!) >= 2
        })
        if (credential) {
          issues.push({ kind: 'name', sentence: text, detail: `This credits ${company} with a credential the CV lists from ${display(credential.source.names.at(-1)!)}.` })
        }
      }
    }

    // A sentence that names one employer, and cites it, may not carry another employer's facts unnamed.
    const namedKeys = new Set(named.map((k) => foldName(k.name)))
    const namedEmployers = named.filter((k) => k.kind === 'org' && employers.has(foldName(k.name)) && !unsupported.has(foldName(k.name)))
    if (namedEmployers.length > 0) {
      const foreign = new Map<string, string[]>()
      for (const f of cited) {
        if (f.source.section !== 'work' || f.source.names.length === 0) continue
        if (f.source.names.some((n) => namedKeys.has(foldName(n))) || named.some((k) => mentionsName(f.text, k.variants))) continue
        const from = display(f.source.names[0])
        foreign.set(from, [...(foreign.get(from) ?? []), f.id])
      }
      for (const [from, ids] of foreign) {
        issues.push({
          kind: 'name',
          sentence: text,
          detail: `Part of this sentence comes from ${from} (${ids.join(', ')}), but only ${namedEmployers.map((k) => display(k.name)).join(' and ')} is named.`,
        })
      }
    }

    // Numbers: each must come from a cited fact, its dates, the role or company, a cited quote, or a derivable duration.
    const pool = [
      ...cited.flatMap((f) => [f.text, sourceLabelText(f.source)]),
      company,
      role,
      ...sentence.quotes,
    ].flatMap(extractNumbers)
    const durations = [...spans(cited.map((f) => f.source), today), ...(named.length === 0 ? careerSpans : [])]
    const unmatched = extractNumbers(text).filter(
      (m) => claimsAQuantity(m) && !pool.some((p) => sameNumber(m, p)) && !(m.kind === 'duration' && durationDerivable(m, durations)),
    )
    if (unmatched.length > 0) {
      const ids = sentence.facts.length > 0 ? ` (${sentence.facts.join(', ')})` : ''
      for (const m of unmatched) {
        issues.push({ kind: 'number', sentence: text, detail: `Number "${m.raw.trim()}" is not in the cited facts${ids}.` })
      }
    }

    // Posting quotes must really be in the posting.
    for (const q of sentence.quotes) {
      if (q.trim() && !foldedJob.includes(foldQuote(q))) {
        issues.push({ kind: 'quote', sentence: text, detail: `Quote not found in the posting: "${q.trim()}".` })
      }
    }

    // The existing guard, for technologies the CV never mentions.
    // Possessives are dropped first, so "ACME's" is checked as "ACME".
    for (const term of detectHallucinations(guardSource, text.replace(/['’]s\b/g, ''))) {
      if (NUMERIC_TERM.test(term) || guardSeen.has(term) || guardCovered(term, cvText, abbreviations, sentence.quotes)) continue
      guardSeen.add(term)
      issues.push({ kind: 'guard', sentence: text, detail: `The CV does not mention "${term}".` })
    }
  }

  const rendered = renderLetter(letter)
  const lower = rendered.toLowerCase()
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) issues.push({ kind: 'form', sentence: null, detail: `Uses the stock phrase "${phrase}".` })
  }
  if (rendered.includes('—')) issues.push({ kind: 'form', sentence: null, detail: 'Uses an em-dash.' })
  // The "- " that marks a list item is not a word.
  const words = wordCount(rendered.replace(/^- /gm, ''))
  const floor = input.sparse ? SPARSE_WORD_FLOOR : WORD_BAND.min
  if (words < floor) issues.push({ kind: 'form', sentence: null, detail: `The letter has ${words} words; aim for at least ${floor}.` })
  if (words > WORD_BAND.max) issues.push({ kind: 'form', sentence: null, detail: `The letter has ${words} words; aim for at most ${WORD_BAND.max}.` })
  if (!letter.greeting.trim()) issues.push({ kind: 'form', sentence: null, detail: 'The letter has no greeting.' })
  if (!letter.signOff.trim()) issues.push({ kind: 'form', sentence: null, detail: 'The letter has no sign-off.' })
  issues.push(...listIssues(letter))

  return issues
}
