// scripts/cover-letter-eval/calibration.ts
// Builds a blind labelling sheet for the judge's factual-error verdicts and
// scores the judge against a person's labels. The sheet shows each letter
// sentence with the closest résumé lines (picked by word overlap, not by the
// judge) and never the judge's verdict, so the labeller is not anchored by it.
import { resolveEducationRoles, resolveWorkRoles } from '@/lib/roles'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export type Label = 'error' | 'ok' | 'unsure'

export interface CalibrationItem {
  id: string
  letterId: string
  company: string
  sentence: string
  resumeLines: string[]
  /** Answer key, kept out of the sheet. */
  judgeFlagged: boolean
  judgeClaim?: string
}

const dates = (start?: string, end?: string) => (start || end ? ` (${start ?? '?'} to ${end ?? 'present'})` : '')

/** One labelled line per résumé fact, with dates, so a labeller can check a sentence without opening the CV. */
export function resumeLines(data: ResumeData): string[] {
  const out: string[] = []
  if (data.basics?.summary) out.push(`Summary: ${data.basics.summary}`)
  for (const job of data.work ?? []) {
    for (const role of resolveWorkRoles(job)) {
      out.push(`Work: ${role.position ?? ''} at ${job.name ?? ''}${dates(role.startDate, role.endDate)}`)
      for (const h of role.highlights ?? []) out.push(`Work at ${job.name ?? ''}: ${h}`)
    }
  }
  for (const edu of data.education ?? []) {
    for (const role of resolveEducationRoles(edu)) {
      out.push(`Education: ${role.studyType ?? ''} ${role.area ?? ''} at ${edu.institution ?? ''}${dates(role.startDate, role.endDate)}`)
    }
  }
  for (const p of data.projects ?? []) out.push(`Project ${p.name ?? ''}: ${p.description ?? ''} ${(p.highlights ?? []).join(' ')}`.trim())
  for (const s of data.skills ?? []) out.push(`Skills (${s.name ?? ''}): ${(s.keywords ?? []).join(', ')}`)
  for (const section of data.customSections ?? []) {
    for (const item of section.items ?? []) {
      out.push(`${section.name}: ${[item.title, item.subtitle, item.summary, ...(item.highlights ?? [])].filter(Boolean).join(' ')}${dates(item.startDate, item.endDate)}`)
    }
  }
  return out
}

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'your', 'from', 'have', 'which', 'into', 'while', 'where', 'more', 'than', 'also'])

function tokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9%]+/g) ?? []).filter((t) => (t.length > 2 || /\d/.test(t)) && !STOP.has(t)))
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const t of a) if (b.has(t)) n++
  return n
}

export function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((para) => para.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 6)
}

export function closestLines(sentence: string, lines: string[], n = 3): string[] {
  const t = tokens(sentence)
  return lines
    .map((line) => ({ line, score: overlap(t, tokens(line)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.line)
}

/** The sentence sharing the most words with a claim, however few. */
export function bestSentence(claim: string, sentences: string[]): { sentence: string; shared: number; claimWords: number } | null {
  const t = tokens(claim)
  let best: { sentence: string; shared: number; claimWords: number } | null = null
  for (const sentence of sentences) {
    const shared = overlap(t, tokens(sentence))
    if (!best || shared > best.shared) best = { sentence, shared, claimWords: t.size }
  }
  return best
}

/** The letter sentence a judge claim refers to, or null when no sentence shares at least half its words. */
export function sentenceForClaim(claim: string, sentences: string[]): string | null {
  const best = bestSentence(claim, sentences)
  return best && best.shared >= Math.max(2, best.claimWords / 2) ? best.sentence : null
}

/** Deterministic shuffle so the sheet is stable between runs. */
export function seededShuffle<T>(items: T[], seed = 7): T[] {
  const out = [...items]
  let x = seed
  for (let i = out.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) % 2147483648
    const j = x % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Takes items in turn from each group so no one case dominates the sample. */
export function roundRobin<T>(groups: T[][], limit: number): T[] {
  const out: T[] = []
  for (let i = 0; out.length < limit && groups.some((g) => i < g.length); i++) {
    for (const g of groups) {
      if (i < g.length && out.length < limit) out.push(g[i])
    }
  }
  return out
}

export function renderSheet(items: CalibrationItem[]): string {
  const header = `# Judge calibration: factual errors

For each item, read the letter sentence and decide whether it states something about the candidate that is factually wrong: a wrong employer, title, institution, date or duration, a number that is wrong or measures something else, an achievement credited to the wrong job or project, or something the CV does not contain at all.

Write one word after "Label:":
- error: the sentence contains a factual error
- ok: every fact in it is right (overstated tone or vague self-praise is still ok here)
- unsure: you cannot tell

The CV lines shown are picked by word overlap to save you a lookup; they are not complete, so check the CV itself when they are not enough.
`
  const body = items.map(
    (item) => `## ${item.id} (${item.letterId}, ${item.company})

Letter: "${item.sentence}"

Closest CV lines:
${item.resumeLines.length ? item.resumeLines.map((l) => `- ${l}`).join('\n') : '- (none found)'}

Label:
`
  )
  return [header, ...body].join('\n')
}

export function parseLabels(markdown: string): Map<string, Label> {
  const labels = new Map<string, Label>()
  let current: string | null = null
  for (const line of markdown.split('\n')) {
    const heading = line.match(/^## ([CK]\d+)\b/)
    if (heading) current = heading[1]
    const label = line.match(/^Label:\s*(error|ok|unsure)\b/i)
    if (current && label) labels.set(current, label[1].toLowerCase() as Label)
  }
  return labels
}

export interface Agreement {
  labelled: number
  agree: number
  /** Judge flagged an error the person says is fine. */
  falseAlarms: CalibrationItem[]
  /** Person found an error the judge did not flag. */
  misses: CalibrationItem[]
}

export function scoreAgreement(items: CalibrationItem[], labels: Map<string, Label>): Agreement {
  const result: Agreement = { labelled: 0, agree: 0, falseAlarms: [], misses: [] }
  for (const item of items) {
    const label = labels.get(item.id)
    if (!label || label === 'unsure') continue
    result.labelled++
    const personSaysError = label === 'error'
    if (personSaysError === item.judgeFlagged) result.agree++
    else if (item.judgeFlagged) result.falseAlarms.push(item)
    else result.misses.push(item)
  }
  return result
}
