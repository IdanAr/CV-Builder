// scripts/cover-letter-eval/eval.ts
// Measures cover letter quality on a fixed set of real CV + posting pairs.
// Run from cv-builder/:
//
//   npx tsx scripts/cover-letter-eval/eval.ts fixtures                 # snapshot CVs and postings (reads MongoDB, read-only)
//   npx tsx scripts/cover-letter-eval/eval.ts generate baseline 2      # N letters per pair with the current pipeline
//       [--variant baseline|a|b] [--model <id>] [--budget N | --effort low|medium|high] [--no-thinking] [--notes] [--only s01,s03]  # the new writer (a), its split-critique variant (b)
//   npx tsx scripts/cover-letter-eval/eval.ts score baseline           # deterministic checks + LLM judge
//   npx tsx scripts/cover-letter-eval/eval.ts negatives baseline       # judge sanity check on known-bad letters
//   npx tsx scripts/cover-letter-eval/eval.ts report baseline          # markdown summary
//   npx tsx scripts/cover-letter-eval/eval.ts calibration baseline     # blind sheet for a person to label factual errors
//   npx tsx scripts/cover-letter-eval/eval.ts agreement                # judge vs the person's labels
//   npx tsx scripts/cover-letter-eval/eval.ts recheck baseline         # re-judge labelled letters with the current rubric
//   npx tsx scripts/cover-letter-eval/eval.ts import-cvs               # shared CVs (PDF/DOCX) through the app's upload extraction
//   npx tsx scripts/cover-letter-eval/eval.ts verify baseline2 [set]   # cited-facts verifier on a run, against the person's labels
//   npx tsx scripts/cover-letter-eval/eval.ts compare baseline3 a1     # side by side, with the spec's decision rule
//   npx tsx scripts/cover-letter-eval/eval.ts confirm a1,b1             # blind sheet of every judge-flagged factual error
//   npx tsx scripts/cover-letter-eval/eval.ts confirm-score a1,b1       # confirmed-<label>.json from the person's labels
//
// Everything it writes holds real CV text, so it goes to the git-ignored
// docs/superpowers/cover-letter-eval/ directory.
import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import mongoose from 'mongoose'
import { z } from 'zod'
import { buildFactSheet } from '@/lib/ai/cover-letter/fact-sheet'
import { verifyLetter, type VerifyIssue } from '@/lib/ai/cover-letter/verify'
import { writeCoverLetter } from '@/lib/ai/cover-letter/pipeline'
import { MAX_JD_LENGTH } from '@/lib/ai/jd-extraction-pipeline'
import { getAnthropic } from '@/lib/ai/models'
import { flattenAllText } from '@/lib/ats/scorer'
import { extractResume } from '@/lib/upload/extract-resume'
import { parseFile } from '@/lib/upload/parse-file'
import { ResumeDataSchema, type ResumeData } from '@/lib/schemas/resume.zod'
import {
  bestSentence,
  closestLines,
  parseLabels,
  renderSheet,
  resumeLines,
  roundRobin,
  scoreAgreement,
  seededShuffle,
  sentenceForClaim,
  splitSentences,
  type CalibrationItem,
  type Label,
} from './calibration'
import { checkLetter, htmlToText, type LetterChecks } from './checks'
import { inferCitations, inferQuotes, parsePlainLetter } from './infer-citations'
import { generateCoverLetter } from './baseline-pipeline'
import { writeCoverLetterB } from './variant-b'
import { EVAL_PAIRS, EVAL_SET_VERSION, GAP_VARIANT_END_DATE, NOTES, type EvalPair } from './pairs'
import { SYNTHETIC_CVS } from './synthetic-cvs'
import { buildJudgePrompt, JUDGE_CRITERIA, NA_ALLOWED, RUBRIC_VERSION, type JudgeCriterionId } from './rubric'

const OUT_DIR = path.join(process.cwd(), 'docs', 'superpowers', 'cover-letter-eval')
const CONTENT_PATH = path.join(process.cwd(), 'scripts', 'demo-seed', 'demo-content.local.json')
const JUDGE_MODEL = 'claude-opus-5-5'
/** First-party USD per million tokens (input, output), as listed on 2026-10-20. */
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-4-5': [1, 5],
  'claude-opus-5-5': [4, 20],
  'claude-haiku-5-5': [0.1, 0.5],
}
const CONCURRENCY = 4

// ---------------------------------------------------------------------------
// Types and file helpers
// ---------------------------------------------------------------------------

interface EvalCase extends EvalPair {
  company: string
  role: string
  resumeTitle: string
  resume: ResumeData
  jobText: string
  jobRawChars: number
}

interface Fixtures {
  builtAt: string
  cases: EvalCase[]
}

interface CallUsage {
  model: string
  usage: Anthropic.Usage
}

interface Generated {
  caseId: string
  sample: number
  content: string
  pendingApprovals: string[]
  calls: CallUsage[]
  ms: number
  error?: string
  /** Pipeline variant ('baseline' when absent) and model, for runs of the new writer. */
  variant?: Variant
  model?: string
  issues?: VerifyIssue[]
  firstIssues?: VerifyIssue[]
  refined?: boolean
  notices?: string[]
}

type Variant = 'baseline' | 'a' | 'b'

interface GenerateOptions {
  variant: Variant
  model?: string
  thinking?: { budget?: number; effort?: 'low' | 'medium' | 'high'; off?: boolean }
  notes: boolean
  only?: string[]
}

const Verdict = z.object({
  verdict: z.enum(['pass', 'fail', 'n/a']),
  evidence: z.string(),
  reason: z.string(),
})

const JudgeOutput = z.object({
  criteria: z.object(
    Object.fromEntries(JUDGE_CRITERIA.map((c) => [c.id, Verdict])) as Record<JudgeCriterionId, typeof Verdict>
  ),
  factual_errors: z.array(z.object({ claim: z.string(), resume_text: z.string(), reason: z.string() })),
  inflations: z.array(z.object({ claim: z.string(), reason: z.string() })),
  unsupported_company_claims: z.array(z.object({ claim: z.string(), reason: z.string() })),
})
type JudgeResult = z.infer<typeof JudgeOutput>

interface Scored {
  caseId: string
  sample: number
  checks: LetterChecks
  pendingApprovals: string[]
  judge?: JudgeResult
  judgeRepeat?: JudgeResult
  judgeCalls: CallUsage[]
  error?: string
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

function writeJson(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2))
}

