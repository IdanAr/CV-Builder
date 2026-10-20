// scripts/cover-letter-eval/infer-citations.ts
// The baseline letters are plain text with no citations, so measuring the
// verifier on them needs a guess at which facts each sentence relies on. The
// guess is made from content (shared numbers and words), never from the
// employer a sentence names, so a task from one employer retold under another
// still cites the original employer's fact and the verifier sees the mismatch. Eval only:
// the new pipeline gets real citations from the writer.
import { renderFactSheet, type FactSheet } from '@/lib/ai/cover-letter/fact-sheet'
import { extractTechTerms } from '@/lib/ats/keywords'
import type { LetterSentence, StructuredLetter } from '@/lib/ai/cover-letter/letter'
import { foldName, mentionsName } from '@/lib/ai/cover-letter/names'
import { extractNumbers, sameNumber } from '@/lib/ai/cover-letter/numbers'

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[\p{Lu}"“])/u
const GREETING = /^(dear|hello|hi|to)\b/i
const SIGN_OFF = /^(sincerely|best|kind regards|warm regards|regards|thank you|thanks|respectfully|yours|with appreciation)\b/i

const sentence = (text: string): LetterSentence => ({ text, facts: [], quotes: [] })

export function parsePlainLetter(text: string): StructuredLetter {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  let greeting = ''
  if (blocks.length > 0 && GREETING.test(blocks[0])) {
    const [first, ...rest] = blocks[0].split('\n')
    greeting = first.trim()
    if (rest.join(' ').trim()) blocks[0] = rest.join('\n')
    else blocks.shift()
  }
  let signOff = ''
  const signAt = blocks.findIndex((b) => {
    const first = b.split('\n')[0].trim()
    return SIGN_OFF.test(first) && first.split(/\s+/).length <= 6
  })
  if (signAt >= 0) signOff = blocks.splice(signAt).join('\n\n')
  const paragraphs = blocks.map((b) => b.replace(/\s+/g, ' ').split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean).map(sentence))
  return { greeting, paragraphs, signOff }
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'your', 'from', 'have', 'which', 'into', 'while', 'where', 'more', 'than', 'also',
  'our', 'you', 'was', 'were', 'are', 'has', 'had', 'been', 'its', 'their', 'them', 'they', 'who', 'what', 'how', 'can', 'will',
  'would', 'about', 'role', 'team', 'work', 'experience', 'using',
])

// Dotted tokens survive, so "B.Sc." matches "B.Sc".
const words = (text: string) => text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').match(/[\p{L}\p{N}%]+(?:\.[\p{L}\p{N}]+)*/gu) ?? []
const content = (t: string, exclude: Set<string>) => (t.length > 2 || /\d/.test(t)) && !STOP.has(t) && !exclude.has(t)

function tokens(text: string, exclude: Set<string>): Set<string> {
  return new Set(words(text).filter((t) => content(t, exclude)))
}

/** Adjacent pairs of content words ("financial models"): much stronger evidence than single shared words. */
function phrases(text: string, exclude: Set<string>): Set<string> {
  const w = words(text)
  const out = new Set<string>()
  for (let i = 0; i + 1 < w.length; i++) if (content(w[i], exclude) && content(w[i + 1], exclude)) out.add(`${w[i]} ${w[i + 1]}`)
  return out
}

const MIN_SHARED = 3
const RELATIVE = 0.6

type Fact = FactSheet['facts'][number]

/**
 * Fact IDs a plain-text sentence most likely relies on: facts sharing one of
 * its numbers, plus facts sharing at least 3 content words and either at
 * least 60% of the best fact's count or a two-word phrase. Words of the CV
 * names it mentions and of `exclude` (the posting company) do not count, so
 * naming an entry never pulls in its facts; an entry it names needs only 2
 * shared words. When the sentence names an employer, another employer's fact
 * is cited only for words that none of the named entries' facts contain
 * ("financial models" told under the wrong employer), never for wording both
 * jobs share. The header facts of every cited entry are added. A sentence
 * whose content matches no entry cites the headers of the entries it names,
 * since it attributes no content and so cannot misattribute any; a
 * certificate, project or award it names outright is always cited.
 */
