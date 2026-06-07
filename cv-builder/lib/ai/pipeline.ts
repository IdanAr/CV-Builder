// lib/ai/pipeline.ts
import { getAnthropic } from './models'
import { detectHallucinations } from './hallucination-guard'

export type SuggestionField = 'highlight' | 'summary'

export interface PipelineResult {
  suggestion: string
  pendingApprovals: string[]
}

interface PipelineContext {
  jobTitle?: string
  company?: string
  field: SuggestionField
}

async function callClaude(prompt: string): Promise<string> {
  const anthropic = getAnthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = msg.content[0]
  return block.type === 'text' ? block.text.trim() : ''
}

async function generate(input: string, ctx: PipelineContext): Promise<string> {
  const contextStr = [
    ctx.jobTitle && `Job title: ${ctx.jobTitle}`,
    ctx.company && `Company: ${ctx.company}`,
  ].filter(Boolean).join('. ')

  const prompt = ctx.field === 'highlight'
    ? `You are a professional CV writer. Candidate's rough notes: "${input}". ${contextStr ? contextStr + '.' : ''} Write exactly ONE powerful bullet point (max 20 words) using ONLY facts from the notes. Start with a strong past-tense action verb. Return the bullet text only, no prefix character.`
    : `You are a professional CV writer. Candidate's notes: "${input}". ${contextStr ? contextStr + '.' : ''} Write a 2-sentence professional CV summary using ONLY facts provided. First sentence: role and expertise level. Second sentence: key strength and impact. Return the summary text only.`

  return callClaude(prompt)
}

async function critique(input: string, generated: string, field: SuggestionField): Promise<string> {
  const prompt = field === 'highlight'
    ? `Review this CV bullet against the candidate's original notes.\nOriginal notes: "${input}"\nGenerated bullet: "${generated}"\nCheck: 1) Does it start with an action verb? 2) Are ALL numbers/percentages taken directly from the original notes? 3) No invented facts?\nReply "APPROVED" if all pass, or list specific issues briefly (max 30 words).`
    : `Review this CV summary against the candidate's original notes.\nOriginal notes: "${input}"\nGenerated summary: "${generated}"\nCheck: Are all facts and figures from the original? Is the tone professional?\nReply "APPROVED" or list issues briefly (max 30 words).`

  return callClaude(prompt)
}

async function refine(input: string, generated: string, critiqueNotes: string, field: SuggestionField): Promise<string> {
  if (critiqueNotes.toUpperCase().startsWith('APPROVED')) return generated

  const prompt = field === 'highlight'
    ? `Fix this CV bullet based on the feedback.\nCandidate's original notes: "${input}"\nCurrent bullet: "${generated}"\nFeedback: ${critiqueNotes}\nReturn ONLY the corrected bullet (max 20 words, no prefix character).`
    : `Fix this CV summary based on the feedback.\nCandidate's original notes: "${input}"\nCurrent summary: "${generated}"\nFeedback: ${critiqueNotes}\nReturn ONLY the corrected summary.`

  return callClaude(prompt)
}

export async function runSuggestionPipeline(input: string, ctx: PipelineContext): Promise<PipelineResult> {
  const generated = await generate(input, ctx)
  const critiqueNotes = await critique(input, generated, ctx.field)
  const suggestion = await refine(input, generated, critiqueNotes, ctx.field)
  const pendingApprovals = detectHallucinations(input, suggestion)
  return { suggestion, pendingApprovals }
}
