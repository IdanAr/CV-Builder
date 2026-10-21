// lib/ai/cover-letter/pipeline.ts
// Cover letter writer, variant A: one plan-and-write call with extended
// thinking (the model reviews its draft against a checklist before
// answering), then the deterministic verifier, then at most one targeted
// refine when the verifier finds problems and the time budget allows.
// Whatever still fails becomes a pending approval naming the sentence and
// the reason, so nothing unverified reaches the user unflagged.
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'
import { DEFAULT_MODEL, getAnthropic } from '@/lib/ai/models'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import { formatMonth } from './dates'
import { buildFactSheet, renderFactSheet } from './fact-sheet'
import { detectGaps } from './gaps'
import { renderLetter, type StructuredLetter } from './letter'
import { preparePosting, type PostingInfo } from './posting'
import { buildRefinePrompt, buildWritePrompt, type LetterNotes } from './prompt'
import { WrittenLetterSchema, type LetterPlan, type WrittenLetter } from './schema'
import { verifyLetter, type VerifyIssue } from './verify'

export type ProgressStep = 'reading' | 'planning' | 'writing' | 'critiquing' | 'checking' | 'refining' | 'done'

export interface WriteOptions {
  model?: string
  /** Total time budget in ms; the route's maxDuration is 60 s. */
  deadlineMs?: number
  now?: () => number
  notes?: LetterNotes
  /** YYYY-MM; defaults to the current month. */
  today?: string
  onProgress?: (step: ProgressStep) => void
  /** Thinking settings: a token budget for models that take one (Haiku 4.5), an effort level for newer ones. */
  thinking?: ThinkingTuning
}

export interface ThinkingTuning {
  budget?: number
  effort?: 'low' | 'medium' | 'high'
  /** No thinking at all: the self-review list stays in the prompt, the verifier and refine still run. */
  off?: boolean
}

export interface CoverLetterRun {
  content: string
  letter: StructuredLetter
  plan: LetterPlan
  issues: VerifyIssue[]
  /** What the verifier found in the first draft, before any refine. */
  firstIssues: VerifyIssue[]
  pendingApprovals: string[]
  refined: boolean
  notices: string[]
  calls: number
}

const DEFAULT_DEADLINE_MS = 60_000
/** A refine is only started with at least this much of the budget left. */
const REFINE_FLOOR_MS = 20_000
const APPROVAL_KINDS = new Set<VerifyIssue['kind']>(['number', 'name', 'quote', 'guard'])

/** A refine costs a second call: spend it on facts, stock phrases and em-dashes, not on a letter a few words short or long. */
export const worthARefine = (i: VerifyIssue) => APPROVAL_KINDS.has(i.kind) || !/^The letter has \d+ words/.test(i.detail)

export const THIN_CV_NOTICE = 'This CV has very little detail, so the letter is short. Adding results to the CV will make it stronger.'
export const SCRIPT_NOTICE = 'Your name is in a different script from the letter. Check the sign-off before sending.'

export function greetingFor(posting: PostingInfo, notes?: LetterNotes): string {
  const manager = notes?.hiringManager?.trim()
  if (manager) return `Dear ${manager},`
  return posting.employerNamed ? `Dear ${posting.company} Hiring Team,` : 'Dear Hiring Team,'
}

/** The model's closing word, then the CV name exactly as written. */
export function signOffFor(modelSignOff: string, name: string): string {
  const first = modelSignOff.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  const closing = first && (!name || !first.includes(name)) && first.split(/\s+/).length <= 4 ? first : 'Best regards,'
  return name ? `${closing}\n${name}` : closing
}

/** Haiku 4.5 and older take a manual thinking budget; newer models take adaptive thinking with an effort level. */
function thinkingParams(model: string, tuning: ThinkingTuning = {}) {
  const manual = /-4-5|-4-1|-4-0|claude-3/.test(model)
  if (tuning.off) return manual ? { thinking: undefined, effort: undefined } : { thinking: { type: 'disabled' as const }, effort: tuning.effort ?? ('medium' as const) }
  return manual
    ? { thinking: { type: 'enabled' as const, budget_tokens: tuning.budget ?? 3000 }, effort: undefined }
    : { thinking: { type: 'adaptive' as const }, effort: tuning.effort ?? ('medium' as const) }
}

/** The answer was cut off at the token limit or did not parse: worth one retry without thinking, which is short and fast. */
export class CutOffError extends Error {}