const FIXTURES_FILE = path.join(OUT_DIR, `fixtures.set${EVAL_SET_VERSION}.json`)

function loadFixtures(): Fixtures {
  const file = FIXTURES_FILE
  if (!existsSync(file)) throw new Error('No fixtures yet: run `eval.ts fixtures` first.')
  return readJson<Fixtures>(file)
}

function scoresFile(label: string): string {
  return path.join(OUT_DIR, 'scores', `${label}.v${RUBRIC_VERSION}.json`)
}

function loadRun(label: string): Generated[] {
  const dir = path.join(OUT_DIR, 'runs', label)
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson<Generated>(path.join(dir, f)))
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await fn(items[i])
      }
    })
  )
  return results
}

function costOf(calls: CallUsage[]): number {
  return calls.reduce((sum, { model, usage }) => {
    const price = Object.entries(PRICES).find(([prefix]) => model.startsWith(prefix))?.[1]
    if (!price) return sum
    return sum + (usage.input_tokens * price[0] + usage.output_tokens * price[1]) / 1e6
  }, 0)
}

function caseNotes(c: EvalCase): string {
  const situations = c.tags.filter((t) => t !== 'strong-fit')
  if (situations.length === 0) return 'Straight fit: no career change, gap, overqualification or stretch to address.'
  return `${situations.join(', ')}. ${c.note}.`
}

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

function withGap(data: ResumeData): ResumeData {
  const copy = structuredClone(data)
  const latest = copy.work?.[0]
  if (latest) {
    latest.endDate = GAP_VARIANT_END_DATE
    for (const role of latest.roles ?? []) {
      if (!role.endDate || /present/i.test(role.endDate)) role.endDate = GAP_VARIANT_END_DATE
    }
  }
  return copy
}

function loadResume(pair: EvalPair): { title: string; data: ResumeData } {
  if (pair.source === 'synthetic') {
    const data = SYNTHETIC_CVS[pair.resumeKey]
    if (!data) throw new Error(`No synthetic CV "${pair.resumeKey}"`)
    return { title: `${data.basics?.name} (synthetic)`, data: ResumeDataSchema.parse(data) }
  }
  if (pair.source === 'real') {
    const file = path.join(REAL_CV_DIR, `${pair.resumeKey}.json`)
    return { title: `${pair.resumeKey} (shared CV)`, data: ResumeDataSchema.parse(readJson(file)) }
  }
  const content = readJson<{ resumes: { key: string; title: string; data: ResumeData }[] }>(CONTENT_PATH)
  const resume = content.resumes.find((r) => r.key === pair.resumeKey)
  if (!resume) throw new Error(`No résumé "${pair.resumeKey}" in ${CONTENT_PATH}`)
  return resume
}

async function buildFixtures() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')
  await mongoose.connect(uri, { maxPoolSize: 2 })
  try {
    const jobs = mongoose.connection.db!.collection('scrapedjobs')
    const cases: EvalCase[] = []
    for (const pair of allPairs()) {
      const resume = loadResume(pair)
      const job = await jobs.findOne(
        { _id: new mongoose.Types.ObjectId(pair.jobId) },
        { projection: { title: 1, company: 1, description: 1 } }
      )
      if (!job) throw new Error(`Posting ${pair.jobId} for ${pair.id} not found`)
      const raw = String(job.description ?? '')
      cases.push({
        ...pair,
        company: String(job.company ?? '').trim(),
        role: String(job.title ?? '').trim(),
        resumeTitle: resume.title,
        resume: pair.variant === 'gap' ? withGap(resume.data) : resume.data,
        jobText: htmlToText(raw),
        jobRawChars: raw.length,
      })
    }
    writeJson(FIXTURES_FILE, { builtAt: new Date().toISOString(), cases } satisfies Fixtures)
    for (const c of cases) {
      console.log(
        `${c.id} ${c.company} | ${c.role} | text ${c.jobText.length} chars (raw HTML ${c.jobRawChars}${c.jobRawChars > MAX_JD_LENGTH ? ', truncated on the job-search path' : ''})`
      )
    }
  } finally {
    await mongoose.disconnect()
  }
}

// ---------------------------------------------------------------------------
// generate: the production pipeline, unchanged, with token usage recorded
// ---------------------------------------------------------------------------

const callLog = new AsyncLocalStorage<CallUsage[]>()

function recordAppCalls() {
  const messages = getAnthropic().messages
  const create = messages.create.bind(messages) as (
    body: Anthropic.MessageCreateParamsNonStreaming,
    options?: Anthropic.RequestOptions,
  ) => Promise<Anthropic.Message>
  ;(messages as unknown as { create: typeof create }).create = async (body, options) => {
    const msg = await create(body, options)
    callLog.getStore()?.push({ model: msg.model, usage: msg.usage })
    return msg
  }
}

async function generate(label: string, samples: number, opts: GenerateOptions = { variant: 'baseline', notes: false }) {
  const { cases, builtAt } = loadFixtures()
  const today = builtAt.slice(0, 7)
  recordAppCalls()
  const chosen = opts.only ? cases.filter((c) => opts.only!.includes(c.id)) : cases
  const jobs = chosen.flatMap((c) => Array.from({ length: samples }, (_, i) => ({ c, sample: i + 1 })))
  const dir = path.join(OUT_DIR, 'runs', label)
  await pool(jobs, CONCURRENCY, async ({ c, sample }) => {
    // Existing letters are kept, so adding a case only generates that case.
    if (existsSync(path.join(dir, `${c.id}.s${sample}.json`))) return
    const calls: CallUsage[] = []
    const started = Date.now()
    const posting = { company: c.company, role: c.role, jobText: c.jobText }
    const writeOpts = { model: opts.model, thinking: opts.thinking, today, notes: opts.notes ? NOTES[c.id] : undefined }
    let result: Generated
    try {
      if (opts.variant === 'baseline') {
        const out = await callLog.run(calls, () => generateCoverLetter(c.resume, c.jobText, { companyName: c.company, roleName: c.role }))
        result = { caseId: c.id, sample, content: out.content, pendingApprovals: out.pendingApprovals, calls, ms: Date.now() - started }
      } else {
        const write = opts.variant === 'a' ? writeCoverLetter : writeCoverLetterB
        const run = await callLog.run(calls, () => write(c.resume, posting, writeOpts))
        result = {
          caseId: c.id,
          sample,
          content: run.content,
          pendingApprovals: run.pendingApprovals,
          calls,
          ms: Date.now() - started,
          variant: opts.variant,
          model: opts.model,
          issues: run.issues,
          firstIssues: run.firstIssues,
          refined: run.refined,
          notices: run.notices,
        }
      }
    } catch (err) {
      result = { caseId: c.id, sample, content: '', pendingApprovals: [], calls, ms: Date.now() - started, error: String(err), variant: opts.variant, model: opts.model }
    }
    writeJson(path.join(dir, `${c.id}.s${sample}.json`), result)
    console.log(`${c.id}.s${sample} ${result.error ? `ERROR ${result.error}` : `${result.content.split(/\s+/).length} words, ${(result.ms / 1000).toFixed(1)} s`}`)
  })
}

