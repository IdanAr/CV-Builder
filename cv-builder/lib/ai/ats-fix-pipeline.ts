import { z } from 'zod'
import { getAnthropic } from './models'
import { detectHallucinations } from './hallucination-guard'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export interface AtsFix {
  id: string
  section: 'work' | 'summary'
  workIndex?: number
  highlightIndex?: number
  original: string
  suggested: string
  targetKeywords: string[]
  /** Numeric claims in `suggested` absent from the original text — require explicit user approval. */
  pendingApprovals: string[]
}

const RawFixSchema = z.object({
  sectionIndex: z.number().int().nonnegative(),
  original: z.string(),
  suggested: z.string(),
  targetKeywords: z.array(z.string()),
})

interface EditableSection {
  section: 'work' | 'summary'
  workIndex?: number
  highlightIndex?: number
  text: string
  label: string
}

function buildEditableSections(data: ResumeData): EditableSection[] {
  const sections: EditableSection[] = []

  if (data.basics?.summary?.trim()) {
    sections.push({
      section: 'summary',
      text: data.basics.summary,
      label: 'Professional Summary',
    })
  }

  for (let wi = 0; wi < (data.work ?? []).length; wi++) {
    const job = data.work![wi]
    for (let hi = 0; hi < (job.highlights ?? []).length; hi++) {
      const text = job.highlights![hi]
      if (text?.trim()) {
        sections.push({
          section: 'work',
          workIndex: wi,
          highlightIndex: hi,
          text,
          label: `${job.position ?? 'Role'} at ${job.name ?? 'Company'} - bullet ${hi + 1}`,
        })
      }
    }
  }

  return sections
}

export async function runAtsFixPipeline(
  data: ResumeData,
  missingKeywords: string[]
): Promise<AtsFix[]> {
  const keywords = missingKeywords.slice(0, 20)
  if (keywords.length === 0) return []

  const sections = buildEditableSections(data)
  if (sections.length === 0) return []

  const sectionsText = sections
    .map((s, i) => `[${i}] ${s.label}: "${s.text}"`)
    .join('\n')

  const prompt = `You are an expert resume writer optimizing a CV for ATS keyword coverage.

Missing keywords to incorporate: ${keywords.join(', ')}

Resume sections available to improve:
${sectionsText}

For each missing keyword, suggest ONE targeted edit to a section that naturally incorporates the keyword. Preserve factual accuracy - do not invent metrics, numbers, or experiences not implied by the original text. Do not use em dashes (—) in the suggested text; use a regular hyphen (-) or rephrase instead.

Return a JSON array. Maximum 5 fixes. Each object:
{
  "sectionIndex": <index from the list above>,
  "original": "<exact original text unchanged>",
  "suggested": "<improved text with keyword(s) naturally woven in>",
  "targetKeywords": ["<keyword>"]
}

Return ONLY the JSON array, no other text.`

  const anthropic = getAnthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '[]'

  let raw: unknown
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    raw = jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch {
    return []
  }

  if (!Array.isArray(raw)) return []

  const fixes: AtsFix[] = []
  for (const candidate of raw) {
    const parsed = RawFixSchema.safeParse(candidate)
    if (!parsed.success) continue
    const item = parsed.data

    const section = sections[item.sectionIndex]
    if (!section) continue
    // The model must quote the current resume text verbatim — a mismatch means
    // it targeted stale or invented content, and applying it would replace the
    // wrong text.
    if (item.original.trim() !== section.text.trim()) continue
    if (item.original.trim() === item.suggested.trim()) continue

    const id = section.section === 'summary'
      ? 'fix-summary'
      : `fix-work-${section.workIndex}-${section.highlightIndex}`

    fixes.push({
      id,
      section: section.section,
      workIndex: section.workIndex,
      highlightIndex: section.highlightIndex,
      original: item.original,
      suggested: item.suggested,
      targetKeywords: item.targetKeywords,
      pendingApprovals: detectHallucinations(section.text, item.suggested),
    })
  }

  return fixes
}