/** One structured-output call with the model's thinking settings; throws on a refusal, and a CutOffError on a cut-off or unparsed answer. */
export async function callStructured<T>(
  model: string,
  prompt: string,
  schema: z.ZodType<T>,
  timeoutMs: number,
  tuning?: ThinkingTuning,
): Promise<T> {
  const { thinking, effort } = thinkingParams(model, tuning)
  const res = await getAnthropic()
    .messages.parse(
    {
      model,
      max_tokens: 8000,
      ...(thinking ? { thinking } : {}),
      output_config: { format: zodOutputFormat(schema), ...(effort ? { effort } : {}) },
      messages: [{ role: 'user', content: prompt }],
    },
    { timeout: timeoutMs, maxRetries: 0 },
  )
    .catch((err: unknown) => {
      if (err instanceof Error && /parse structured output/i.test(err.message)) throw new CutOffError(err.message)
      throw err
    })
  if (res.stop_reason === 'refusal') throw new Error('The model refused to write this letter.')
  if (!res.parsed_output) throw new CutOffError(`The letter did not come back in the expected format (stop reason ${res.stop_reason}).`)
  return res.parsed_output as T
}

const HEBREW = /\p{Script=Hebrew}/u

export async function writeCoverLetter(
  data: ResumeData,
  input: { company: string; role: string; jobText: string },
  opts: WriteOptions = {},
): Promise<CoverLetterRun> {
  const now = opts.now ?? Date.now
  const started = now()
  const budget = opts.deadlineMs ?? DEFAULT_DEADLINE_MS
  const remaining = () => budget - (now() - started)
  const today = opts.today ?? formatMonth(new Date().getFullYear() * 12 + new Date().getMonth())
  const model = opts.model ?? DEFAULT_MODEL
  const progress = (step: ProgressStep) => opts.onProgress?.(step)

  progress('reading')
  const posting = preparePosting({ company: input.company, jobText: input.jobText })
  const sheet = buildFactSheet(data)
  const factSheet = renderFactSheet(sheet)
  const name = sheet.candidateName ?? ''
  const greeting = greetingFor(posting, opts.notes)
  const settle = (w: WrittenLetter): WrittenLetter => ({
    ...w,
    letter: { ...w.letter, greeting, signOff: signOffFor(w.letter.signOff, name) },
  })
  const check = (w: WrittenLetter) =>
    verifyLetter({ letter: w.letter, sheet, jobText: posting.text, company: posting.company, role: input.role, today, sparse: w.plan.sparse })

  progress('writing')
  const prompt = buildWritePrompt({
    factSheet,
    posting,
    role: input.role,
    greeting,
    candidateName: name,
    notes: opts.notes,
    gaps: detectGaps(data, today),
    today,
  })
  let calls = 1
  let first: WrittenLetter
  try {
    first = await callStructured(model, prompt, WrittenLetterSchema, Math.max(10_000, remaining()), opts.thinking)
  } catch (err) {
    if (!(err instanceof CutOffError) || remaining() < 10_000) throw err
    first = await callStructured(model, prompt, WrittenLetterSchema, remaining(), { ...opts.thinking, off: true })
    calls++
  }
  let written = settle(first)

  progress('checking')
  let issues = check(written)
  const firstIssues = issues
  let refined = false
  if (issues.some(worthARefine) && remaining() >= REFINE_FLOOR_MS) {
    progress('refining')
    written = settle(await callStructured(model, buildRefinePrompt({ previous: written, issues, factSheet, posting }), WrittenLetterSchema, remaining(), opts.thinking))
    calls++
    refined = true
    issues = check(written)
  }

  const run = assembleRun({ written, issues, firstIssues, sheetFacts: sheet.facts.length, name, refined, calls })
  progress('done')
  return run
}

/** Turns the final letter and its remaining issues into what the user sees: pending approvals for facts, notices for the rest. */
export function assembleRun(input: { written: WrittenLetter; issues: VerifyIssue[]; firstIssues: VerifyIssue[]; sheetFacts: number; name: string; refined: boolean; calls: number }): CoverLetterRun {
  const { written, issues, name } = input
  const notices = issues.filter((i) => i.kind === 'form').map((i) => i.detail)
  if (input.sheetFacts < 3) notices.push(THIN_CV_NOTICE)
  const body = written.letter.paragraphs.flat().map((s) => s.text).join(' ')
  if (name && HEBREW.test(name) !== HEBREW.test(body)) notices.push(SCRIPT_NOTICE)
  const pendingApprovals = issues
    .filter((i) => APPROVAL_KINDS.has(i.kind))
    .map((i) => (i.sentence ? `${i.sentence.length > 60 ? `${i.sentence.slice(0, 60).trimEnd()}…` : i.sentence}: ${i.detail}` : i.detail))
  return {
    content: renderLetter(written.letter),
    letter: written.letter,
    plan: written.plan,
    issues,
    firstIssues: input.firstIssues,
    pendingApprovals,
    refined: input.refined,
    notices,
    calls: input.calls,
  }
}