// ---------------------------------------------------------------------------
// score: deterministic checks + judge
// ---------------------------------------------------------------------------

let judgeClient: Anthropic | null = null

async function judge(c: EvalCase, letter: string): Promise<{ result: JudgeResult; call: CallUsage }> {
  judgeClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 5 * 60_000, maxRetries: 2 })
  const response = await judgeClient.messages.parse({
    model: JUDGE_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: zodOutputFormat(JudgeOutput) },
    messages: [
      {
        role: 'user',
        content: buildJudgePrompt({
          today: new Date().toISOString().slice(0, 10),
          company: c.company,
          role: c.role,
          caseNotes: caseNotes(c),
          jobText: c.jobText,
          resumeJson: JSON.stringify(c.resume, null, 1),
          letter,
        }),
      },
    ],
  })
  if (response.stop_reason === 'refusal') throw new Error(`Judge refused: ${response.stop_details?.category ?? 'no category'}`)
  if (!response.parsed_output) throw new Error(`Judge output did not parse (stop_reason ${response.stop_reason})`)
  return { result: response.parsed_output, call: { model: response.model, usage: response.usage } }
}

/** A verdict outside what the criterion allows counts against the letter; a situation verdict on a straight-fit case does not count at all. */
function effectiveVerdict(c: EvalCase, id: JudgeCriterionId, verdict: 'pass' | 'fail' | 'n/a'): 'pass' | 'fail' | 'n/a' {
  if (id === 'situation_addressed' && c.tags.every((t) => t === 'strong-fit')) return 'n/a'
  if (verdict === 'n/a' && !NA_ALLOWED.has(id)) return 'fail'
  return verdict
}

async function score(label: string, repeatCount: number) {
  const { cases } = loadFixtures()
  const byId = new Map(cases.map((c) => [c.id, c]))
  const letters = loadRun(label)
  // Letters already judged under this rubric version keep their verdicts.
  const previous = existsSync(scoresFile(label)) ? readJson<Scored[]>(scoresFile(label)) : []
  const scored = await pool(letters, CONCURRENCY, async (g): Promise<Scored> => {
    const kept = previous.find((p) => p.caseId === g.caseId && p.sample === g.sample && p.judge)
    if (kept) return kept
    const c = byId.get(g.caseId)!
    const checks = checkLetter({
      letter: g.content,
      jobText: c.jobText,
      resumeText: flattenAllText(c.resume),
      candidateName: c.resume.basics?.name ?? '',
    })
    const base: Scored = { caseId: g.caseId, sample: g.sample, checks, pendingApprovals: g.pendingApprovals, judgeCalls: [] }
    if (g.error) return { ...base, error: `generation: ${g.error}` }
    try {
      const first = await judge(c, g.content)
      base.judge = first.result
      base.judgeCalls.push(first.call)
      console.log(`${g.caseId}.s${g.sample} judged`)
      return base
    } catch (err) {
      return { ...base, error: `judge: ${String(err)}` }
    }
  })

  // Judge consistency: re-judge the first sample of the first N cases.
  const alreadyRepeated = scored.filter((s) => s.judgeRepeat).length
  const repeatTargets = scored.filter((s) => s.sample === 1 && s.judge && !s.judgeRepeat).slice(0, Math.max(0, repeatCount - alreadyRepeated))
  await pool(repeatTargets, CONCURRENCY, async (s) => {
    const g = letters.find((l) => l.caseId === s.caseId && l.sample === s.sample)!
    try {
      const again = await judge(byId.get(s.caseId)!, g.content)
      s.judgeRepeat = again.result
      s.judgeCalls.push(again.call)
    } catch (err) {
      console.log(`${s.caseId} repeat judge failed: ${String(err)}`)
    }
  })

  writeJson(scoresFile(label), scored)
  console.log(`Scored ${scored.length} letters (${scored.filter((s) => s.error).length} errors).`)
}

// ---------------------------------------------------------------------------
// negatives: letters the judge must fail
// ---------------------------------------------------------------------------

const GENERIC_LETTER = `Dear Hiring Manager,

I am writing to express my interest in the open position at your company. I am a hard-working and dynamic professional with a proven track record of success, and I am passionate about delivering results.

Throughout my career I have developed strong communication, leadership and problem-solving skills. I am a team player who thrives in fast-paced environments and I am confident that I would be a great addition to your team.

Thank you for your time and consideration. I look forward to hearing from you.

Sincerely,
Candidate`

