// lib/ai/cover-letter/write-with-critique.ts
// The cover letter writer the app uses ("variant B" in the eval): the plan,
// the letter and a critique are separate calls, then at most one refine if
// the critique or the verifier found problems. A separate critique catches
// what an in-call self-review misses (spec 6.3, 9). Whatever still fails
// becomes a pending approval, as in variant A: that includes critique
// problems no refine got to fix, and a letter the critique never reviewed.
import { z } from 'zod'
import { COVER_LETTER_MODEL, COVER_LETTER_THINKING } from '@/lib/ai/models'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import { formatMonth } from './dates'
import { buildFactSheet, renderFactSheet } from './fact-sheet'
import { detectGaps } from './gaps'
import { detectLanguage } from './language'
import {
  approvalText,
  assembleRun,
  callStructured,
  CutOffError,
  gateSituation,
  greetingFor,
  signOffFor,
  situationIssues,
  worthARefine,
  type CoverLetterRun,
  type ProgressStep,
  type WriteOptions,
} from './pipeline'
import { preparePosting } from './posting'
import { buildCritiquePrompt, buildRefinePrompt, buildWritePrompt, situationAllowed, situationRequired } from './prompt'
import { LetterPlanSchema, StructuredLetterSchema, WrittenLetterSchema, type WrittenLetter } from './schema'
import { verifyLetter, type VerifyIssue } from './verify'

const CritiqueSchema = z.object({
  problems: z.array(z.object({ sentence: z.string(), problem: z.string() })),
})

/** A refine is only started with at least this much of the budget left. */
const REFINE_FLOOR_MS = 20_000
/** The critique is only started with at least this much of the budget left; below it the letter goes out unreviewed. */
const CRITIQUE_FLOOR_MS = 12_000
/** A call is retried without thinking only with at least this much of the budget left. */
const RETRY_FLOOR_MS = 10_000
/** The first call gets at least this long even when the caller's own work ate into the budget. */
const FIRST_CALL_FLOOR_MS = 10_000

export const NOT_REVIEWED_NOTICE = 'The editor check did not run on this letter, so read it closely before sending.'
export const NOT_REVIEWED_APPROVAL = 'The editor check did not run on this letter. Read it closely, then keep it.'

export async function writeCoverLetterWithCritique(
  data: ResumeData,
  input: { company: string; role: string; jobText: string },
  opts: WriteOptions = {},
): Promise<CoverLetterRun & { language: 'en' | 'he'; reviewed: boolean }> {
  const now = opts.now ?? Date.now
  const deadline = opts.deadlineAt ?? now() + (opts.deadlineMs ?? 60_000)
  const left = () => deadline - now()
  const today = opts.today ?? formatMonth(new Date().getFullYear() * 12 + new Date().getMonth())
  const model = opts.model ?? COVER_LETTER_MODEL
  const thinking = opts.thinking ?? COVER_LETTER_THINKING
  const progress = (step: ProgressStep) => opts.onProgress?.(step)

  progress('reading')
  const posting = preparePosting({ company: input.company, jobText: input.jobText })
  const sheet = buildFactSheet(data)
  const factSheet = renderFactSheet(sheet)
  const name = sheet.candidateName ?? ''
  const greeting = greetingFor(posting, opts.notes)
  const gaps = detectGaps(data, today)
  const allowed = situationAllowed(gaps, opts.notes)
  const required = allowed && situationRequired(gaps, opts.notes)
  const base = buildWritePrompt({ factSheet, posting, role: input.role, greeting, candidateName: name, notes: opts.notes, gaps, situationAllowed: allowed, today })
  const settle = (w: WrittenLetter): WrittenLetter => ({ ...w, plan: gateSituation(w.plan, allowed), letter: { ...w.letter, greeting, signOff: signOffFor(w.letter.signOff, name) } })
  const check = (w: WrittenLetter) => [
    ...verifyLetter({ letter: w.letter, sheet, jobText: posting.text, company: posting.company, role: input.role, today, sparse: w.plan.sparse }),
    ...situationIssues(w.plan, required),
  ]

  let calls = 0
  /**
   * One structured call, given no more time than is left (the first call keeps
   * a floor). A cut-off or unparsed answer is retried once without thinking,
   * which is short and fast.
   */
  const call = async <T>(prompt: string, schema: z.ZodType<T>): Promise<T> => {
    const timeout = calls === 0 ? Math.max(FIRST_CALL_FLOOR_MS, left()) : left()
    if (timeout <= 0) throw new Error('The cover letter ran out of time.')
    calls++
    try {
      return await callStructured(model, prompt, schema, timeout, thinking)
    } catch (err) {
      if (!(err instanceof CutOffError) || left() < RETRY_FLOOR_MS) throw err
      calls++
      return await callStructured(model, prompt, schema, left(), { ...thinking, off: true })
    }
  }

  progress('planning')
  // The model may name a situation the code did not allow; the letter step must not see it.
  const plan = gateSituation(
    await call(`${base}\n\nFor this step, return only the plan (step 1). The letter is written in a separate step.`, LetterPlanSchema),
    allowed,
  )
  progress('writing')
  const letter = await call(
    `${base}\n\nThe plan is already made:\n<plan>\n${JSON.stringify(plan)}\n</plan>\nFor this step, write only the letter (step 2), following this plan.`,
    StructuredLetterSchema,
  )
  let written = settle({ plan, letter })

  // The letter is written; from here a call that fails or runs out of time
  // costs the review, never the letter.
  let critiqued: VerifyIssue[] | null = null
  if (left() >= CRITIQUE_FLOOR_MS) {
    progress('critiquing')
    try {
      const critique = await call(buildCritiquePrompt(written, factSheet, posting.text, allowed), CritiqueSchema)
      critiqued = critique.problems.map((p) => ({ kind: 'form', sentence: p.sentence, detail: p.problem }))
    } catch {
      critiqued = null
    }
  }

  progress('checking')
  let issues = check(written)
  const firstIssues = issues
  let refined = false
  if ((issues.some(worthARefine) || (critiqued?.length ?? 0) > 0) && left() >= REFINE_FLOOR_MS) {
    progress('refining')
    try {
      written = settle(await call(buildRefinePrompt({ previous: written, issues: [...issues, ...(critiqued ?? [])], factSheet, posting }), WrittenLetterSchema))
      refined = true
      issues = check(written)
    } catch {
      // The letter before the refine stands, with its issues.
    }
  }
  const run = assembleRun({ written, issues, firstIssues, sheetFacts: sheet.facts.length, name, refined, calls })
  // Critique problems no refine fixed are not verified facts either: the user keeps the letter knowingly.
  if (critiqued && !refined) run.pendingApprovals.push(...critiqued.map(approvalText))
  if (!critiqued) {
    run.notices.push(NOT_REVIEWED_NOTICE)
    run.pendingApprovals.push(NOT_REVIEWED_APPROVAL)
  }
  progress('done')
  return { ...run, language: detectLanguage(posting.text), reviewed: critiqued !== null }
}