export function inferCitations(text: string, sheet: FactSheet, exclude: string[] = []): string[] {
  const named = sheet.knownNames.filter((k) => mentionsName(text, k.variants))
  const namedKeys = new Set(named.map((k) => foldName(k.name)))
  const nameWords = new Set([...named.map((k) => k.name), ...exclude].flatMap((n) => foldName(n).split(' ')))
  const own = tokens(text, nameWords)
  const ownPhrases = phrases(text, nameWords)
  const nums = extractNumbers(text).filter((n) => !n.fromWord)

  const ofNamed = (f: Fact) => f.source.names.some((n) => namedKeys.has(foldName(n)))
  const namesEmployer = sheet.facts.some((f) => f.source.section === 'work' && ofNamed(f))
  const foreign = (f: Fact) => namesEmployer && f.source.section === 'work' && f.source.names.length > 0 && !ofNamed(f)
  const namedFacts = sheet.facts.filter(ofNamed)
  const namedVocab = new Set(namedFacts.flatMap((f) => [...tokens(f.text, nameWords)]))
  const namedPhrases = new Set(namedFacts.flatMap((f) => [...phrases(f.text, nameWords)]))
  const namedNums = namedFacts.flatMap((f) => extractNumbers(f.text))

  const shared = sheet.facts.map((f) => [...tokens(f.text, nameWords)].filter((t) => own.has(t)))
  const best = Math.max(0, ...shared.map((x) => x.length))
  const cited = new Set<string>()
  sheet.facts.forEach((f, i) => {
    const words = shared[i]
    const sharedPhrases = [...phrases(f.text, nameWords)].filter((p) => ownPhrases.has(p))
    const sharedNums = nums.filter((n) => extractNumbers(f.text).some((m) => !m.fromWord && sameNumber(n, m)))
    if (foreign(f)) {
      const unique = words.filter((t) => !namedVocab.has(t))
      const uniquePhrase = sharedPhrases.some((p) => !namedPhrases.has(p))
      const uniqueNum = sharedNums.some((n) => !namedNums.some((m) => sameNumber(n, m)))
      if (unique.length >= MIN_SHARED || (unique.length >= 2 && uniquePhrase) || uniqueNum) cited.add(f.id)
      return
    }
    if (sharedNums.length > 0) cited.add(f.id)
    if (words.length >= MIN_SHARED && (words.length >= RELATIVE * best || sharedPhrases.length > 0)) cited.add(f.id)
    // "a B.Sc. from Shenkar" shares only two words with its degree line.
    if (ofNamed(f) && words.length >= MIN_SHARED - 1) cited.add(f.id)
  })

  const titles = new Set(named.filter((k) => k.kind === 'title').map((k) => foldName(k.name)))
  for (const f of sheet.facts) if (f.header && f.source.names.some((n) => titles.has(foldName(n)))) cited.add(f.id)

  const onlyNameless = [...cited].every((id) => sheet.facts.find((f) => f.id === id)!.source.names.length === 0)
  if (onlyNameless) {
    for (const f of sheet.facts) if (f.header && ofNamed(f)) cited.add(f.id)
  } else {
    const sources = new Set(sheet.facts.filter((f) => cited.has(f.id)).map((f) => f.source))
    for (const f of sheet.facts) if (f.header && sources.has(f.source)) cited.add(f.id)
  }
  return sheet.facts.filter((f) => cited.has(f.id)).map((f) => f.id)
}

/** Words that mark a sentence as being about the employer or the job rather than the candidate's own record. */
const EMPLOYER_CUE = /\b(you|your|yours|this role|the role|this position|the position|the prospect|the opportunity|the chance|drawn to)\b/i

/**
 * Posting lines a sentence about the employer relies on: for each technology
 * it names that the CV does not have but the posting does, the first posting
 * line containing it. The writer is asked to cite these; the baseline letters
 * never did.
 */
export function inferQuotes(text: string, jobText: string, sheet: FactSheet, company?: string): string[] {
  const aboutEmployer = EMPLOYER_CUE.test(text) || (company ? mentionsName(text, [foldName(company)].filter(Boolean)) : false)
  if (!aboutEmployer) return []
  const cv = renderFactSheet(sheet).toLowerCase()
  const lines = jobText.split('\n').map((l) => l.trim()).filter(Boolean)
  const out: string[] = []
  for (const term of extractTechTerms(text)) {
    if (cv.includes(term)) continue
    const line = lines.find((l) => l.toLowerCase().includes(term))
    if (line && !out.includes(line)) out.push(line)
  }
  return out
}