async function negatives(label: string) {
  const { cases } = loadFixtures()
  const target = cases.find((c) => c.id === 'p09')!
  const foreign = loadRun(label).find((g) => g.caseId !== target.id && g.sample === 1 && g.content)
  const probes = [
    { name: 'empty letter', letter: '' },
    { name: 'generic template letter', letter: GENERIC_LETTER.replace('Candidate', target.resume.basics?.name ?? 'Candidate') },
    { name: `letter written for another candidate and job (${foreign?.caseId})`, letter: foreign?.content ?? '' },
  ]
  const results = []
  for (const probe of probes) {
    const { result } = await judge(target, probe.letter)
    const passed = JUDGE_CRITERIA.filter((cr) => effectiveVerdict(target, cr.id, result.criteria[cr.id].verdict) === 'pass').map((cr) => cr.id)
    results.push({ probe: probe.name, wronglyPassed: passed, result })
    console.log(`${probe.name}: wrongly passed ${passed.length ? passed.join(', ') : 'nothing'}`)
  }
  writeJson(path.join(OUT_DIR, 'negatives.json'), results)
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${Math.round((100 * n) / d)}% (${n}/${d})`
}

function report(label: string) {
  const { cases } = loadFixtures()
  const byId = new Map(cases.map((c) => [c.id, c]))
  const scored = readJson<Scored[]>(scoresFile(label))
  const letters = loadRun(label)
  const ok = scored.filter((s) => s.judge)
  const lines: string[] = [`# Cover letter eval: ${label} (rubric v${RUBRIC_VERSION})`, '', `${scored.length} letters over ${cases.length} cases; ${scored.length - ok.length} not judged because of errors.`, '']

  lines.push('## Judge criteria (pass rate, n/a excluded)', '', '| Criterion | Pass rate |', '|---|---|')
  for (const cr of JUDGE_CRITERIA) {
    const verdicts = ok.map((s) => effectiveVerdict(byId.get(s.caseId)!, cr.id, s.judge!.criteria[cr.id].verdict)).filter((v) => v !== 'n/a')
    lines.push(`| ${cr.id} | ${pct(verdicts.filter((v) => v === 'pass').length, verdicts.length)} |`)
  }

  const all = scored.map((s) => s.checks)
  const coverages = all.map((c) => c.keywordCoverage).filter((v): v is number => v !== null)
  lines.push(
    '',
    '## Deterministic checks',
    '',
    `- In the 250-400 word band: ${pct(all.filter((c) => c.inWordBand).length, all.length)}; median ${[...all.map((c) => c.words)].sort((a, b) => a - b)[Math.floor(all.length / 2)]} words`,
    `- Formal greeting: ${pct(all.filter((c) => c.formalGreeting).length, all.length)}; invented addressee: ${all.filter((c) => c.inventedAddressee).length}`,
    `- Sign-off with the candidate's name: ${pct(all.filter((c) => c.hasSignOff).length, all.length)}`,
    `- Free of banned phrases: ${pct(all.filter((c) => c.bannedPhrases.length === 0).length, all.length)}`,
    `- Placeholders left in: ${all.filter((c) => c.placeholders.length).length}; em-dashes: ${all.filter((c) => c.hasEmDash).length}`,
    `- Supported job keywords covered: mean ${coverages.length ? Math.round((100 * coverages.reduce((a, b) => a + b, 0)) / coverages.length) : 0}%`,
    `- Letters with hallucination-guard flags: ${pct(scored.filter((s) => s.pendingApprovals.length).length, scored.length)}`,
    `- Judge-found factual errors: ${ok.reduce((n, s) => n + s.judge!.factual_errors.length, 0)} across ${pct(ok.filter((s) => s.judge!.factual_errors.length).length, ok.length)} of letters`,
    `- Judge-found overstatements: ${ok.reduce((n, s) => n + s.judge!.inflations.length, 0)}; unsupported company claims: ${ok.reduce((n, s) => n + s.judge!.unsupported_company_claims.length, 0)}`
  )

  const repeated = ok.filter((s) => s.judgeRepeat)
  if (repeated.length) {
    let same = 0
    let total = 0
    for (const s of repeated) {
      for (const cr of JUDGE_CRITERIA) {
        const c = byId.get(s.caseId)!
        total++
        if (effectiveVerdict(c, cr.id, s.judge!.criteria[cr.id].verdict) === effectiveVerdict(c, cr.id, s.judgeRepeat!.criteria[cr.id].verdict)) same++
      }
    }
    lines.push('', `Judge self-agreement on ${repeated.length} re-judged letters: ${pct(same, total)} of verdicts.`)
  }

  const genCost = costOf(letters.flatMap((g) => g.calls))
  const judgeCost = costOf(scored.flatMap((s) => s.judgeCalls))
  lines.push('', `Cost: generation $${genCost.toFixed(3)} ($${(genCost / Math.max(1, letters.length)).toFixed(4)} per letter), judging $${judgeCost.toFixed(3)}.`)
  lines.push('', ...pipelineSection(letters))

  lines.push('', '## Per letter', '', '| Letter | Case | Words | Coverage | Guard flags | Judge fails | Factual errors |', '|---|---|---|---|---|---|---|')
  for (const s of scored) {
    const c = byId.get(s.caseId)!
    const fails = s.judge
      ? JUDGE_CRITERIA.filter((cr) => effectiveVerdict(c, cr.id, s.judge!.criteria[cr.id].verdict) === 'fail').map((cr) => cr.id).join(', ')
      : `ERROR ${s.error}`
    const cov = s.checks.keywordCoverage === null ? 'n/a' : `${Math.round(100 * s.checks.keywordCoverage)}%`
    lines.push(`| ${s.caseId}.s${s.sample} | ${c.company}, ${c.tags.join('+')} | ${s.checks.words} | ${cov} | ${s.pendingApprovals.join('; ') || '-'} | ${fails || '-'} | ${s.judge?.factual_errors.map((u) => u.claim).join('; ') || '-'} |`)
  }

  lines.push('', '## Evidence for the most common failures', '')
  const failCounts = JUDGE_CRITERIA.map((cr) => ({
    id: cr.id,
    fails: ok.filter((s) => effectiveVerdict(byId.get(s.caseId)!, cr.id, s.judge!.criteria[cr.id].verdict) === 'fail'),
  })).sort((a, b) => b.fails.length - a.fails.length)
  for (const { id, fails } of failCounts.slice(0, 4)) {
    lines.push(`### ${id} (${fails.length} fails)`, '')
    for (const s of fails.slice(0, 3)) {
      const v = s.judge!.criteria[id]
      lines.push(`- ${s.caseId}.s${s.sample}: "${v.evidence}" - ${v.reason}`)
    }
    lines.push('')
  }

  const negFile = path.join(OUT_DIR, 'negatives.json')
  if (existsSync(negFile)) {
    lines.push('## Judge negatives', '')
    for (const n of readJson<{ probe: string; wronglyPassed: string[] }[]>(negFile)) {
      lines.push(`- ${n.probe}: wrongly passed ${n.wronglyPassed.length ? n.wronglyPassed.join(', ') : 'nothing'}`)
    }
  }

  const out = path.join(OUT_DIR, `${label}-report.md`)
  writeFileSync(out, lines.join('\n') + '\n')

  const letterDoc = letters.map((g) => {
    const c = byId.get(g.caseId)!
    return `## ${g.caseId}.s${g.sample}: ${c.company}, ${c.role} (${c.resumeTitle})\n\n${g.content || `ERROR ${g.error}`}\n`
  })
  writeFileSync(path.join(OUT_DIR, `${label}-letters.md`), `# Letters: ${label}\n\n${letterDoc.join('\n')}`)
  console.log(`Wrote ${out}`)
}

