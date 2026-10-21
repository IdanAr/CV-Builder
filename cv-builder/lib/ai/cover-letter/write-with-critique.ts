// lib/ai/cover-letter/write-with-critique.ts
// The cover letter writer the app uses ("variant B" in the eval): the plan,
// the letter and a critique are separate calls, then at most one refine if
// the critique or the verifier found problems. A separate critique catches
// what an in-call self-review misses (spec 6.3, 9). Whatever still fails
// becomes a pending approval, as in variant A.
import { z } from 'zod'
import { COVER_LETTER_MODEL, COVER_LETTER_THINKING } from '@/lib/ai/models'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import { formatMonth } from './dates'
import { buildFactSheet, renderFactSheet } from './fact-sheet'
import { detectGaps } from './gaps'
import { detectLanguage } from './language'
import {
  assembleRun,
  callStructured,
  CutOffError,
  greetingFor,
  signOffFor,
  worthARefine,
  type CoverLetterRun,
  type ProgressStep,
  type WriteOptions,
} from './pipeline'
import { preparePosting } from './posting'
import { buildCritiquePrompt, buildRefinePrompt, buildWritePrompt } from './prompt'
import { LetterPlanSchema, StructuredLetterSchema, WrittenLetterSchema, type WrittenLetter } from './schema'
import { verifyLetter, type VerifyIssue } from './verify'

const CritiqueSchema = z.object({
  problems: z.array(z.object({ sentence: z.string(), problem: z.string() })),
})

/** A refine is only started with at least this much of the budget left. */
const REFINE_FLOOR_MS = 20_000
/** A call is retried without thinking only with at least this much of the budget left. */
const RETRY_FLOOR_MS = 10_000

export async function writeCoverLetterWithCritique(
  data: ResumeData,
  input: { company: string; role: string; jobText: string },
  opts: WriteOptions = {},
): Promise<CoverLetterRun & { language: 'en' | 'he' }> {
  const now = opts.now ?? Date.now
  const started = now()
  const budget = opts.deadlineMs ?? 60_000
  const left = () => budget - (now() - started)
  const timeout = () => Math.max(10_000, left())
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
  const base = buildWritePrompt({ factSheet, posting, role: input.role, greeting, candidateName: name, notes: opts.notes, gaps: detectGaps(data, today), today })
  const settle = (w: WrittenLetter): WrittenLetter => ({ ...w, letter: { ...w.letter, greeting, signOff: signOffFor(w.letter.signOff, name) } })
  const check = (w: WrittenLetter) =>
    verifyLetter({ letter: w.letter, sheet, jobText: posting.text, company: posting.company, role: input.role, today, sparse: w.plan.sparse })

  let calls = 0
  /** One structured call; a cut-off or unparsed answer is retried once without thinking, which is short and fast. */
  const call = async <T>(prompt: string, schema: z.ZodType<T>): Promise<T> => {
    calls++
    try {
      return await callStructured(model, prompt, schema, timeout(), thinking)
    } catch (err) {
      if (!(err instanceof CutOffError) || left() < RETRY_FLOOR_MS) throw err
      calls++
      return await callStructured(model, prompt, schema, timeout(), { ...thinking, off: true })
    }
  }

  progress('planning')
  const plan = await call(`${base}\n\nFor this step, return only the plan (step 1). The letter is written in a separate step.`, LetterPlanSchema)
  progress('writing')
  const letter = await call(
    `${base}\n\nThe plan is already made:\n<plan>\n${JSON.stringify(plan)}\n</plan>\nFor this step, write only the letter (step 2), following this plan.`,
    StructuredLetterSchema,
  )
  let written = settle({ plan, letter })
  progress('critiquing')
  const critique = await call(buildCritiquePrompt(written, factSheet, posting.text), CritiqueSchema)

  progress('checking')
  let issues = check(written)
  const firstIssues = issues
  const critiqued: VerifyIssue[] = critique.problems.map((p) => ({ kind: 'form', sentence: p.sentence, detail: p.problem }))
  let refined = false
  if ((issues.some(worthARefine) || critiqued.length > 0) && left() >= REFINE_FLOOR_MS) {
    progress('refining')
    written = settle(await call(buildRefinePrompt({ previous: written, issues: [...issues, ...critiqued], factSheet, posting }), WrittenLetterSchema))
    refined = true
    issues = check(written)
  }
  const run = assembleRun({ written, issues, firstIssues, sheetFacts: sheet.facts.length, name, refined, calls })
  progress('done')
  return { ...run, language: detectLanguage(input.jobText) }
}
