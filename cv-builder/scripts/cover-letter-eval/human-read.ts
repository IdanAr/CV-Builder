// scripts/cover-letter-eval/human-read.ts
// The human read check (spec 9): a person compares two letters per case
// without knowing which run wrote which, and the new writer's letter should
// win at least 70% of the decided cases. This module is pure: it builds the
// blind sheet and its answer key from two runs, parses the person's answers
// and scores them. File handling lives in eval.ts.
import { seededShuffle } from './calibration'

/** Share of decided cases (ties excluded) the new letter must win. */
export const HUMAN_READ_TARGET = 0.7

export type Side = 'A' | 'B'
export type Answer = Side | 'same'

export interface HumanReadCase {
  caseId: string
  company: string
  role: string
  cvTitle: string
}

export interface HumanReadLetter {
  caseId: string
  sample: number
  content: string
}

/** Answer key, kept out of the sheet. */
export interface HumanReadKeyItem {
  id: string
  caseId: string
  /** Which side of the sheet holds the new run's letter. */
  newIs: Side
}

export interface SkippedCase {
  caseId: string
  reason: string
}

export interface HumanReadInput {
  cases: HumanReadCase[]
  oldRun: HumanReadLetter[]
  newRun: HumanReadLetter[]
  seed?: number
}

export const HUMAN_READ_SEED = 41

const firstSample = (run: HumanReadLetter[], caseId: string) =>
  run.find((l) => l.caseId === caseId && l.sample === 1)

const HEADER = `# Cover letter comparison

Each case below shows a job posting's company and role, the title of the CV the letter was written for, and two cover letters, A and B. Read both and decide which one you would rather send for that role. Think about whether it sounds like a real person, whether it is specific to the company and role, and whether it claims only what the CV supports.

Replace the line "Prefer: A | B | same" under each case with exactly one of these:
- Prefer: A
- Prefer: B
- Prefer: same

Leave a case as it is to skip it. Which letter came from where is not shown on purpose.
`

export function buildHumanRead({ cases, oldRun, newRun, seed = HUMAN_READ_SEED }: HumanReadInput): {
  sheet: string
  key: HumanReadKeyItem[]
  skipped: SkippedCase[]
} {
  const usable: { c: HumanReadCase; oldText: string; newText: string }[] = []
  const skipped: SkippedCase[] = []
  for (const c of cases) {
    const o = firstSample(oldRun, c.caseId)?.content.trim()
    const n = firstSample(newRun, c.caseId)?.content.trim()
    const missing = [!o && 'old', !n && 'new'].filter(Boolean)
    if (missing.length) skipped.push({ caseId: c.caseId, reason: `no sample 1 in the ${missing.join(' and ')} run` })
    else usable.push({ c, oldText: o!, newText: n! })
  }
  // Half the cases get the new letter as A and half as B, in a seeded order.
  const sides = seededShuffle(usable.map((_, i): Side => (i < Math.floor(usable.length / 2) ? 'A' : 'B')), seed)
  const key: HumanReadKeyItem[] = []
  const body = usable.map(({ c, oldText, newText }, i) => {
    const id = `H${String(i + 1).padStart(2, '0')}`
    const newIs = sides[i]
    key.push({ id, caseId: c.caseId, newIs })
    const [a, b] = newIs === 'A' ? [newText, oldText] : [oldText, newText]
    return `## ${id}

Posting: ${c.role} at ${c.company}
CV: ${c.cvTitle}

### Letter A

${a}

### Letter B

${b}

Prefer: A | B | same
`
  })
  return { sheet: [HEADER, ...body].join('\n'), key, skipped }
}

/** Answers from a filled sheet. The unfilled template line and any other wording are ignored. */
export function parseAnswers(markdown: string): Map<string, Answer> {
  const answers = new Map<string, Answer>()
  let current: string | null = null
  for (const line of markdown.split('\n')) {
    const heading = line.match(/^## (H\d+)\b/)
    if (heading) current = heading[1]
    const answer = line.match(/^Prefer:\s*(A|B|same)\s*$/i)
    if (current && answer) {
      const v = answer[1]
      answers.set(current, v.toLowerCase() === 'same' ? 'same' : (v.toUpperCase() as Side))
    }
  }
  return answers
}

export interface HumanReadScore {
  total: number
  answered: number
  unanswered: number
  newPreferred: number
  oldPreferred: number
  same: number
  /** New letter's share of the decided cases, or null when none were decided. */
  rate: number | null
  pass: boolean
}

export function scoreHumanRead(key: HumanReadKeyItem[], answers: Map<string, Answer>): HumanReadScore {
  const score: HumanReadScore = { total: key.length, answered: 0, unanswered: 0, newPreferred: 0, oldPreferred: 0, same: 0, rate: null, pass: false }
  for (const item of key) {
    const answer = answers.get(item.id)
    if (!answer) {
      score.unanswered++
      continue
    }
    score.answered++
    if (answer === 'same') score.same++
    else if (answer === item.newIs) score.newPreferred++
    else score.oldPreferred++
  }
  const decided = score.newPreferred + score.oldPreferred
  if (decided > 0) {
    score.rate = score.newPreferred / decided
    score.pass = score.rate >= HUMAN_READ_TARGET
  }
  return score
}