// ---------------------------------------------------------------------------
// import-cvs: shared real CVs through the app's own upload extraction
// ---------------------------------------------------------------------------

const REAL_CV_DIR = path.join(OUT_DIR, 'real-cvs')
const UPLOAD_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

/**
 * Converts every PDF/DOCX in real-cvs/ to real-cvs/<name>.json with the same
 * parseFile + extractResume path an upload takes, so extraction mistakes show
 * up here too. Check each JSON against its source before pairing it.
 */
async function importCvs() {
  mkdirSync(REAL_CV_DIR, { recursive: true })
  // Keys are neutral (r01, r02, ...) so no one's name ends up in pairs or
  // reports; index.json maps each source file to its key.
  const indexFile = path.join(REAL_CV_DIR, 'index.json')
  const index: Record<string, string> = existsSync(indexFile) ? readJson(indexFile) : {}
  const files = readdirSync(REAL_CV_DIR).filter((f) => UPLOAD_MIME[path.extname(f).toLowerCase()]).sort()
  if (files.length === 0) console.log(`No PDF or DOCX files in ${REAL_CV_DIR}`)
  for (const file of files) {
    index[file] ??= `r${String(Object.keys(index).length + 1).padStart(2, '0')}`
    const key = index[file]
    writeJson(indexFile, index)
    const out = path.join(REAL_CV_DIR, `${key}.json`)
    if (existsSync(out)) {
      console.log(`${key}: already imported`)
      continue
    }
    const text = await parseFile(readFileSync(path.join(REAL_CV_DIR, file)), UPLOAD_MIME[path.extname(file).toLowerCase()])
    writeJson(out, await extractResume(text))
    console.log(`${key}: imported`)
  }
}

/** Pairs for shared real CVs live beside them (git-ignored), never in pairs.ts. */
function allPairs(): EvalPair[] {
  const file = path.join(REAL_CV_DIR, 'pairs.local.json')
  return existsSync(file) ? [...EVAL_PAIRS, ...readJson<EvalPair[]>(file)] : EVAL_PAIRS
}

// ---------------------------------------------------------------------------
// calibration: a blind labelling sheet for the factual-error verdicts
// ---------------------------------------------------------------------------

const CAL_SHEET = path.join(OUT_DIR, 'calibration.md')
const CAL_KEY = path.join(OUT_DIR, 'calibration.key.json')

function calibration(label: string, flaggedCount: number, unflaggedCount: number) {
  if (existsSync(CAL_SHEET)) throw new Error(`${CAL_SHEET} already exists and may hold labels; move it away first.`)
  const { cases } = loadFixtures()
  const scored = readJson<Scored[]>(scoresFile(label))
  const letters = loadRun(label)
  type Draft = Omit<CalibrationItem, 'id'>
  const flaggedGroups: Draft[][] = []
  const unflaggedGroups: Draft[][] = []

  for (const c of cases.filter((x) => !x.skipCalibration)) {
    const flagged: Draft[] = []
    const unflagged: Draft[] = []
    const lines = resumeLines(c.resume)
    const names = [
      ...(c.resume.work ?? []).map((w) => w.name),
      ...(c.resume.education ?? []).map((e) => e.institution),
      ...(c.resume.projects ?? []).map((p) => p.name),
    ].filter((n): n is string => !!n && n.length > 2).map((n) => n.toLowerCase())

    for (const s of scored.filter((x) => x.caseId === c.id && x.judge)) {
      const letter = letters.find((g) => g.caseId === s.caseId && g.sample === s.sample)!.content
      const sentences = splitSentences(letter).filter((x) => !/^(dear|sincerely|best|regards|thank you)\b/i.test(x))
      const letterId = `${s.caseId}.s${s.sample}`
      // Any sentence a claim might point at stays out of the unflagged pool, so a
      // paraphrased claim cannot turn into a false "miss".
      const touched = new Set<string>()
      for (const err of s.judge!.factual_errors) {
        const loose = bestSentence(err.claim, sentences)
        if (loose) touched.add(loose.sentence)
        const sentence = sentenceForClaim(err.claim, sentences)
        if (!sentence || flagged.some((f) => f.sentence === sentence)) continue
        flagged.push({ letterId, company: c.company, sentence, resumeLines: closestLines(sentence, lines), judgeFlagged: true, judgeClaim: err.claim })
      }
      for (const sentence of sentences) {
        if (touched.has(sentence)) continue
        const lower = sentence.toLowerCase()
        if (!/\d/.test(sentence) && !names.some((n) => lower.includes(n))) continue
        unflagged.push({ letterId, company: c.company, sentence, resumeLines: closestLines(sentence, lines), judgeFlagged: false })
      }
    }
    flaggedGroups.push(flagged)
    unflaggedGroups.push(unflagged)
  }

  const drafts = seededShuffle([...roundRobin(flaggedGroups, flaggedCount), ...roundRobin(unflaggedGroups, unflaggedCount)])
  const items: CalibrationItem[] = drafts.map((d, i) => ({ id: `C${String(i + 1).padStart(2, '0')}`, ...d }))
  writeJson(CAL_KEY, items)
  writeFileSync(CAL_SHEET, renderSheet(items))
  console.log(`Wrote ${items.length} items (${items.filter((i) => i.judgeFlagged).length} judge-flagged) to ${CAL_SHEET}`)
}

/**
 * Labels the labeller changed later by stating a rule (kept beside the sheet,
 * never written into it): { "C04": "error", "reason": "..." }.
 */
function loadLabels(dir = OUT_DIR): Map<string, Label> {
  const labels = parseLabels(readFileSync(path.join(dir, 'calibration.md'), 'utf8'))
  const overridesFile = path.join(dir, 'calibration.overrides.json')
  if (existsSync(overridesFile)) {
    for (const [id, value] of Object.entries(readJson<Record<string, string>>(overridesFile))) {
      if (/^[CK]\d+$/.test(id) && (value === 'error' || value === 'ok' || value === 'unsure')) labels.set(id, value)
    }
  }
  return labels
}

