// lib/ai/cover-letter/schema.ts
// What the writer returns: a plan (the employer's needs and the evidence for
// each, the situation to address, the opening angle, why this company) and
// the letter as cited sentences. Used as the structured-output format, so the
// model's answer is validated before anything reads it.
import { z } from 'zod'

export const LetterSentenceSchema = z.object({
  text: z.string(),
  /** Fact sheet IDs this sentence relies on; empty for sentences about the employer only. */
  facts: z.array(z.string()),
  /** Exact posting snippets this sentence relies on. */
  quotes: z.array(z.string()),
})

export const StructuredLetterSchema = z.object({
  greeting: z.string(),
  paragraphs: z.array(z.array(LetterSentenceSchema)),
  signOff: z.string(),
})

export const LetterPlanSchema = z.object({
  needs: z.array(
    z.object({
      need: z.string(),
      postingQuote: z.string(),
      evidence: z.enum(['strong', 'adjacent', 'none']),
      facts: z.array(z.string()),
    }),
  ),
  /** The gap, career change, stretch or overqualification to address, or null for a straight fit. */
  situation: z.string().nullable(),
  openingAngle: z.string(),
  whyCompany: z.object({ source: z.enum(['notes', 'posting']), text: z.string() }),
  /** Fewer than two needs have strong or adjacent evidence: the letter is short rather than padded. */
  sparse: z.boolean(),
})

export const WrittenLetterSchema = z.object({
  plan: LetterPlanSchema,
  letter: StructuredLetterSchema,
})

export type LetterPlan = z.infer<typeof LetterPlanSchema>
export type WrittenLetter = z.infer<typeof WrittenLetterSchema>