/** Re-judges the letters behind the labelled items with the current rubric and recomputes which items it flags. */
async function recheck(label: string) {
  const { cases } = loadFixtures()
  const byId = new Map(cases.map((c) => [c.id, c]))
  const letters = loadRun(label)
  const items = readJson<CalibrationItem[]>(CAL_KEY)
  const letterIds = [...new Set(items.map((i) => i.letterId))]
  const flaggedByLetter = new Map<string, string[]>()
  await pool(letterIds, CONCURRENCY, async (letterId) => {
    const [caseId, s] = letterId.split('.s')
    const g = letters.find((l) => l.caseId === caseId && l.sample === Number(s))!
    const { result } = await judge(byId.get(caseId)!, g.content)
    flaggedByLetter.set(letterId, result.factual_errors.map((e) => e.claim))
  })
  const rechecked = items.map((item) => {
    const sentences = splitSentences(letters.find((l) => `${l.caseId}.s${l.sample}` === item.letterId)!.content)
    const claim = (flaggedByLetter.get(item.letterId) ?? []).find((c) => {
      const best = bestSentence(c, sentences)
      return best?.sentence === item.sentence && best.shared >= 2
    })
    return { ...item, judgeFlagged: !!claim, judgeClaim: claim }
  })
  writeJson(path.join(OUT_DIR, `calibration.key.v${RUBRIC_VERSION}.json`), rechecked)
  agreement(rechecked)
}

function agreement(items: CalibrationItem[] = readJson<CalibrationItem[]>(CAL_KEY)) {
  const a = scoreAgreement(items, loadLabels())
  const lines = [
    `# Judge calibration result (rubric v${RUBRIC_VERSION})`,
    '',
    `Labelled ${a.labelled} of ${items.length} items (unsure and blank skipped). Agreement: ${pct(a.agree, a.labelled)}.`,
    '',
    `## Judge flagged, you said ok (${a.falseAlarms.length})`,
    ...a.falseAlarms.map((i) => `- ${i.id} ${i.letterId}: "${i.sentence}" (judge: ${i.judgeClaim})`),
    '',
    `## You said error, judge did not flag (${a.misses.length})`,
    ...a.misses.map((i) => `- ${i.id} ${i.letterId}: "${i.sentence}"`),
  ]
  writeFileSync(path.join(OUT_DIR, `calibration-result.v${RUBRIC_VERSION}.md`), lines.join('\n') + '\n')
  console.log(lines.join('\n'))
}

// ---------------------------------------------------------------------------
// verifier measurement
// ---------------------------------------------------------------------------

type FlagClass = 'confirmed' | 'false' | 'judge-only'

const squash = (t: string) => t.replace(/\s+/g, ' ').trim()

/**
 * Runs the cited-facts verifier over a run's plain-text letters (citations
 * inferred from content) and sorts each number or name flag by the person's
 * labels: confirmed (labelled error), false (labelled ok, or neither labelled
 * nor flagged by the judge) or judge-only (the judge flagged it, nobody has
 * labelled it yet). Spec 6.4: at most 1 false flag per 5 letters.
 */
function verifyRun(label: string, set = String(EVAL_SET_VERSION)) {
  // Labels for older sets live in calibration-set<N>/; the newest labelled set's sheet sits in the output root.
  const setDir = path.join(OUT_DIR, `calibration-set${set}`)
  const calDir = existsSync(setDir) ? setDir : OUT_DIR
  const calKey = path.join(calDir, 'calibration.key.json')
  const { cases, builtAt } = readJson<Fixtures>(path.join(OUT_DIR, `fixtures.set${set}.json`))
  const today = builtAt.slice(0, 7)
  const byId = new Map(cases.map((c) => [c.id, c]))
  const letters = loadRun(label).filter((g) => !g.error && byId.has(g.caseId))
  const scored = existsSync(scoresFile(label)) ? readJson<Scored[]>(scoresFile(label)) : []
  const items = existsSync(calKey) ? readJson<CalibrationItem[]>(calKey) : []
  const labels = existsSync(path.join(calDir, 'calibration.md')) ? loadLabels(calDir) : new Map<string, Label>()

  const counts: Record<VerifyIssue['kind'], number> = { number: 0, name: 0, quote: 0, form: 0, guard: 0 }
  const flags: { letterId: string; cls: FlagClass; issue: VerifyIssue }[] = []
  const ownerErrors: { letterId: string; id: string; sentence: string; flaggedAs: string[] }[] = []
  let oldGuardLetters = 0

  for (const g of letters) {
    const c = byId.get(g.caseId)!
    const letterId = `${g.caseId}.s${g.sample}`
    const sheet = buildFactSheet(c.resume)
    const parsed = parsePlainLetter(g.content)
    for (const sentence of parsed.paragraphs.flat()) {
      sentence.facts = inferCitations(sentence.text, sheet, [c.company])
      sentence.quotes = inferQuotes(sentence.text, c.jobText, sheet, c.company)
    }
    const issues = verifyLetter({ letter: parsed, sheet, jobText: c.jobText, company: c.company, role: c.role, today })
    for (const i of issues) counts[i.kind]++
    if (g.pendingApprovals.length > 0) oldGuardLetters++

    const score = scored.find((x) => x.caseId === g.caseId && x.sample === g.sample)
    const sentences = parsed.paragraphs.flat().map((x) => x.text)
    const claims = [...(score?.judge?.factual_errors ?? []), ...(score?.judgeRepeat?.factual_errors ?? [])].map((e) => e.claim)
    const judgeSentences = new Set(claims.map((cl) => sentenceForClaim(cl, sentences)).filter((x): x is string => Boolean(x)))
    const owned = items.filter((i) => i.letterId === letterId)
    const ownerItem = (text: string) => owned.find((i) => squash(i.sentence) === squash(text) || squash(text).includes(squash(i.sentence)))

    const factIssues = issues.filter((i) => (i.kind === 'number' || i.kind === 'name' || i.kind === 'guard') && i.sentence)
    for (const issue of factIssues) {
      const item = ownerItem(issue.sentence!)
      const verdict = item ? labels.get(item.id) : undefined
      const cls: FlagClass =
        verdict === 'error' ? 'confirmed' : verdict === 'ok' ? 'false' : judgeSentences.has(issue.sentence!) ? 'judge-only' : 'false'
      flags.push({ letterId, cls, issue })
    }
    for (const item of owned) {
      if (labels.get(item.id) !== 'error') continue
      const hits = factIssues.filter((i) => ownerItem(i.sentence!)?.id === item.id).map((i) => i.kind)
      ownerErrors.push({ letterId, id: item.id, sentence: item.sentence, flaggedAs: [...new Set(hits)] })
    }
  }

  const n = letters.length
  const falseFlags = flags.filter((f) => f.cls === 'false').length
  const allowed = Math.floor(n / 5)
  const missed = ownerErrors.filter((e) => e.flaggedAs.length === 0)
  const lines = [
    `# Verifier on ${label} (${n} letters, citations inferred from content)`,
    '',
    `Issues by kind: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `Old guard: ${oldGuardLetters} of ${n} letters had pending approvals.`,
    '',
    `Number, name and guard flags: ${flags.length} (confirmed ${flags.filter((f) => f.cls === 'confirmed').length}, judge-only ${flags.filter((f) => f.cls === 'judge-only').length}, false ${falseFlags}).`,
    `False flags per 5 letters: ${((falseFlags / Math.max(1, n)) * 5).toFixed(2)} (gate: at most 1, so at most ${allowed} here).`,
    `Labelled errors flagged: ${ownerErrors.length - missed.length} of ${ownerErrors.length}.`,
    '',
    `**Gate (false flags): ${falseFlags <= allowed ? 'PASS' : 'FAIL'}.** Missed labelled errors need a kind (misattribution, number, invented, meaning) from a person; only meaning changes may be missed.`,
    '',
    '## Labelled errors',
    ...ownerErrors.map((e) => `- ${e.id} ${e.letterId} [${e.flaggedAs.length ? `flagged: ${e.flaggedAs.join(', ')}` : 'MISSED'}]: "${e.sentence}"`),
    '',
    '## Flags',
    ...flags.map((f) => `- **${f.cls}** ${f.letterId} ${f.issue.kind}: ${f.issue.detail}\n  > ${f.issue.sentence}`),
  ]
  const out = path.join(OUT_DIR, `verifier-${label}.md`)
  writeFileSync(out, lines.join('\n') + '\n')
  console.log(lines.slice(0, 11).join('\n'))
  console.log(`\nWrote ${out}`)
}

// ---------------------------------------------------------------------------
// pipeline measurements and variant comparison
// ---------------------------------------------------------------------------

const quantile = (values: number[], q: number) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]
}

/** Latency, refines, verifier flags and pending approvals for a run. */
function pipelineSection(letters: Generated[]): string[] {
  const done = letters.filter((g) => !g.error)
  const seconds = done.map((g) => g.ms / 1000)
  const out = [
    '## Pipeline',
    '',
    `- Latency p50 ${quantile(seconds, 0.5).toFixed(1)} s, p95 ${quantile(seconds, 0.95).toFixed(1)} s, max ${Math.max(0, ...seconds).toFixed(1)} s; generation errors ${letters.length - done.length}`,
  ]
  const verified = done.filter((g) => g.issues)
  if (verified.length > 0) {
    const approvals = verified.map((g) => g.pendingApprovals.length)
    const flags = verified.map((g) => (g.issues ?? []).filter((i) => i.kind !== 'form').length)
    out.push(
      `- Refined: ${pct(verified.filter((g) => g.refined).length, verified.length)}; mean model calls ${(verified.reduce((n, g) => n + g.calls.length, 0) / verified.length).toFixed(2)}`,
      `- Verifier flags left after refine: ${flags.reduce((a, b) => a + b, 0)} in ${verified.filter((_, i) => flags[i] > 0).length} of ${verified.length} letters; pending approvals median ${quantile(approvals, 0.5)}`,
      `- Notices: ${[...new Set(verified.flatMap((g) => g.notices ?? []))].join(' | ') || 'none'}`,
    )
  }
  return out
}

/** Pass rate (0-100) of each judge criterion for a scored run, n/a excluded. */
function passRates(label: string): Record<string, { rate: number; n: number }> {
  const { cases } = loadFixtures()
  const byId = new Map(cases.map((c) => [c.id, c]))
  const ok = readJson<Scored[]>(scoresFile(label)).filter((s) => s.judge)
  const out: Record<string, { rate: number; n: number }> = {}
  for (const cr of JUDGE_CRITERIA) {
    const v = ok.map((s) => effectiveVerdict(byId.get(s.caseId)!, cr.id, s.judge!.criteria[cr.id].verdict)).filter((x) => x !== 'n/a')
    out[cr.id] = { rate: v.length ? (100 * v.filter((x) => x === 'pass').length) / v.length : 0, n: v.length }
  }
  return out
}

/**
 * Judge-flagged factual errors per run and, once the person has confirmed
 * them, the confirmed count from confirmed-<label>.json ({ "<letterId>": n }).
 */
function factualErrors(label: string): { flagged: number; confirmed: number | null } {
  const scored = readJson<Scored[]>(scoresFile(label))
  const file = path.join(OUT_DIR, `confirmed-${label}.json`)
  const confirmed = existsSync(file) ? Object.values(readJson<Record<string, number>>(file)).reduce((a, b) => a + b, 0) : null
  return { flagged: scored.reduce((n, s) => n + (s.judge?.factual_errors.length ?? 0), 0), confirmed }
}

/** Side-by-side pass rates and the spec 9 decision rule: A ships unless B is 10+ points better on facts or situation, or has fewer confirmed errors. */
function compare(a: string, b: string) {
  const ra = passRates(a)
  const rb = passRates(b)
  const lines = [`# ${a} vs ${b} (rubric v${RUBRIC_VERSION})`, '', `| Criterion | ${a} | ${b} | Difference |`, '|---|---|---|---|']
  for (const cr of JUDGE_CRITERIA) {
    const d = rb[cr.id].rate - ra[cr.id].rate
    lines.push(`| ${cr.id} | ${ra[cr.id].rate.toFixed(0)}% | ${rb[cr.id].rate.toFixed(0)}% | ${d >= 0 ? '+' : ''}${d.toFixed(0)} |`)
  }
  const ea = factualErrors(a)
  const eb = factualErrors(b)
  lines.push('', `Judge-flagged factual errors: ${a} ${ea.flagged}, ${b} ${eb.flagged}. Confirmed by the person: ${a} ${ea.confirmed ?? 'pending'}, ${b} ${eb.confirmed ?? 'pending'}.`)
  const better = (id: string) => rb[id].rate - ra[id].rate >= 10
  const reasons = [better('no_factual_errors') && 'no_factual_errors', better('situation_addressed') && 'situation_addressed'].filter(Boolean)
  if (ea.confirmed !== null && eb.confirmed !== null && eb.confirmed < ea.confirmed) reasons.push('fewer confirmed errors')
  const pending = ea.confirmed === null || eb.confirmed === null
  lines.push(
    '',
    reasons.length
      ? `**Verdict: ${b} wins on ${reasons.join(', ')}.**`
      : `**Verdict: ${a} ships${pending ? ', pending the confirmed-error count' : ''}.** (${b} would need 10+ points on no_factual_errors or situation_addressed, or fewer confirmed errors.)`,
  )
  const out = path.join(OUT_DIR, `compare-${a}-vs-${b}.md`)
  writeFileSync(out, lines.join('\n') + '\n')
  console.log(lines.join('\n'))
}

// ---------------------------------------------------------------------------
// confirm: the person confirms each judge-flagged factual error, blind to the variant
// ---------------------------------------------------------------------------

interface ConfirmItem extends CalibrationItem {
  /** Run label, kept in the key only, so the sheet does not show which variant wrote the sentence. */
  label: string
}

const confirmDir = (labels: string[]) => path.join(OUT_DIR, `confirm-${labels.join('-')}`)

/** Every judge-flagged factual error in the given runs, shuffled together into one blind sheet. */
function confirmSheet(labels: string[]) {
  const dir = confirmDir(labels)
  const sheet = path.join(dir, 'calibration.md')
  if (existsSync(sheet)) throw new Error(`${sheet} already exists and may hold labels; move it away first.`)
  const { cases } = loadFixtures()
  const byId = new Map(cases.map((c) => [c.id, c]))
  const drafts: Omit<ConfirmItem, 'id'>[] = []
  for (const label of labels) {
    const letters = loadRun(label)
    for (const s of readJson<Scored[]>(scoresFile(label)).filter((x) => x.judge)) {
      const c = byId.get(s.caseId)!
      const letter = letters.find((g) => g.caseId === s.caseId && g.sample === s.sample)!.content
      const sentences = splitSentences(letter)
      const seen = new Set<string>()
      for (const err of s.judge!.factual_errors) {
        const sentence = sentenceForClaim(err.claim, sentences) ?? bestSentence(err.claim, sentences)?.sentence ?? err.claim
        if (seen.has(sentence)) continue
        seen.add(sentence)
        const letterId = `${s.caseId}.s${s.sample}`
        drafts.push({ label, letterId, company: c.company, sentence, resumeLines: closestLines(sentence, resumeLines(c.resume)), judgeFlagged: true, judgeClaim: err.claim })
      }
    }
  }
  const items: ConfirmItem[] = seededShuffle(drafts, 11).map((d, i) => ({ id: `K${String(i + 1).padStart(2, '0')}`, ...d }))
  writeJson(path.join(dir, 'calibration.key.json'), items)
  // The sheet hides which run each sentence came from: neutral IDs and no letter IDs.
  writeFileSync(sheet, renderSheet(items.map((i) => ({ ...i, letterId: 'letter' }))).replace('# Judge calibration: factual errors', '# Confirm factual errors\n\nThe judge flagged every sentence below. Decide, by your rule, whether each one really is a factual error.'))
  console.log(`Wrote ${items.length} items from ${labels.join(', ')} to ${sheet}`)
}

/** Confirmed errors per letter from the person's labels, as confirmed-<label>.json for compare. */
function confirmScore(labels: string[]) {
  const dir = confirmDir(labels)
  const items = readJson<ConfirmItem[]>(path.join(dir, 'calibration.key.json'))
  const marks = loadLabels(dir)
  for (const label of labels) {
    const counts: Record<string, number> = {}
    for (const item of items.filter((i) => i.label === label)) {
      if (marks.get(item.id) === 'error') counts[item.letterId] = (counts[item.letterId] ?? 0) + 1
    }
    writeJson(path.join(OUT_DIR, `confirmed-${label}.json`), counts)
    const labelled = items.filter((i) => i.label === label && marks.has(i.id)).length
    console.log(`${label}: ${Object.values(counts).reduce((a, b) => a + b, 0)} confirmed of ${items.filter((i) => i.label === label).length} flagged (${labelled} labelled)`)
  }
}

// ---------------------------------------------------------------------------

async function main() {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    // the environment may already carry the variables
  }
  const argv = process.argv.slice(2)
  const flag = (name: string) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--variant', '--model', '--only', '--budget', '--effort'].includes(argv[i - 1])))
  const [command, label = 'baseline', arg] = positional
  if (command === 'fixtures') return buildFixtures()
  if (command === 'generate') {
    const variant = (flag('--variant') ?? 'baseline') as Variant
    if (!['baseline', 'a', 'b'].includes(variant)) throw new Error(`Unknown variant ${variant}`)
    const budget = flag('--budget')
    const effort = flag('--effort') as 'low' | 'medium' | 'high' | undefined
    const off = argv.includes('--no-thinking')
    const thinking = budget || effort || off ? { budget: budget ? Number(budget) : undefined, effort, off } : undefined
    return generate(label, Number(arg ?? 2), { variant, model: flag('--model'), thinking, notes: argv.includes('--notes'), only: flag('--only')?.split(',') })
  }
  if (command === 'compare') return compare(label, arg)
  if (command === 'confirm') return confirmSheet(label.split(','))
  if (command === 'confirm-score') return confirmScore(label.split(','))
  if (command === 'score') return score(label, Number(arg ?? 6))
  if (command === 'negatives') return negatives(label)
  if (command === 'report') return report(label)
  if (command === 'calibration') return calibration(label, Number(arg ?? 14), Number(process.argv[5] ?? 6))
  if (command === 'agreement') return agreement()
  if (command === 'recheck') return recheck(label)
  if (command === 'import-cvs') return importCvs()
  if (command === 'verify') return verifyRun(label, arg)
  console.error('Usage: eval.ts fixtures | generate <label> [samples] | score <label> [repeats] | negatives <label> | report <label> | calibration <label> | agreement | verify <label> [set] | compare <labelA> <labelB> | confirm <labels> | confirm-score <labels>')
  process.exitCode = 2
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
